/**
 * Build step: parse the provided CSVs in /data into a single typed JSON bundle
 * (src/lib/data/dataset.generated.json) that is imported by the data store.
 *
 * Bundling as JSON guarantees the data ships with the serverless functions on
 * Vercel (no runtime filesystem reads). Run via `npm run build:data`.
 */
import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const OUT = join(process.cwd(), "src", "lib", "data", "dataset.generated.json");

function rows(file: string): Record<string, string>[] {
  const csv = readFileSync(join(DATA_DIR, file), "utf8");
  return parse(csv, { columns: true, skip_empty_lines: true, trim: true });
}

// Parse a numeric cell; empty string -> null.
const num = (v: string): number | null =>
  v === "" || v === undefined ? null : Number(v);
// Numeric cell that must exist (defaults to 0 if blank, used for amounts).
const numReq = (v: string): number => Number(v || 0);

const dataset = {
  investors: rows("investors.csv").map((r) => ({
    investor_id: r.investor_id,
    investor_name: r.investor_name,
    investor_type: r.investor_type,
    country: r.country,
    reporting_currency: r.reporting_currency,
    age: num(r.age),
    tech_savviness: r.tech_savviness,
    kyc_status: r.kyc_status,
    onboarded_date: r.onboarded_date,
    email: r.email,
  })),
  companies: rows("portfolio_companies.csv").map((r) => ({
    company_id: r.company_id,
    company_name: r.company_name,
    sector: r.sector,
    hq_country: r.hq_country,
    status: r.status,
    website: r.website,
  })),
  deals: rows("deals.csv").map((r) => ({
    deal_id: r.deal_id,
    company_id: r.company_id,
    company_name: r.company_name,
    round: r.round,
    instrument: r.instrument,
    spv_name: r.spv_name,
    deal_currency: r.deal_currency,
    deal_date: r.deal_date,
    pre_money_valuation_m: numReq(r.pre_money_valuation_m),
    post_money_valuation_m: numReq(r.post_money_valuation_m),
    round_size_m: numReq(r.round_size_m),
    equitie_allocation_m: numReq(r.equitie_allocation_m),
    entry_share_price: numReq(r.entry_share_price),
    contributed_pct: numReq(r.contributed_pct),
    std_mgmt_fee_pct: numReq(r.std_mgmt_fee_pct),
    std_performance_fee_pct: numReq(r.std_performance_fee_pct),
    std_structuring_fee_pct: numReq(r.std_structuring_fee_pct),
    std_admin_fee_usd: numReq(r.std_admin_fee_usd),
    status: r.status,
  })),
  valuations: rows("valuations.csv").map((r) => ({
    valuation_id: r.valuation_id,
    deal_id: r.deal_id,
    valuation_date: r.valuation_date,
    share_price: numReq(r.share_price),
    company_valuation_m: numReq(r.company_valuation_m),
    mark_source: r.mark_source,
    multiple_vs_entry: numReq(r.multiple_vs_entry),
  })),
  allocations: rows("allocations.csv").map((r) => ({
    allocation_id: r.allocation_id,
    deal_id: r.deal_id,
    investor_id: r.investor_id,
    deal_currency: r.deal_currency,
    commitment_amount: numReq(r.commitment_amount),
    price_discount_pct: numReq(r.price_discount_pct),
    effective_share_price: numReq(r.effective_share_price),
    units: numReq(r.units),
    contributed_amount: numReq(r.contributed_amount),
    outstanding_commitment: numReq(r.outstanding_commitment),
    mgmt_fee_pct: numReq(r.mgmt_fee_pct),
    performance_fee_pct: numReq(r.performance_fee_pct),
    structuring_fee_pct: numReq(r.structuring_fee_pct),
    admin_fee_usd: numReq(r.admin_fee_usd),
    fee_discount: r.fee_discount,
    allocation_status: r.allocation_status,
    allocation_date: r.allocation_date,
  })),
  capital_calls: rows("capital_calls.csv").map((r) => ({
    call_id: r.call_id,
    allocation_id: r.allocation_id,
    investor_id: r.investor_id,
    deal_id: r.deal_id,
    call_number: numReq(r.call_number),
    call_date: r.call_date,
    amount: numReq(r.amount),
    currency: r.currency,
    due_date: r.due_date,
    status: r.status,
  })),
  fees: rows("fees.csv").map((r) => ({
    fee_id: r.fee_id,
    allocation_id: r.allocation_id,
    investor_id: r.investor_id,
    deal_id: r.deal_id,
    fee_type: r.fee_type,
    period: r.period,
    fee_rate_pct: num(r.fee_rate_pct),
    basis: r.basis,
    amount: numReq(r.amount),
    currency: r.currency,
    due_date: r.due_date,
    status: r.status,
  })),
  distributions: rows("distributions.csv").map((r) => ({
    distribution_id: r.distribution_id,
    deal_id: r.deal_id,
    allocation_id: r.allocation_id,
    investor_id: r.investor_id,
    distribution_date: r.distribution_date,
    distribution_type: r.distribution_type,
    gross_amount: numReq(r.gross_amount),
    performance_fee_pct: numReq(r.performance_fee_pct),
    performance_fee_amount: numReq(r.performance_fee_amount),
    net_amount: numReq(r.net_amount),
    currency: r.currency,
    fraction_of_units: numReq(r.fraction_of_units),
  })),
  statement_lines: rows("statement_lines.csv").map((r) => ({
    line_id: r.line_id,
    investor_id: r.investor_id,
    date: r.date,
    type: r.type,
    deal_id: r.deal_id,
    amount: numReq(r.amount),
    currency: r.currency,
    reference_id: r.reference_id,
  })),
  fx_rates: rows("fx_rates.csv").map((r) => ({
    currency: r.currency,
    to_usd: numReq(r.to_usd),
    as_of: r.as_of,
  })),
};

writeFileSync(OUT, JSON.stringify(dataset, null, 2));

const counts = Object.fromEntries(
  Object.entries(dataset).map(([k, v]) => [k, (v as unknown[]).length]),
);
console.log("✓ dataset.generated.json written:", counts);
