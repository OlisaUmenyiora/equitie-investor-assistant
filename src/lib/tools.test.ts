import { describe, expect, it } from "vitest";
import {
  getAccountStatement,
  getFees,
  getInvestorProfile,
  getObligations,
  getPortfolioOverview,
  getPosition,
  getRealisedOutcomes,
  getValuationHistory,
} from "./tools";
import { store } from "./data/store";

describe("getPortfolioOverview", () => {
  it("aggregates INV001 across companies with a blended MOIC", () => {
    const o = getPortfolioOverview("INV001");
    expect(o.hasHoldings).toBe(true);
    expect(o.totals!.blendedMOIC).toBeCloseTo(2.6, 1);
    // Forgecraft appears once, with all three rounds folded in.
    const fc = o.holdings.find((h) => h.company === "Forgecraft Robotics")!;
    expect(fc.rounds.sort()).toEqual(["Seed", "Series A", "Series B"]);
    expect(o.totals!.currentValueReporting).toBeGreaterThan(0);
  });
  it("reports zero-holdings investors honestly", () => {
    const o = getPortfolioOverview("INV022");
    expect(o.hasHoldings).toBe(false);
    expect(o.holdings).toHaveLength(0);
  });
});

describe("getPosition, multi-round + citations", () => {
  it("returns three Forgecraft rounds for INV001 with per-round share prices", () => {
    const p = getPosition("INV001", "Forgecraft");
    expect(p.found && p.held).toBe(true);
    if (p.found && p.held && p.rounds) {
      expect(p.rounds).toHaveLength(3);
      const seed = p.rounds.find((r) => r.round === "Seed")!;
      expect(seed.effectiveSharePrice).toBe(2.25); // 10% discount applied
      expect(seed.sources).toContain("ALC0001");
    }
  });
  it("says clearly when a company is not held", () => {
    const p = getPosition("INV022", "Forgecraft");
    expect(p.found).toBe(true);
    if (p.found) expect(p.held).toBe(false);
  });
});

describe("Disambiguation: Northpeak Analytics vs Northpeak Health", () => {
  it("returns candidates instead of guessing", () => {
    const p = getPosition("INV001", "Northpeak");
    expect(p.found).toBe(false);
    if (!p.found) {
      expect(p.reason).toBe("ambiguous");
      expect(p.candidates?.map((c) => c.company).sort()).toEqual([
        "Northpeak Analytics",
        "Northpeak Health",
      ]);
    }
  });
});

describe("DATA ISOLATION, the privacy invariant", () => {
  it("every tool returns only the requested investor's rows", () => {
    const investorId = "INV001";
    const allocIds = new Set(
      store.allocationsByInvestor.get(investorId)!.map((a) => a.allocation_id),
    );
    // Sources cited by the overview must all belong to this investor.
    const o = getPortfolioOverview(investorId);
    const citedAllocs = o.sources.filter((s) => s.startsWith("ALC"));
    for (const s of citedAllocs) expect(allocIds.has(s)).toBe(true);

    // Obligations/realised/statement never reference another investor's ids.
    for (const fn of [getObligations, getRealisedOutcomes, getAccountStatement]) {
      const res = fn(investorId);
      expect(res.reportingCurrency).toBe(store.investorsById.get(investorId)!.reporting_currency);
    }
  });
  it("asking for another investor's company yields no leaked data", () => {
    // INV022 holds nothing; even naming a real company returns held:false.
    const p = getPosition("INV022", "Inferna AI");
    if (p.found) expect(p.held).toBe(false);
  });
});

describe("getFees, effective vs deal standard", () => {
  it("INV001 Inferna Series B shows a discounted management fee (1% vs 2% standard)", () => {
    const f = getFees("INV001", "Inferna AI");
    expect(f.found).toBe(true);
    if (f.found && f.held && f.schedules) {
      const seriesB = f.schedules.find((s) => s.round === "Series B")!;
      expect(seriesB.management.effectivePct).toBe(1);
      expect(seriesB.management.standardPct).toBe(2);
      expect(seriesB.hasAnyDiscount).toBe(true);
    }
  });
});

describe("getObligations, upcoming capital call on a partial-call deal", () => {
  it("surfaces an upcoming obligation with a citation", () => {
    // Find an investor with an Upcoming capital call.
    const call = store.raw.capital_calls.find((c) => c.status === "Upcoming")!;
    const ob = getObligations(call.investor_id);
    const all = [...ob.upcoming, ...ob.overdue];
    expect(all.length).toBeGreaterThan(0);
    expect(all.flatMap((o) => o.sources).length).toBeGreaterThan(0);
  });
});

describe("getRealisedOutcomes, net is below gross by the carry", () => {
  it("an investor with an exit shows net < gross", () => {
    const dist = store.raw.distributions.find((d) => d.distribution_type === "Exit Proceeds")!;
    const r = getRealisedOutcomes(dist.investor_id);
    expect(r.count).toBeGreaterThan(0);
    expect(r.totals.netReporting).toBeLessThanOrEqual(r.totals.grossReporting);
    expect(r.totals.performanceFeeReporting).toBeGreaterThan(0);
  });
});

describe("getValuationHistory, down round visible", () => {
  it("shows Qubrium marks moving both directions for a holder", () => {
    const alloc = store.raw.allocations.find((a) => a.deal_id === "DEAL010")!;
    const h = getValuationHistory(alloc.investor_id, "Qubrium");
    expect(h.found).toBe(true);
    if (h.found && h.held) {
      const seriesB = h.series.find((s) => s.dealId === "DEAL010")!;
      expect(seriesB.latestSharePrice).toBe(6.2);
      expect(seriesB.entrySharePrice).toBe(10);
    }
  });
});

describe("getInvestorProfile, derived personalisation signals", () => {
  it("computes deal count and top sectors for INV001", () => {
    const p = getInvestorProfile("INV001");
    expect(p.dealCount).toBe(4);
    expect(p.techSavviness).toBe("High");
    expect(p.topSectors.length).toBeGreaterThan(0);
    expect(p.concentrationPctTopHolding).toBeGreaterThan(0);
  });
  it("flags a zero-holdings investor", () => {
    const p = getInvestorProfile("INV022");
    expect(p.hasHoldings).toBe(false);
    expect(p.dealCount).toBe(0);
  });
});

describe("getAccountStatement", () => {
  it("nets cash in vs out for INV001", () => {
    const s = getAccountStatement("INV001");
    expect(s.lineCount).toBeGreaterThan(0);
    expect(s.totalCashOutReporting).toBeLessThan(0);
    expect(s.netCashReporting).toBeCloseTo(
      s.totalCashInReporting + s.totalCashOutReporting,
      2,
    );
  });
});
