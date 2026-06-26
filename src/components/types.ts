export interface DirectoryInvestor {
  investor_id: string;
  name: string;
  reportingCurrency: string;
  techSavviness: "Low" | "Medium" | "High";
  age: number | null;
  dealCount: number;
  hasHoldings: boolean;
}

export interface InvestorProfile {
  investor_id: string;
  name: string;
  type: string;
  reportingCurrency: string;
  age: number | null;
  techSavviness: "Low" | "Medium" | "High";
  kycStatus: string;
  onboardedDate: string;
  dealCount: number;
  companyCount: number;
  topSectors: { sector: string; valueReporting: number }[];
  concentrationPctTopHolding: number;
  hasHoldings: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  toolsUsed?: string[];
  pending?: boolean;
  error?: boolean;
}
