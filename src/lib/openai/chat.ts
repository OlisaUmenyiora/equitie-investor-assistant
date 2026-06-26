// Chat orchestration. The model decides which tool to call and how to phrase the
// answer; it never computes numbers. We collect the source row ids the tools used so
// the UI can render citations deterministically (independent of what the model writes).
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { toolDefs, runTool } from "./tool-defs";
import { getInvestorProfile } from "../tools";
import { REPORT_DATE } from "../data/types";

const client = new OpenAI();
const MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-5.1";
// GPT-5 reasoning models accept reasoning_effort; "low" keeps the chat snappy since
// tool selection here is straightforward. Omitted for non-reasoning models.
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || "low";
const isReasoningModel = /^(gpt-5|o\d)/.test(MODEL) && !MODEL.includes("-chat");
const MAX_TOOL_ROUNDS = 6;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

type Profile = ReturnType<typeof getInvestorProfile>;

export function buildSystemPrompt(p: Profile): string {
  const sectors = p.topSectors.map((s) => s.sector).join(", ") || "none yet";

  // Personalisation: tone & depth only. Numbers never change.
  let toneGuidance: string;
  const lowTech = p.techSavviness === "Low";
  const older = (p.age ?? 0) >= 60;
  if (lowTech || older) {
    toneGuidance =
      "This investor prefers PLAIN LANGUAGE. Explain any jargon the first time you use it (e.g. 'MOIC — the multiple on your invested capital, i.e. how many times your money has grown'; 'carry — the performance fee the fund keeps on profits'). Keep answers short and reassuring. Avoid dense tables.";
  } else if (p.techSavviness === "High" && p.dealCount >= 5) {
    toneGuidance =
      "This is a sophisticated, multi-deal investor. Be concise and data-dense. Assume fluency with MOIC, carry, DPI/RVPI. Lead with the numbers; skip basic definitions.";
  } else {
    toneGuidance =
      "Use clear, professional language. Define a term briefly only if it is non-obvious. Be efficient but not terse.";
  }

  return `You are the EquiTie Investor Assistant, a private assistant for ONE authenticated investor.

THE INVESTOR
- Name: ${p.name} (${p.investor_id}, ${p.type})
- Reporting currency: ${p.reportingCurrency} — present all monetary figures in this currency unless asked otherwise; you may also note the native deal currency.
- Profile signals: age ${p.age ?? "n/a"}, tech-savviness ${p.techSavviness}, ${p.dealCount} active deals across ${p.companyCount} companies, most-active sectors: ${sectors}, top-holding concentration ${p.concentrationPctTopHolding}%.

PERSONALISATION (tone & depth ONLY — the underlying numbers are identical for everyone)
${toneGuidance}
Where it genuinely helps, reflect this investor's portfolio shape (their sectors or concentration). Never be patronising.

HARD RULES
- Today's date is ${REPORT_DATE}. Treat it as "now" for upcoming/overdue/current.
- You may ONLY discuss ${p.name}'s own portfolio. You have no access to any other investor's data and must never speculate about one.
- EVERY number you state must come from a tool result. NEVER calculate, estimate, or invent figures. If a tool did not return something, say you don't have it.
- After giving figures, cite the source row ids the tools returned, as a final line: "Sources: ID1, ID2, …". These ids (e.g. ALC0001, VAL003, DIST0001) are how the investor's relationship manager can audit the answer.
- If a company name is ambiguous (a tool returns reason "ambiguous"), ask which one they mean — do not guess.
- If the investor holds nothing relevant, say so plainly.
- Do NOT give investment advice or opinions on whether to buy/sell/hold. Report the facts; suggest they speak to their relationship manager for advice.
- Be honest about uncertainty. Never present a guess with false confidence.

Call tools to get data, then answer in the investor's preferred tone.`;
}

const ID_RE = /^(ALC|VAL|DIST|CALL|FEE|LN|DEAL|INV|CO)\d+$/;

function collectSources(value: unknown, acc: Set<string>): void {
  if (value == null) return;
  if (typeof value === "string") {
    if (ID_RE.test(value)) acc.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectSources(v, acc);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value)) collectSources(v, acc);
  }
}

export interface ChatResult {
  reply: string;
  sources: string[];
  toolsUsed: string[];
}

export async function runChat(
  investorId: string,
  history: ChatTurn[],
): Promise<ChatResult> {
  const profile = getInvestorProfile(investorId);
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(profile) },
    ...history.map((h) => ({ role: h.role, content: h.content }) as ChatCompletionMessageParam),
  ];

  const sources = new Set<string>();
  const toolsUsed: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const resp = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: toolDefs,
      tool_choice: "auto",
      ...(isReasoningModel ? { reasoning_effort: REASONING_EFFORT as "low" } : {}),
    });

    const msg = resp.choices[0].message;
    messages.push(msg);

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        let args: { company?: string } = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        const result = runTool(tc.function.name, investorId, args);
        toolsUsed.push(tc.function.name);
        collectSources(result, sources);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      continue; // let the model read tool results and continue
    }

    return {
      reply: msg.content ?? "",
      sources: [...sources],
      toolsUsed,
    };
  }

  return {
    reply:
      "I wasn't able to complete that — could you rephrase or narrow the question?",
    sources: [...sources],
    toolsUsed,
  };
}
