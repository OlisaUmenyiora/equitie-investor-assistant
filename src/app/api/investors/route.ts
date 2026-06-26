import { store } from "@/lib/data/store";

export const runtime = "nodejs";

// Lightweight directory for the investor switcher. The "logged-in" investor is
// chosen here only because we are skipping auth per the brief; in production this
// would come from the session, not a dropdown.
export function GET() {
  const counts = new Map<string, number>();
  for (const a of store.raw.allocations) {
    if (a.allocation_status === "Active")
      counts.set(a.investor_id, (counts.get(a.investor_id) ?? 0) + 1);
  }

  const investors = store.raw.investors
    .map((i) => ({
      investor_id: i.investor_id,
      name: i.investor_name,
      reportingCurrency: i.reporting_currency,
      techSavviness: i.tech_savviness,
      age: i.age,
      dealCount: counts.get(i.investor_id) ?? 0,
      hasHoldings: (counts.get(i.investor_id) ?? 0) > 0,
    }))
    .sort((a, b) => a.investor_id.localeCompare(b.investor_id));

  return Response.json({ investors });
}
