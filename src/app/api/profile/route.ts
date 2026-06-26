import { getInvestorProfile } from "@/lib/tools";
import { getInvestor } from "@/lib/data/store";

export const runtime = "nodejs";

export function GET(request: Request) {
  const url = new URL(request.url);
  const investorId = url.searchParams.get("investorId");
  if (!investorId || !getInvestor(investorId)) {
    return Response.json({ error: "Unknown investorId" }, { status: 400 });
  }
  return Response.json(getInvestorProfile(investorId));
}
