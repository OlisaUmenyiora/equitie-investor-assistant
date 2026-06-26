import { getInvestor } from "@/lib/data/store";
import { runTool } from "@/lib/openai/tool-defs";

export const runtime = "nodejs";

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

// Executes a tool the Realtime model asked for, scoped to the session investor.
// Same runTool + data as the text chat, so spoken numbers are identical and grounded.
export async function POST(request: Request) {
  let body: { investorId?: string; name?: string; arguments?: { company?: string } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { investorId, name, arguments: args } = body;
  if (!investorId || !getInvestor(investorId)) {
    return Response.json({ error: "Unknown or missing investorId" }, { status: 400 });
  }
  if (!name) {
    return Response.json({ error: "tool name required" }, { status: 400 });
  }

  const result = runTool(name, investorId, args ?? {});
  const sources = new Set<string>();
  collectSources(result, sources);

  return Response.json({ result, sources: [...sources] });
}
