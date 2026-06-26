"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { VoiceView } from "@/components/VoiceView";
import type {
  ChatMessage as Msg,
  DirectoryInvestor,
  InvestorProfile,
} from "@/components/types";

const DEFAULT_INVESTOR = "INV001";

function suggestionsFor(profile: InvestorProfile | null): string[] {
  if (!profile) return [];
  if (!profile.hasHoldings) {
    return [
      "Do I have any investments yet?",
      "What happens after I'm onboarded?",
      "What is a capital call?",
    ];
  }
  const topSector = profile.topSectors[0]?.sector;
  return [
    "Give me an overview of my portfolio and my MOIC.",
    topSector
      ? `How are my ${topSector} holdings doing?`
      : "How is my largest holding doing?",
    "What fees am I paying, and did I get any discounts?",
    "Do I have any upcoming capital calls or overdue fees?",
  ];
}

export default function Home() {
  const [investors, setInvestors] = useState<DirectoryInvestor[]>([]);
  const [selectedId, setSelectedId] = useState(DEFAULT_INVESTOR);
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Load investor directory once.
  useEffect(() => {
    fetch("/api/investors")
      .then((r) => r.json())
      .then((d) => setInvestors(d.investors ?? []))
      .catch(() => setInvestors([]));
  }, []);

  // Load the selected investor's profile; switching investors clears the chat
  // (it is a different "logged-in" user).
  useEffect(() => {
    setLoadingProfile(true);
    setMessages([]);
    fetch(`/api/profile?investorId=${selectedId}`)
      .then((r) => r.json())
      .then((p) => setProfile(p))
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, [selectedId]);

  // Autoscroll to newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Run the assistant over a given history (ending in a user turn). Shared by send
  // and regenerate.
  const complete = useCallback(
    async (history: Msg[]) => {
      setMessages([...history, { role: "assistant", content: "", pending: true }]);
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            investorId: selectedId,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");
        setMessages([
          ...history,
          {
            role: "assistant",
            content: data.reply,
            sources: data.sources,
            toolsUsed: data.toolsUsed,
          },
        ]);
      } catch (err) {
        setMessages([
          ...history,
          {
            role: "assistant",
            content:
              err instanceof Error
                ? `Something went wrong: ${err.message}`
                : "Something went wrong.",
            error: true,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [selectedId],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setInput("");
      if (taRef.current) taRef.current.style.height = "auto";
      complete([...messages, { role: "user", content: trimmed }]);
    },
    [busy, messages, complete],
  );

  // Regenerate: drop trailing assistant turns and re-run the last user question.
  const regenerate = useCallback(() => {
    if (busy) return;
    let end = messages.length;
    while (end > 0 && messages[end - 1].role === "assistant") end--;
    if (end === 0) return;
    complete(messages.slice(0, end));
  }, [busy, messages, complete]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const firstName = profile?.name?.split(" ")[0] ?? "there";
  const suggestions = suggestionsFor(profile);
  const empty = messages.length === 0;

  const closeSidebar = () => setSidebarOpen(false);
  const pickInvestor = (id: string) => {
    setSelectedId(id);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar
        className="hidden lg:flex"
        investors={investors}
        selectedId={selectedId}
        onSelect={setSelectedId}
        profile={profile}
        loadingProfile={loadingProfile}
      />

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade"
            onClick={closeSidebar}
          />
          <div className="animate-rise absolute left-0 top-0 h-full w-[86%] max-w-sm">
            <Sidebar
              className="flex h-full"
              investors={investors}
              selectedId={selectedId}
              onSelect={pickInvestor}
              profile={profile}
              loadingProfile={loadingProfile}
              onClose={closeSidebar}
            />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-surface-sunk"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/equitie-logo.png" alt="EquiTie" className="h-6 w-auto" />
          <button
            onClick={() => setVoiceActive(true)}
            aria-label="Talk to your assistant"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-clay text-surface shadow-sm transition hover:bg-clay-deep"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
            </svg>
          </button>
        </header>

        {/* Desktop header */}
        <header className="hidden items-center justify-between border-b border-line px-10 py-5 lg:flex">
          <div className="font-display text-[1.05rem] text-ink">
            Your portfolio, in plain language
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setVoiceActive(true)}
              className="flex items-center gap-2 rounded-full bg-clay px-4 py-2 text-[0.82rem] font-medium text-surface shadow-sm transition hover:bg-clay-deep"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
              </svg>
              Talk to your assistant
            </button>
            <div className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold-wash px-3 py-1 text-[0.72rem] text-gold">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Grounded · Cited · Personalised
            </div>
          </div>
        </header>

        {voiceActive ? (
          <VoiceView
            investorId={selectedId}
            investorName={profile?.name ?? "your"}
            onEnd={() => setVoiceActive(false)}
          />
        ) : (
          <>
            {/* Conversation */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
                {empty ? (
                  <EmptyState
                    firstName={firstName}
                    suggestions={suggestions}
                    onPick={send}
                    loading={loadingProfile}
                  />
                ) : (
                  <div className="flex flex-col gap-8">
                    {messages.map((m, i) => (
                      <ChatMessage
                        key={i}
                        message={m}
                        question={
                          i > 0 && messages[i - 1].role === "user"
                            ? messages[i - 1].content
                            : undefined
                        }
                        investorId={selectedId}
                        isLast={i === messages.length - 1 && m.role === "assistant"}
                        busy={busy}
                        onRegenerate={regenerate}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Composer */}
            <div className="border-t border-line bg-paper/80 px-4 py-4 backdrop-blur lg:px-8 lg:py-5">
              <div className="mx-auto w-full max-w-3xl">
                <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface px-3 py-2.5 shadow-sm transition focus-within:border-clay focus-within:ring-2 focus-within:ring-clay/15 lg:px-4">
                  <textarea
                    ref={taRef}
                    rows={1}
                    value={input}
                    placeholder={`Ask ${
                      profile ? "about " + firstName + "’s" : "about your"
                    } portfolio…`}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                    }}
                    onKeyDown={onKeyDown}
                    className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[0.98rem] leading-relaxed text-ink outline-none placeholder:text-ink-faint"
                  />
                  {/* Voice entry (ChatGPT-style waveform in the input bar) */}
                  <button
                    onClick={() => setVoiceActive(true)}
                    aria-label="Start voice conversation"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-soft transition hover:bg-surface-sunk hover:text-clay"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => send(input)}
                    disabled={busy || !input.trim()}
                    aria-label="Send"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-clay text-surface transition hover:bg-clay-deep disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
                <p className="mt-2 text-center text-[0.7rem] text-ink-faint">
                  Figures are computed deterministically from the EquiTie dataset and
                  cited by source row. Not investment advice.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({
  firstName,
  suggestions,
  onPick,
  loading,
}: {
  firstName: string;
  suggestions: string[];
  onPick: (s: string) => void;
  loading: boolean;
}) {
  return (
    <div className="animate-fade pt-10">
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-clay">
        EquiTie Investor Assistant
      </div>
      <h1 className="mt-3 font-display text-[2rem] leading-[1.1] tracking-tight text-ink sm:text-[2.4rem] lg:text-[2.6rem]">
        Hello{loading ? "" : `, ${firstName}`}.
      </h1>
      <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed text-ink-soft">
        Ask anything about your portfolio: a single position across rounds, your
        fees and any discounts, upcoming capital calls, realised exits after carry,
        or a plain-language account statement. Every number is grounded in your data
        and cited.
      </p>

      <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="group rounded-2xl border border-line bg-surface px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-clay/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.95rem] leading-snug text-ink">{s}</span>
              <span className="text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-clay">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
