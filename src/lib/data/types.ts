// Typed model for the EquiTie dataset.
// Numbers are parsed at build time; blank cells become null.

export type Currency = "USD" | "GBP" | "EUR" | "AED";
export type CompanyStatus = "Active" | "Exited" | "Written Off";
export type AllocationStatus = "Active" | "Pending";
export type TechSavviness = "Low" | "Medium" | "High";

export interface Investor {
  investor_id: string;
  investor_name: string;
  investor_type: "Individual" | "Entity";
  country: string;
  reporting_currency: Currency;
  age: number | null; // blank for entities
  tech_savviness: TechSavviness;
  kyc_status: "Verified" | "Pending";
  onboarded_date: string;
  email: string;
}

export interface Company {
  company_id: string;
  company_name: string;
  sector: string;
  hq_country: string;
  status: CompanyStatus;
  website: string;
}

export interface Deal {
  deal_id: string;
  company_id: string;
  company_name: string;
  round: string;
  instrument: string;
  spv_name: string;
  deal_currency: Currency;
  deal_date: string;
  pre_money_valuation_m: number;
  post_money_valuation_m: number;
  round_size_m: number;
  equitie_allocation_m: number;
  entry_share_price: number;
  contributed_pct: number;
  std_mgmt_fee_pct: number;
  std_performance_fee_pct: number;
  std_structuring_fee_pct: number;
  std_admin_fee_usd: number;
  status: CompanyStatus;
}

export interface Valuation {
  valuation_id: string;
  deal_id: string;
  valuation_date: string;
  share_price: number;
  company_valuation_m: number;
  mark_source: "Entry" | "Internal" | "Markup Round" | "Exit" | "Write Off";
  multiple_vs_entry: number;
}

export interface Allocation {
  allocation_id: string;
  deal_id: string;
  investor_id: string;
  deal_currency: Currency;
  commitment_amount: number;
  price_discount_pct: number;
  effective_share_price: number;
  units: number;
  contributed_amount: number;
  outstanding_commitment: number;
  mgmt_fee_pct: number;
  performance_fee_pct: number;
  structuring_fee_pct: number;
  admin_fee_usd: number;
  fee_discount: "Yes" | "No";
  allocation_status: AllocationStatus;
  allocation_date: string;
}

export interface CapitalCall {
  call_id: string;
  allocation_id: string;
  investor_id: string;
  deal_id: string;
  call_number: number;
  call_date: string;
  amount: number;
  currency: Currency;
  due_date: string;
  status: "Paid" | "Upcoming";
}

export interface Fee {
  fee_id: string;
  allocation_id: string;
  investor_id: string;
  deal_id: string;
  fee_type: "Management Fee" | "Structuring Fee" | "Admin Fee";
  period: string;
  fee_rate_pct: number | null; // blank for flat admin fee
  basis: "Commitment" | "Flat";
  amount: number;
  currency: Currency;
  due_date: string;
  status: "Paid" | "Upcoming" | "Overdue";
}

export interface Distribution {
  distribution_id: string;
  deal_id: string;
  allocation_id: string;
  investor_id: string;
  distribution_date: string;
  distribution_type: "Exit Proceeds" | "Secondary Sale";
  gross_amount: number;
  performance_fee_pct: number;
  performance_fee_amount: number;
  net_amount: number;
  currency: Currency;
  fraction_of_units: number;
}

export interface StatementLine {
  line_id: string;
  investor_id: string;
  date: string;
  type:
    | "Capital Contribution"
    | "Management Fee"
    | "Structuring Fee"
    | "Admin Fee"
    | "Exit Proceeds"
    | "Secondary Sale";
  deal_id: string;
  amount: number; // signed, in `currency`
  currency: Currency;
  reference_id: string;
}

export interface FxRate {
  currency: Currency;
  to_usd: number;
  as_of: string;
}

export interface Dataset {
  investors: Investor[];
  companies: Company[];
  deals: Deal[];
  valuations: Valuation[];
  allocations: Allocation[];
  capital_calls: CapitalCall[];
  fees: Fee[];
  distributions: Distribution[];
  statement_lines: StatementLine[];
  fx_rates: FxRate[];
}

/** The report date: treat as "today" for upcoming/current figures. */
export const REPORT_DATE = "2026-06-25";
