// The deterministic tool layer the assistant calls. Every function is scoped to a
// single investorId (passed by the server, never by the model) so one investor can
// never see another's data. Each result carries a `sources` array of dataset row ids
// for citation. No function lets the LLM do arithmetic, numbers come from here.
import type { Company, Currency } from "./data/types";
import { store, getInvestor } from "./data/store";
import { convert, round2 } from "./fx";
import { buildAllocationView, viewsFor, type AllocationView, type Money } from "./finance";
import { REPORT_DATE } from "./data/types";

function fmtMoney(m: Money) {
  return {
    dealCurrency: m.dealCurrency,
    amountDealCcy: round2(m.amountDealCcy),
    reportingCurrency: m.reportingCurrency,
    amountReporting: round2(m.amountReporting),
  };
}

function pct(n: number | null): number | null {
  return n === null ? null : round2(n);
}

/** Resolve a free-text company reference to one or more companies (disambiguation). */
function resolveCompanies(query: string): Company[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const byId = store.companiesById.get(query.trim().toUpperCase());
  if (byId) return [byId];
  const exact = store.companiesByNameLc.get(q);
  if (exact) return [exact];
  return store.raw.companies.filter((c) => c.company_name.toLowerCase().includes(q));
}

function requireInvestor(investorId: string) {
  const inv = getInvestor(investorId);
  if (!inv) throw new Error(`Unknown investor ${investorId}`);
  return inv;
}

// ── Personalisation signals ────────────────────────────────────────────────
export function getInvestorProfile(investorId: string) {
  const inv = requireInvestor(investorId);
  const views = viewsFor(investorId, inv.reporting_currency);
  const active = views.filter((v) => v.allocation.allocation_status === "Active");

  const sectorValue = new Map<string, number>();
  for (const v of active) {
    const sector = store.companiesById.get(v.companyId)?.sector ?? "Unknown";
    sectorValue.set(
      sector,
      (sectorValue.get(sector) ?? 0) + v.currentValue.amountReporting,
    );
  }
  const topSectors = [...sectorValue.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sector, value]) => ({ sector, valueReporting: round2(value) }));

  const companies = new Set(active.map((v) => v.companyId));
  const totalValue = active.reduce((s, v) => s + v.currentValue.amountReporting, 0);
  const byCompany = new Map<string, number>();
  for (const v of active)
    byCompany.set(
      v.companyId,
      (byCompany.get(v.companyId) ?? 0) + v.currentValue.amountReporting,
    );
  const largest = Math.max(0, ...byCompany.values());

  return {
    investor_id: inv.investor_id,
    name: inv.investor_name,
    type: inv.investor_type,
    reportingCurrency: inv.reporting_currency,
    age: inv.age,
    techSavviness: inv.tech_savviness,
    kycStatus: inv.kyc_status,
    onboardedDate: inv.onboarded_date,
    // derived signals for personalisation
    dealCount: active.length,
    companyCount: companies.size,
    topSectors,
    concentrationPctTopHolding:
      totalValue > 0 ? round2((largest / totalValue) * 100) : 0,
    hasHoldings: active.length > 0,
    sources: [inv.investor_id],
  };
}

