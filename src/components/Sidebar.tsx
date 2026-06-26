"use client";

import type { DirectoryInvestor, InvestorProfile } from "./types";

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  AED: "AED ",
};

function fmt(amount: number, ccy: string): string {
  const sym = CURRENCY_SYMBOL[ccy] ?? "";
  return `${sym}${Math.round(amount).toLocaleString("en-GB")}`;
}

export function Sidebar({
  investors,
  selectedId,
  onSelect,
  profile,
  loadingProfile,
}: {
  investors: DirectoryInvestor[];
  selectedId: string;
  onSelect: (id: string) => void;
  profile: InvestorProfile | null;
  loadingProfile: boolean;
}) {
  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-r border-line bg-surface/40 px-7 py-8">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-clay text-surface shadow-sm">
          <span className="font-display text-lg leading-none">E</span>
        </div>
        <div className="leading-tight">
          <div className="font-display text-[1.35rem] tracking-tight text-ink">
            EquiTie
          </div>
          <div className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
            Investor Assistant
          </div>
        </div>
      </div>

      {/* Investor switcher */}
      <div className="mt-10">
        <label className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Signed in as
        </label>
        <div className="relative mt-2.5">
          <select
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-xl border border-line-strong bg-surface px-4 py-3 pr-10 font-sans text-[0.95rem] text-ink shadow-sm outline-none transition focus:border-clay focus:ring-2 focus:ring-clay/20"
          >
            {investors.map((i) => (
              <option key={i.investor_id} value={i.investor_id}>
                {i.investor_id} · {i.name}
                {i.hasHoldings ? "" : " (no holdings)"}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <p className="mt-2 text-[0.74rem] leading-relaxed text-ink-faint">
          Auth is skipped per the brief. Switching here is the same as logging in
          as that investor. The assistant only ever sees this person&apos;s data.
        </p>
      </div>

      {/* Profile card */}
      <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        {loadingProfile || !profile ? (
          <div className="space-y-3">
            <div className="h-5 w-32 animate-pulse rounded bg-surface-sunk" />
            <div className="h-4 w-40 animate-pulse rounded bg-surface-sunk" />
            <div className="h-4 w-24 animate-pulse rounded bg-surface-sunk" />
          </div>
        ) : (
          <div className="animate-fade">
            <div className="font-display text-[1.3rem] leading-tight text-ink">
              {profile.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Tag>{profile.type}</Tag>
              <Tag>Reports in {profile.reportingCurrency}</Tag>
              <Tag>{profile.techSavviness} fluency</Tag>
              {profile.age != null && <Tag>Age {profile.age}</Tag>}
            </div>

            {profile.hasHoldings ? (
              <>
                <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
                  <Stat label="Active deals" value={String(profile.dealCount)} />
                  <Stat label="Companies" value={String(profile.companyCount)} />
                  <Stat
                    label="Top holding"
                    value={`${profile.concentrationPctTopHolding}%`}
                  />
                  <Stat label="KYC" value={profile.kycStatus} />
                </div>

                {profile.topSectors.length > 0 && (
                  <div className="mt-5">
                    <div className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                      Most-active sectors
                    </div>
                    <ul className="mt-2.5 space-y-2">
                      {profile.topSectors.map((s) => (
                        <li
                          key={s.sector}
                          className="flex items-center justify-between gap-3 text-[0.82rem]"
                        >
                          <span className="text-ink-soft">{s.sector}</span>
                          <span className="font-mono text-[0.76rem] text-ink-faint">
                            {fmt(s.valueReporting, profile.reportingCurrency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-[0.85rem] leading-relaxed text-ink-soft">
                Newly onboarded, no allocations yet. A good case for the
                &ldquo;you have no investments&rdquo; flow.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto pt-8">
        <div className="flex items-center gap-2 text-[0.72rem] text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-gain" />
          Every figure is computed in code &amp; cited
        </div>
        <div className="mt-1.5 text-[0.72rem] text-ink-faint">
          Report date · 25 June 2026
        </div>
      </div>
    </aside>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-surface-sunk px-2.5 py-0.5 text-[0.7rem] font-medium text-ink-soft">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3.5 py-3">
      <div className="font-display text-[1.25rem] leading-none text-ink">{value}</div>
      <div className="mt-1 text-[0.68rem] uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </div>
    </div>
  );
}
