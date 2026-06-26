export const runtime = "nodejs";

// Lightweight feedback sink. For the prototype this logs to the server console; in
// production it would write to an analytics store keyed by investor + answer, giving
// the team a signal on answer quality (the "good/bad response" thumbs).
interface FeedbackBody {
  investorId?: string;
  question?: string;
  answer?: string;
  rating?: "up" | "down" | null;
}

export async function POST(request: Request) {
  let body: FeedbackBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { investorId, rating } = body;
  if (!investorId || (rating !== "up" && rating !== "down" && rating !== null)) {
    return Response.json({ error: "investorId and a valid rating required" }, { status: 400 });
  }

  console.log("[feedback]", {
    investorId,
    rating,
    question: (body.question ?? "").slice(0, 200),
    answerPreview: (body.answer ?? "").slice(0, 120),
  });

  return Response.json({ ok: true });
}