// ── Portfolio overview ─────────────────────────────────────────────────────
export function getPortfolioOverview(investorId: string) {
  const inv = requireInvestor(investorId);
  const ccy = inv.reporting_currency;
  const views = viewsFor(investorId, ccy);

  if (views.length === 0) {
    return {
      reportingCurrency: ccy,
      hasHoldings: false,
      message: "This investor has no allocations yet.",
      holdings: [],
      totals: null,
      sources: [inv.investor_id],
    };
  }

  // Aggregate allocations up to one row per company (across rounds).
  const byCompany = new Map<string, AllocationView[]>();
  for (const v of views) {
    const arr = byCompany.get(v.companyId) ?? [];
    arr.push(v);
    byCompany.set(v.companyId, arr);
  }

  const holdings = [...byCompany.entries()].map(([companyId, vs]) => {
    const currentValue = sum(vs.map((v) => v.currentValue.amountReporting));
    const contributed = sum(vs.map((v) => v.contributed.amountReporting));
    const committed = sum(vs.map((v) => v.committed.amountReporting));
    const distNet = sum(vs.map((v) => v.distributionsNet.amountReporting));
    return {
      company: store.companiesById.get(companyId)?.company_name ?? companyId,
      companyStatus: store.companiesById.get(companyId)?.status,
      sector: store.companiesById.get(companyId)?.sector,
      rounds: vs.map((v) => v.round),
      currentValueReporting: round2(currentValue),
      contributedReporting: round2(contributed),
      committedReporting: round2(committed),
      distributionsNetReporting: round2(distNet),
      moic: contributed > 0 ? round2((currentValue + distNet) / contributed) : null,
      sources: vs.flatMap((v) => v.sources),
    };
  });

  const totalCurrent = sum(views.map((v) => v.currentValue.amountReporting));
  const totalContributed = sum(views.map((v) => v.contributed.amountReporting));
  const totalCommitted = sum(views.map((v) => v.committed.amountReporting));
  const totalOutstanding = sum(views.map((v) => v.outstanding.amountReporting));
  const totalDistNet = sum(views.map((v) => v.distributionsNet.amountReporting));

  return {
    reportingCurrency: ccy,
    hasHoldings: true,
    holdings: holdings.sort((a, b) => b.currentValueReporting - a.currentValueReporting),
    totals: {
      currentValueReporting: round2(totalCurrent),
      contributedReporting: round2(totalContributed),
      committedReporting: round2(totalCommitted),
      outstandingCommitmentReporting: round2(totalOutstanding),
      distributionsNetReporting: round2(totalDistNet),
      blendedMOIC:
        totalContributed > 0
          ? round2((totalCurrent + totalDistNet) / totalContributed)
          : null,
      DPI: totalContributed > 0 ? round2(totalDistNet / totalContributed) : null,
      RVPI: totalContributed > 0 ? round2(totalCurrent / totalContributed) : null,
    },
    sources: views.flatMap((v) => v.sources),
  };
}

// ── A single position (across rounds) ──────────────────────────────────────
export function getPosition(investorId: string, company: string) {
  const inv = requireInvestor(investorId);
  const matches = resolveCompanies(company);

  if (matches.length === 0)
    return { found: false, reason: "no_such_company", query: company };
  if (matches.length > 1)
    return {
      found: false,
      reason: "ambiguous",
      query: company,
      candidates: matches.map((c) => ({
        company: c.company_name,
        sector: c.sector,
        country: c.hq_country,
      })),
    };

  const target = matches[0];
  const views = viewsFor(investorId, inv.reporting_currency).filter(
    (v) => v.companyId === target.company_id,
  );
  if (views.length === 0)
    return {
      found: true,
      held: false,
      company: target.company_name,
      message: `${inv.investor_name} has no position in ${target.company_name}.`,
    };

  const rounds = views.map((v) => ({
    round: v.round,
    dealId: v.deal.deal_id,
    allocationId: v.allocation.allocation_id,
    allocationStatus: v.allocation.allocation_status,
    effectiveSharePrice: v.effectiveSharePrice,
    entrySharePrice: v.deal.entry_share_price,
    priceDiscountPct: v.allocation.price_discount_pct,
    units: v.units,
    latestSharePrice: v.latestSharePrice,
    latestValuationDate: v.latestValuationDate,
    committed: fmtMoney(v.committed),
    contributed: fmtMoney(v.contributed),
    outstanding: fmtMoney(v.outstanding),
    currentValue: fmtMoney(v.currentValue),
    distributionsNet: fmtMoney(v.distributionsNet),
    realisedFractionPct: round2(v.realisedFraction * 100),
    moic: pct(v.moic),
    sources: v.sources,
  }));

  const cv = sum(views.map((v) => v.currentValue.amountReporting));
  const contrib = sum(views.map((v) => v.contributed.amountReporting));
  const distNet = sum(views.map((v) => v.distributionsNet.amountReporting));

  return {
    found: true,
    held: true,
    company: target.company_name,
    companyStatus: target.status,
    sector: target.sector,
    reportingCurrency: inv.reporting_currency,
    rounds,
    aggregate: {
      currentValueReporting: round2(cv),
      contributedReporting: round2(contrib),
      distributionsNetReporting: round2(distNet),
      moic: contrib > 0 ? round2((cv + distNet) / contrib) : null,
    },
    sources: views.flatMap((v) => v.sources),
  };
}

