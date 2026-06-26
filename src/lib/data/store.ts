// In-memory typed store over the bundled dataset, with the indexes the tools need.
// The JSON is generated at build time by scripts/build-data.ts.
import raw from "./dataset.generated.json";
import type {
  Allocation,
  CapitalCall,
  Company,
  Currency,
  Dataset,
  Deal,
  Distribution,
  Fee,
  FxRate,
  Investor,
  StatementLine,
  Valuation,
} from "./types";

const data = raw as unknown as Dataset;

function groupBy<T, K extends string>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  }
  return m;
}

function indexBy<T, K extends string>(rows: T[], key: (r: T) => K): Map<K, T> {
  const m = new Map<K, T>();
  for (const r of rows) m.set(key(r), r);
  return m;
}

// Latest valuation per deal = the row with the max valuation_date (ISO dates sort lexically).
function latestValuations(rows: Valuation[]): Map<string, Valuation> {
  const m = new Map<string, Valuation>();
  for (const v of rows) {
    const cur = m.get(v.deal_id);
    if (!cur || v.valuation_date > cur.valuation_date) m.set(v.deal_id, v);
  }
  return m;
}

export const store = {
  raw: data,

  investorsById: indexBy<Investor, string>(data.investors, (r) => r.investor_id),
  companiesById: indexBy<Company, string>(data.companies, (r) => r.company_id),
  companiesByNameLc: indexBy<Company, string>(
    data.companies,
    (r) => r.company_name.toLowerCase(),
  ),
  dealsById: indexBy<Deal, string>(data.deals, (r) => r.deal_id),
  dealsByCompany: groupBy<Deal, string>(data.deals, (r) => r.company_id),

  allocationsByInvestor: groupBy<Allocation, string>(
    data.allocations,
    (r) => r.investor_id,
  ),
  capitalCallsByInvestor: groupBy<CapitalCall, string>(
    data.capital_calls,
    (r) => r.investor_id,
  ),
  feesByInvestor: groupBy<Fee, string>(data.fees, (r) => r.investor_id),
  distributionsByInvestor: groupBy<Distribution, string>(
    data.distributions,
    (r) => r.investor_id,
  ),
  distributionsByAllocation: groupBy<Distribution, string>(
    data.distributions,
    (r) => r.allocation_id,
  ),
  statementLinesByInvestor: groupBy<StatementLine, string>(
    data.statement_lines,
    (r) => r.investor_id,
  ),

  latestValuationByDeal: latestValuations(data.valuations),
  valuationsByDeal: groupBy<Valuation, string>(data.valuations, (r) => r.deal_id),

  fxByCurrency: indexBy<FxRate, string>(data.fx_rates, (r) => r.currency),
};

export function getInvestor(investorId: string): Investor | undefined {
  return store.investorsById.get(investorId);
}

export function allocationsFor(investorId: string): Allocation[] {
  return store.allocationsByInvestor.get(investorId) ?? [];
}

export function fxToUsd(currency: Currency): number {
  const r = store.fxByCurrency.get(currency);
  if (!r) throw new Error(`Unknown currency: ${currency}`);
  return r.to_usd;
}
