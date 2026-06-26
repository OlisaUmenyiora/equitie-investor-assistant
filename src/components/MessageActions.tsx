"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  answer: string;
  question?: string;
  sources?: string[];
  investorId: string;
  isLast: boolean;
  busy: boolean;
  onRegenerate: () => void;
}

function buildMarkdown(p: Props): string {
  const lines = [
    "# EquiTie Investor Assistant",
    "",
    `**Investor:** ${p.investorId}`,
    p.question ? `**Question:** ${p.question}` : "",
    "",
    p.answer,
  ];
  if (p.sources && p.sources.length) {
    lines.push("", `**Sources:** ${p.sources.join(", ")}`);
  }
  return lines.filter((l) => l !== null).join("\n");
}

export function MessageActions(props: Props) {
  const { answer, sources, investorId, isLast, busy, onRegenerate } = props;
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const copy = async (withSources = false) => {
    const text =
      withSources && sources?.length
        ? `${answer}\n\nSources: ${sources.join(", ")}`
        : answer;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; ignore */
    }
  };

  const download = () => {
    const blob = new Blob([buildMarkdown(props)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equitie-answer-${investorId}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const sendFeedback = (next: "up" | "down") => {
    const value = rating === next ? null : next;
    setRating(value);
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        investorId,
        rating: value,
        question: props.question,
        answer,
      }),
    }).catch(() => {});
  };

  return (
    <div className="mt-3 flex items-center gap-0.5">
      <IconButton label={copied ? "Copied" : "Copy"} onClick={() => copy(false)} active={copied}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </IconButton>

      <IconButton
        label="Good response"
        onClick={() => sendFeedback("up")}
        active={rating === "up"}
      >
        <ThumbUpIcon filled={rating === "up"} />
      </IconButton>

      <IconButton
        label="Bad response"
        onClick={() => sendFeedback("down")}
        active={rating === "down"}
      >
        <ThumbDownIcon filled={rating === "down"} />
      </IconButton>

      <IconButton label="Download as Markdown" onClick={download}>
        <DownloadIcon />
      </IconButton>

      {isLast && (
        <IconButton label="Regenerate" onClick={onRegenerate} disabled={busy}>
          <RegenerateIcon />
        </IconButton>
      )}

      <div className="relative" ref={menuRef}>
        <IconButton label="More" onClick={() => setMenuOpen((o) => !o)} active={menuOpen}>
          <MoreIcon />
        </IconButton>
        {menuOpen && (
          <div className="absolute left-0 top-9 z-10 w-48 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
            <MenuItem
              onClick={() => {
                copy(true);
                setMenuOpen(false);
              }}
            >
              Copy with sources
            </MenuItem>
            <MenuItem
              onClick={() => {
                download();
                setMenuOpen(false);
              }}
            >
              Download as Markdown
            </MenuItem>
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-8 w-8 place-items-center rounded-lg transition disabled:opacity-30 ${
        active
          ? "bg-clay-wash text-clay"
          : "text-ink-faint hover:bg-surface-sunk hover:text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3.5 py-2 text-left text-[0.85rem] text-ink-soft transition hover:bg-surface-sunk hover:text-ink"
    >
      {children}
    </button>
  );
}

/* Icons — outline style matching the reference */
const S = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CopyIcon() {
  return (
    <svg {...S}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg {...S}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function ThumbUpIcon({ filled }: { filled?: boolean }) {
  return (
    <svg {...S} fill={filled ? "currentColor" : "none"}>
      <path d="M7 10v11" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L14 3a1.5 1.5 0 0 1 1 2.88Z" />
    </svg>
  );
}
function ThumbDownIcon({ filled }: { filled?: boolean }) {
  return (
    <svg {...S} fill={filled ? "currentColor" : "none"}>
      <path d="M17 14V3" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L10 21a1.5 1.5 0 0 1-1-2.88Z" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg {...S}>
      <path d="M12 15V3" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
function RegenerateIcon() {
  return (
    <svg {...S}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg {...S}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}
