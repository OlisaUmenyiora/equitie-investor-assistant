import { getInvestor } from "@/lib/data/store";
import { getInvestorProfile } from "@/lib/tools";
import { buildSystemPrompt } from "@/lib/openai/chat";
import { realtimeTools } from "@/lib/openai/realtime-tools";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2";
const VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";

// Mint a short-lived ephemeral client secret for the browser to open a WebRTC
// Realtime session. The real OPENAI_API_KEY never leaves the server. Personalised
// instructions and the deterministic tools are baked into the session here.
export async function POST(request: Request) {
  let investorId: string | undefined;
  try {
    ({ investorId } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!investorId || !getInvestor(investorId)) {
    return Response.json({ error: "Unknown or missing investorId" }, { status: 400 });
  }

  const profile = getInvestorProfile(investorId);
  const instructions =
    buildSystemPrompt(profile) +
    "\n\nVOICE MODE: You are speaking out loud. Be conversational and concise. Do NOT read source row ids aloud (they appear on screen). Lead with the answer. Never spell out long lists of numbers unless asked; summarise naturally.";

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: MODEL,
        instructions,
        tools: realtimeTools,
        tool_choice: "auto",
        audio: {
          input: {
            transcription: { model: "gpt-4o-mini-transcribe" },
            turn_detection: { type: "server_vad" },
          },
          output: { voice: VOICE },
        },
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("realtime session error", JSON.stringify(data));
    return Response.json(
      { error: "Failed to create realtime session", detail: data?.error?.message ?? data },
      { status: 500 },
    );
  }

  // The ephemeral secret is in `value` (with `expires_at`).
  return Response.json({ value: data.value, expires_at: data.expires_at, model: MODEL });
}