// ── Obligations: upcoming capital calls + upcoming/overdue fees ─────────────
export function getObligations(investorId: string) {
  const inv = requireInvestor(investorId);
  const ccy = inv.reporting_currency;

  const calls = (store.capitalCallsByInvestor.get(investorId) ?? [])
    .filter((c) => c.status === "Upcoming")
    .map((c) => ({
      kind: "Capital Call" as const,
      company: store.dealsById.get(c.deal_id)?.company_name ?? c.deal_id,
      round: store.dealsById.get(c.deal_id)?.round,
      callNumber: c.call_number,
      dueDate: c.due_date,
      status: c.status,
      amount: fmtMoney({
        dealCurrency: c.currency,
        amountDealCcy: c.amount,
        reportingCurrency: ccy,
        amountReporting: convert(c.amount, c.currency, ccy),
      }),
      sources: [c.call_id],
    }));

  const fees = (store.feesByInvestor.get(investorId) ?? [])
    .filter((f) => f.status === "Upcoming" || f.status === "Overdue")
    .map((f) => ({
      kind: f.fee_type,
      company: store.dealsById.get(f.deal_id)?.company_name ?? f.deal_id,
      round: store.dealsById.get(f.deal_id)?.round,
      dueDate: f.due_date,
      status: f.status,
      amount: fmtMoney({
        dealCurrency: f.currency,
        amountDealCcy: f.amount,
        reportingCurrency: ccy,
        amountReporting: convert(f.amount, f.currency, ccy),
      }),
      sources: [f.fee_id],
    }));

  const overdue = fees.filter((f) => f.status === "Overdue");
  const upcoming = [...calls, ...fees.filter((f) => f.status !== "Overdue")];

  return {
    reportingCurrency: ccy,
    reportDate: REPORT_DATE,
    overdue,
    upcoming,
    totalUpcomingReporting: round2(
      sum(upcoming.map((o) => o.amount.amountReporting)),
    ),
    totalOverdueReporting: round2(sum(overdue.map((o) => o.amount.amountReporting))),
    sources: [...calls, ...fees].flatMap((o) => o.sources),
  };
}

// ── Realised outcomes: distributions and exits, net of carry ───────────────
export function getRealisedOutcomes(investorId: string) {
  const inv = requireInvestor(investorId);
  const ccy = inv.reporting_currency;
  const dists = store.distributionsByInvestor.get(investorId) ?? [];

  const items = dists.map((d) => ({
    company: store.dealsById.get(d.deal_id)?.company_name ?? d.deal_id,
    type: d.distribution_type,
    date: d.distribution_date,
    fractionOfUnitsPct: round2(d.fraction_of_units * 100),
    gross: fmtMoney(m(d.gross_amount, d.currency, ccy)),
    performanceFeePct: d.performance_fee_pct,
    performanceFeeWithheld: fmtMoney(m(d.performance_fee_amount, d.currency, ccy)),
    net: fmtMoney(m(d.net_amount, d.currency, ccy)),
    sources: [d.distribution_id],
  }));

  return {
    reportingCurrency: ccy,
    count: items.length,
    items,
    totals: {
      grossReporting: round2(
        sum(dists.map((d) => convert(d.gross_amount, d.currency, ccy))),
      ),
      performanceFeeReporting: round2(
        sum(dists.map((d) => convert(d.performance_fee_amount, d.currency, ccy))),
      ),
      netReporting: round2(
        sum(dists.map((d) => convert(d.net_amount, d.currency, ccy))),
      ),
    },
    sources: dists.map((d) => d.distribution_id),
  };
}

// ── Fees: effective schedule vs the deal standard ──────────────────────────
export function getFees(investorId: string, company?: string) {
  const inv = requireInvestor(investorId);
  const ccy = inv.reporting_currency;
  let views = viewsFor(investorId, ccy);

  if (company) {
    const matches = resolveCompanies(company);
    if (matches.length === 0)
      return { found: false, reason: "no_such_company", query: company };
    if (matches.length > 1)
      return {
        found: false,
        reason: "ambiguous",
        query: company,
        candidates: matches.map((c) => ({ company: c.company_name, sector: c.sector })),
      };
    views = views.filter((v) => v.companyId === matches[0].company_id);
    if (views.length === 0)
      return { found: true, held: false, company: matches[0].company_name };
  }

  const schedules = views.map((v) => {
    const a = v.allocation;
    const d = v.deal;
    const charged = store.feesByInvestor
      .get(investorId)!
      .filter((f) => f.allocation_id === a.allocation_id)
      .map((f) => ({
        type: f.fee_type,
        period: f.period,
        ratePct: f.fee_rate_pct,
        amount: fmtMoney(m(f.amount, f.currency, ccy)),
        status: f.status,
        sources: [f.fee_id],
      }));
    return {
      company: v.companyName,
      round: v.round,
      dealId: d.deal_id,
      allocationId: a.allocation_id,
      hasAnyDiscount: a.fee_discount === "Yes",
      management: { effectivePct: a.mgmt_fee_pct, standardPct: d.std_mgmt_fee_pct },
      performanceCarry: {
        effectivePct: a.performance_fee_pct,
        standardPct: d.std_performance_fee_pct,
      },
      structuring: {
        effectivePct: a.structuring_fee_pct,
        standardPct: d.std_structuring_fee_pct,
      },
      adminFeeUsd: { effective: a.admin_fee_usd, standard: d.std_admin_fee_usd },
      chargedFees: charged,
      sources: [a.allocation_id],
    };
  });

  return { found: true, held: true, reportingCurrency: ccy, schedules };
}

