import { runChat, type ChatTurn } from "@/lib/openai/chat";
import { getInvestor } from "@/lib/data/store";

export const runtime = "nodejs";

interface ChatRequestBody {
  investorId?: string;
  messages?: ChatTurn[];
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { investorId, messages } = body;

  // The investorId is the "authenticated" session user. Validate it server-side;
  // the model only ever sees data for this id.
  if (!investorId || !getInvestor(investorId)) {
    return Response.json({ error: "Unknown or missing investorId" }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const history: ChatTurn[] = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const result = await runChat(investorId, history);
    return Response.json(result);
  } catch (err) {
    console.error("chat error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: "The assistant failed to respond.", detail: message },
      { status: 500 },
    );
  }
}
