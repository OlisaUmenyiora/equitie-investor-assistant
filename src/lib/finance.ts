// Per-allocation financial computations — the single source of truth for every
// number the assistant reports. Pure functions over the store; deterministic.
//
// Formulas (from the dataset guide):
//   current value (per alloc) = units × latest share_price × (1 − realised fraction),
//                               FX-converted; 0 if the deal is Exited / Written Off.
//   MOIC = (current value + distributions net of carry) ÷ contributed.
//   DPI  = distributions net ÷ contributed;  RVPI = current value ÷ contributed.
//
// Every returned figure also lists the source row ids it was derived from, so the
// assistant can cite them.
import type { Allocation, Currency, Deal, Distribution } from "./data/types";
import { store } from "./data/store";
import { convert } from "./fx";

export interface AllocationView {
  allocation: Allocation;
  deal: Deal;
  companyId: string;
  companyName: string;
  round: string;
  dealCurrency: Currency;
  status: Deal["status"];

  effectiveSharePrice: number;
  units: number;
  latestSharePrice: number | null;
  latestValuationDate: string | null;

  realisedFraction: number; // 0..1, summed across this allocation's distributions

  // All monetary fields are reported in BOTH deal currency and the investor's
  // reporting currency so the assistant can cite the native figure and the rolled-up one.
  committed: Money;
  contributed: Money;
  outstanding: Money;
  currentValue: Money;
  distributionsGross: Money;
  distributionsNet: Money;
  performanceFeeWithheld: Money;

  moic: number | null; // null when nothing has been contributed yet
  dpi: number | null;
  rvpi: number | null;

  sources: string[]; // row ids used (allocation, valuation, distributions)
}

export interface Money {
  dealCurrency: Currency;
  amountDealCcy: number;
  reportingCurrency: Currency;
  amountReporting: number;
}

function money(
  amountDealCcy: number,
  dealCcy: Currency,
  reportingCcy: Currency,
): Money {
  return {
    dealCurrency: dealCcy,
    amountDealCcy,
    reportingCurrency: reportingCcy,
    amountReporting: convert(amountDealCcy, dealCcy, reportingCcy),
  };
}

export function buildAllocationView(
  allocation: Allocation,
  reportingCurrency: Currency,
): AllocationView {
  const deal = store.dealsById.get(allocation.deal_id)!;
  const dealCcy = allocation.deal_currency;
  const latest = store.latestValuationByDeal.get(deal.deal_id) ?? null;
  const dists: Distribution[] =
    store.distributionsByAllocation.get(allocation.allocation_id) ?? [];

  const realisedFraction = clamp01(
    dists.reduce((s, d) => s + d.fraction_of_units, 0),
  );
  const isClosed = deal.status === "Exited" || deal.status === "Written Off";
  // Pending = signed but unfunded: a commitment, not a deployed holding -> no live value.
  const isPending = allocation.allocation_status === "Pending";

  // Current value of the still-held portion, in deal currency.
  const currentValueDealCcy =
    isClosed || isPending
      ? 0
      : allocation.units * (latest?.share_price ?? 0) * (1 - realisedFraction);

  const distGross = sum(dists.map((d) => d.gross_amount));
  const distNet = sum(dists.map((d) => d.net_amount));
  const perfFee = sum(dists.map((d) => d.performance_fee_amount));

  const contributed = allocation.contributed_amount;
  const currentValueReporting = convert(currentValueDealCcy, dealCcy, reportingCurrency);
  const distNetReporting = convert(distNet, dealCcy, reportingCurrency);
  const contributedReporting = convert(contributed, dealCcy, reportingCurrency);

  const moic =
    contributed > 0
      ? (currentValueReporting + distNetReporting) / contributedReporting
      : null;
  const dpi = contributed > 0 ? distNetReporting / contributedReporting : null;
  const rvpi = contributed > 0 ? currentValueReporting / contributedReporting : null;

  const sources = [
    allocation.allocation_id,
    ...(latest ? [latest.valuation_id] : []),
    ...dists.map((d) => d.distribution_id),
  ];

  return {
    allocation,
    deal,
    companyId: deal.company_id,
    companyName: deal.company_name,
    round: deal.round,
    dealCurrency: dealCcy,
    status: deal.status,
    effectiveSharePrice: allocation.effective_share_price,
    units: allocation.units,
    latestSharePrice: latest?.share_price ?? null,
    latestValuationDate: latest?.valuation_date ?? null,
    realisedFraction,
    committed: money(allocation.commitment_amount, dealCcy, reportingCurrency),
    contributed: money(contributed, dealCcy, reportingCurrency),
    outstanding: money(allocation.outstanding_commitment, dealCcy, reportingCurrency),
    currentValue: money(currentValueDealCcy, dealCcy, reportingCurrency),
    distributionsGross: money(distGross, dealCcy, reportingCurrency),
    distributionsNet: money(distNet, dealCcy, reportingCurrency),
    performanceFeeWithheld: money(perfFee, dealCcy, reportingCurrency),
    moic,
    dpi,
    rvpi,
    sources,
  };
}

export function viewsFor(
  investorId: string,
  reportingCurrency: Currency,
): AllocationView[] {
  const allocs = store.allocationsByInvestor.get(investorId) ?? [];
  return allocs.map((a) => buildAllocationView(a, reportingCurrency));
}

function sum(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
