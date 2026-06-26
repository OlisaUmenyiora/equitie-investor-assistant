import { describe, expect, it } from "vitest";
import { buildAllocationView, viewsFor } from "./finance";
import { store } from "./data/store";
import { convert } from "./fx";
import type { Allocation, Currency } from "./data/types";

function alloc(id: string): Allocation {
  const a = store.raw.allocations.find((x) => x.allocation_id === id);
  if (!a) throw new Error(`no allocation ${id}`);
  return a;
}

describe("FX conversion", () => {
  it("converts via USD between two non-USD currencies", () => {
    // 1000 GBP -> USD (×1.35) -> EUR (÷1.09)
    expect(convert(1000, "GBP", "EUR")).toBeCloseTo((1000 * 1.35) / 1.09, 6);
  });
  it("is identity for same currency", () => {
    expect(convert(1234.56, "USD", "USD")).toBe(1234.56);
  });
});

describe("INV001 Forgecraft Seed (ALC0001) — per-investor 10% price discount", () => {
  const v = buildAllocationView(alloc("ALC0001"), "GBP");
  it("uses the discounted effective share price, not the deal entry price", () => {
    expect(v.effectiveSharePrice).toBe(2.25); // 2.5 entry × (1 − 0.10)
  });
  it("current value = units × latest mark (15.4)", () => {
    expect(v.currentValue.amountDealCcy).toBeCloseTo(17777.78 * 15.4, 2);
  });
  it("MOIC = current value ÷ contributed (40k)", () => {
    expect(v.moic).toBeCloseTo((17777.78 * 15.4) / 40000, 4);
  });
});

describe("INV001 multi-round Forgecraft position aggregates across 3 deals", () => {
  const forgecraft = viewsFor("INV001", "GBP").filter(
    (x) => x.companyName === "Forgecraft Robotics",
  );
  it("holds exactly three Forgecraft rounds", () => {
    expect(forgecraft.map((x) => x.round).sort()).toEqual([
      "Seed",
      "Series A",
      "Series B",
    ]);
  });
  it("blended MOIC matches the sum of values ÷ sum of contributions", () => {
    const cv = forgecraft.reduce((s, x) => s + x.currentValue.amountReporting, 0);
    const contrib = forgecraft.reduce((s, x) => s + x.contributed.amountReporting, 0);
    const blended = cv / contrib;
    // 370,027.79 USD value ÷ 90,600 USD contributed ≈ 4.084 (currency cancels)
    expect(blended).toBeCloseTo(4.084, 2);
  });
  it("Series B is a partial call: contributed (15.6k) < committed (26k)", () => {
    const b = forgecraft.find((x) => x.round === "Series B")!;
    expect(b.contributed.amountDealCcy).toBe(15600);
    expect(b.committed.amountDealCcy).toBe(26000);
    expect(b.outstanding.amountDealCcy).toBe(10400);
  });
});

describe("Exit: Helianthe Energy fully realised (1.5×)", () => {
  const a = store.raw.distributions.find((d) => d.deal_id === "DEAL007")!;
  const v = buildAllocationView(alloc(a.allocation_id), "USD");
  it("current holding value is zero after exit", () => {
    expect(v.currentValue.amountDealCcy).toBe(0);
  });
  it("realised net distribution is recorded (net of carry)", () => {
    expect(v.distributionsNet.amountDealCcy).toBeGreaterThan(0);
    expect(v.distributionsNet.amountDealCcy).toBeLessThan(
      v.distributionsGross.amountDealCcy,
    );
  });
  it("MOIC counts distributions even though current value is 0", () => {
    expect(v.moic).not.toBeNull();
    expect(v.moic!).toBeGreaterThan(1); // 1.5× exit
  });
});

describe("Write-off: Yappio marked to 0 → a loss", () => {
  const a = store.raw.allocations.find((x) => x.deal_id === "DEAL008")!;
  const v = buildAllocationView(a, "USD");
  it("current value is zero", () => {
    expect(v.currentValue.amountDealCcy).toBe(0);
  });
  it("MOIC is below 1 (capital lost)", () => {
    if (v.moic !== null) expect(v.moic).toBeLessThan(1);
  });
});

describe("Partial secondary: Tallybook sold 30%, 70% still live", () => {
  const dist = store.raw.distributions.find((d) => d.deal_id === "DEAL020")!;
  const v = buildAllocationView(alloc(dist.allocation_id), "USD");
  it("realised fraction is 0.3", () => {
    expect(v.realisedFraction).toBeCloseTo(0.3, 6);
  });
  it("current value reflects only the remaining 70% of units", () => {
    const expected = v.units * v.latestSharePrice! * 0.7;
    expect(v.currentValue.amountDealCcy).toBeCloseTo(expected, 2);
  });
  it("realised proceeds and unrealised value coexist", () => {
    expect(v.distributionsNet.amountDealCcy).toBeGreaterThan(0);
    expect(v.currentValue.amountDealCcy).toBeGreaterThan(0);
  });
});

describe("Pending / unfunded: Grace Okafor (INV021) Helixar allocation", () => {
  const v = buildAllocationView(alloc("ALC0542"), "USD");
  it("has zero contributed and no live value (commitment, not holding)", () => {
    expect(v.contributed.amountDealCcy).toBe(0);
    expect(v.currentValue.amountDealCcy).toBe(0);
  });
  it("MOIC is undefined (nothing contributed)", () => {
    expect(v.moic).toBeNull();
  });
  it("full commitment is still outstanding", () => {
    expect(v.outstanding.amountDealCcy).toBe(75000);
  });
});

describe("Zero holdings: newly-onboarded investors", () => {
  it("Henrik Sorensen / Lara Greco hold nothing", () => {
    expect(viewsFor("INV022", "EUR")).toHaveLength(0);
    expect(viewsFor("INV023", "EUR")).toHaveLength(0);
  });
});

describe("Down round: Qubrium Series B (DEAL010) marked below entry", () => {
  it("latest mark (6.2) is below entry (10.0)", () => {
    const latest = store.latestValuationByDeal.get("DEAL010")!;
    const deal = store.dealsById.get("DEAL010")!;
    expect(latest.share_price).toBe(6.2);
    expect(latest.share_price).toBeLessThan(deal.entry_share_price);
  });
});

describe("Multi-currency: a non-USD deal converts into reporting currency", () => {
  it("an EUR deal value differs once converted to GBP", () => {
    const eur = store.raw.allocations.find(
      (x) => x.deal_currency === "EUR" && x.allocation_status === "Active",
    )!;
    const inGbp = buildAllocationView(eur, "GBP");
    const reporting: Currency = "GBP";
    expect(inGbp.contributed.reportingCurrency).toBe(reporting);
    // converting EUR→GBP changes the magnitude (rates 1.09 vs 1.35)
    if (inGbp.contributed.amountDealCcy > 0) {
      expect(inGbp.contributed.amountReporting).not.toBeCloseTo(
        inGbp.contributed.amountDealCcy,
        0,
      );
    }
  });
});