// ── Valuation history + MOIC impact ────────────────────────────────────────
export function getValuationHistory(investorId: string, company: string) {
  const inv = requireInvestor(investorId);
  const matches = resolveCompanies(company);
  if (matches.length === 0)
    return { found: false, reason: "no_such_company", query: company };
  if (matches.length > 1)
    return {
      found: false,
      reason: "ambiguous",
      query: company,
      candidates: matches.map((c) => ({ company: c.company_name, sector: c.sector })),
    };

  const target = matches[0];
  const deals = store.dealsByCompany.get(target.company_id) ?? [];
  const myViews = viewsFor(investorId, inv.reporting_currency).filter(
    (v) => v.companyId === target.company_id,
  );
  const myDealIds = new Set(myViews.map((v) => v.deal.deal_id));

  const series = deals
    .filter((d) => myDealIds.has(d.deal_id))
    .map((d) => {
      const marks = (store.valuationsByDeal.get(d.deal_id) ?? [])
        .slice()
        .sort((a, b) => a.valuation_date.localeCompare(b.valuation_date))
        .map((vrow) => ({
          date: vrow.valuation_date,
          sharePrice: vrow.share_price,
          markSource: vrow.mark_source,
          multipleVsEntry: vrow.multiple_vs_entry,
          source: vrow.valuation_id,
        }));
      const view = myViews.find((v) => v.deal.deal_id === d.deal_id)!;
      return {
        round: d.round,
        dealId: d.deal_id,
        entrySharePrice: d.entry_share_price,
        yourEffectiveSharePrice: view.effectiveSharePrice,
        latestSharePrice: view.latestSharePrice,
        yourMoic: pct(view.moic),
        marks,
        sources: [view.allocation.allocation_id, ...marks.map((mk) => mk.source)],
      };
    });

  return {
    found: true,
    held: series.length > 0,
    company: target.company_name,
    reportingCurrency: inv.reporting_currency,
    series,
    sources: series.flatMap((s) => s.sources),
  };
}

// ── Account statement ──────────────────────────────────────────────────────
export function getAccountStatement(investorId: string) {
  const inv = requireInvestor(investorId);
  const ccy = inv.reporting_currency;
  const lines = (store.statementLinesByInvestor.get(investorId) ?? [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const byType = new Map<string, number>();
  for (const l of lines) {
    byType.set(l.type, (byType.get(l.type) ?? 0) + convert(l.amount, l.currency, ccy));
  }

  const cashOut = sum(
    lines.filter((l) => l.amount < 0).map((l) => convert(l.amount, l.currency, ccy)),
  );
  const cashIn = sum(
    lines.filter((l) => l.amount > 0).map((l) => convert(l.amount, l.currency, ccy)),
  );

  return {
    reportingCurrency: ccy,
    lineCount: lines.length,
    summaryByType: [...byType.entries()].map(([type, amt]) => ({
      type,
      netReporting: round2(amt),
    })),
    totalCashOutReporting: round2(cashOut), // contributions + fees (negative)
    totalCashInReporting: round2(cashIn), // distributions (positive)
    netCashReporting: round2(cashIn + cashOut),
    recentLines: lines.slice(-15).map((l) => ({
      date: l.date,
      type: l.type,
      company: store.dealsById.get(l.deal_id)?.company_name ?? l.deal_id,
      amount: fmtMoney(m(l.amount, l.currency, ccy)),
      source: l.line_id,
    })),
    sources: lines.map((l) => l.line_id),
  };
}

// helpers
function sum(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}
function m(amountDealCcy: number, from: Currency, to: Currency): Money {
  return {
    dealCurrency: from,
    amountDealCcy,
    reportingCurrency: to,
    amountReporting: convert(amountDealCcy, from, to),
  };
}
