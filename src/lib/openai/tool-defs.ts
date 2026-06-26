// OpenAI function (tool) definitions + a server-side dispatcher.
//
// CRITICAL: the model supplies only the *arguments* (e.g. a company name). The
// investorId is injected by the server from the authenticated session, it is NOT a
// tool parameter, so the model can never request another investor's data.
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  getAccountStatement,
  getFees,
  getInvestorProfile,
  getObligations,
  getPortfolioOverview,
  getPosition,
  getRealisedOutcomes,
  getValuationHistory,
} from "../tools";

export const toolDefs: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "getPortfolioOverview",
      description:
        "The investor's whole portfolio: every holding (folded across rounds), current value, total committed vs contributed, distributions, and blended MOIC/DPI/RVPI in their reporting currency. Use for 'how is my portfolio doing', 'what do I hold', totals.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getPosition",
      description:
        "A single company position, aggregated across all rounds the investor holds, with per-round share price paid, cost basis, units, current value and MOIC. Use for questions about one company.",
      parameters: {
        type: "object",
        properties: {
          company: {
            type: "string",
            description: "Company name (or part of it) or company_id, e.g. 'Forgecraft' or 'CO001'.",
          },
        },
        required: ["company"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getObligations",
      description:
        "Upcoming capital calls and upcoming/overdue management & admin fees, with due dates and amounts. Use for 'what do I owe', 'upcoming capital calls', 'overdue fees'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getRealisedOutcomes",
      description:
        "Realised distributions: exits and secondary sales, gross, the carry (performance fee) withheld, and net received. Use for 'what have I made', 'exits', 'distributions'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getFees",
      description:
        "Fee schedule the investor actually pays: their effective management, performance (carry), structuring and admin rates compared to each deal's standard, showing any negotiated discount. Optionally filter to one company.",
      parameters: {
        type: "object",
        properties: {
          company: {
            type: "string",
            description: "Optional company name/id to filter to one deal.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getValuationHistory",
      description:
        "How a company's share-price marks have moved over time (up and down), per round the investor holds, and the investor's current MOIC. Use for 'how has X's valuation moved', down rounds, mark history.",
      parameters: {
        type: "object",
        properties: {
          company: { type: "string", description: "Company name or id." },
        },
        required: ["company"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getAccountStatement",
      description:
        "Plain-language account statement: capital contributions and fees paid (cash out) versus distributions received (cash in), netted in the reporting currency, with recent lines. Use for 'my statement', 'account summary'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getInvestorProfile",
      description:
        "The investor's profile and derived signals (reporting currency, deal count, top sectors, concentration). Rarely needed directly; profile is already provided in context.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

type ToolArgs = { company?: string };

/** Execute a tool by name, binding investorId server-side. */
export function runTool(name: string, investorId: string, args: ToolArgs): unknown {
  switch (name) {
    case "getPortfolioOverview":
      return getPortfolioOverview(investorId);
    case "getPosition":
      return getPosition(investorId, args.company ?? "");
    case "getObligations":
      return getObligations(investorId);
    case "getRealisedOutcomes":
      return getRealisedOutcomes(investorId);
    case "getFees":
      return getFees(investorId, args.company);
    case "getValuationHistory":
      return getValuationHistory(investorId, args.company ?? "");
    case "getAccountStatement":
      return getAccountStatement(investorId);
    case "getInvestorProfile":
      return getInvestorProfile(investorId);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
