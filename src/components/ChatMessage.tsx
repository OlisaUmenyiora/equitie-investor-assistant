"use client";

import { MarkdownText } from "@/lib/markdown";
import type { ChatMessage as Msg } from "./types";

// Friendly labels for the dataset id prefixes shown in citations.
const PREFIX_LABEL: Record<string, string> = {
  ALC: "allocation",
  VAL: "valuation",
  DIST: "distribution",
  CALL: "capital call",
  FEE: "fee",
  LN: "statement line",
  DEAL: "deal",
  INV: "investor",
  CO: "company",
};

function labelFor(id: string): string {
  const m = id.match(/^([A-Z]+)/);
  return m ? (PREFIX_LABEL[m[1]] ?? "row") : "row";
}

export function ChatMessage({ message }: { message: Msg }) {
  if (message.role === "user") {
    return (
      <div className="animate-rise flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md border border-line bg-surface-sunk px-4 py-2.5 text-[0.98rem] leading-relaxed text-ink shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise flex gap-4">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-clay/10 text-clay">
        <span className="font-display text-[0.95rem] leading-none">E</span>
      </div>
      <div className="min-w-0 flex-1">
        {message.pending ? (
          <div className="flex items-center gap-1.5 pt-2">
            <span className="dot h-2 w-2 rounded-full bg-clay" />
            <span className="dot h-2 w-2 rounded-full bg-clay" />
            <span className="dot h-2 w-2 rounded-full bg-clay" />
          </div>
        ) : (
          <>
            <div className={message.error ? "prose-answer text-loss" : "prose-answer"}>
              <MarkdownText text={message.content} />
            </div>
            {message.sources && message.sources.length > 0 && (
              <Citations sources={message.sources} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Citations({ sources }: { sources: string[] }) {
  const shown = sources.slice(0, 12);
  const extra = sources.length - shown.length;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="mb-2 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
        Grounded in {sources.length} source row{sources.length === 1 ? "" : "s"}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((id) => (
          <span
            key={id}
            title={`Dataset ${labelFor(id)} row`}
            className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[0.72rem] text-ink-soft transition hover:border-clay hover:text-clay"
          >
            {id}
          </span>
        ))}
        {extra > 0 && (
          <span className="rounded-md px-2 py-0.5 font-mono text-[0.72rem] text-ink-faint">
            +{extra} more
          </span>
        )}
      </div>
    </div>
  );
}
