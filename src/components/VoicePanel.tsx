"use client";

import { useEffect, useRef } from "react";
import { useRealtime } from "@/lib/realtime/useRealtime";

export function VoicePanel({
  investorId,
  investorName,
  onClose,
}: {
  investorId: string;
  investorName: string;
  onClose: () => void;
}) {
  const rt = useRealtime(investorId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Connect once when the panel opens; disconnect on close.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    rt.connect();
    return () => rt.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [rt.transcript]);

  const firstName = investorName.split(" ")[0];
  const statusLabel =
    rt.status === "connecting"
      ? "Connecting…"
      : rt.status === "error"
        ? "Connection failed"
        : rt.speaking
          ? "Speaking…"
          : rt.listening
            ? "Listening…"
            : rt.status === "live"
              ? "Listening… just talk"
              : "Idle";

  const close = () => {
    rt.disconnect();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade"
        onClick={close}
      />

      <div className="animate-rise relative flex h-[640px] max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <div className="font-display text-[1.1rem] text-ink">Voice conversation</div>
            <div className="text-[0.78rem] text-ink-faint">
              Speaking with {firstName}&apos;s assistant
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-faint transition hover:bg-surface-sunk hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* orb */}
        <div className="flex flex-col items-center justify-center gap-4 py-7">
          <div className="relative grid h-24 w-24 place-items-center">
            {(rt.speaking || rt.listening) && (
              <span
                className={`absolute inset-0 rounded-full ${
                  rt.speaking ? "bg-clay/25" : "bg-gain/20"
                } animate-ping`}
              />
            )}
            <span
              className={`relative grid h-20 w-20 place-items-center rounded-full text-surface transition-colors ${
                rt.status === "error"
                  ? "bg-loss"
                  : rt.speaking
                    ? "bg-clay"
                    : rt.listening
                      ? "bg-gain"
                      : "bg-clay/80"
              }`}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
              </svg>
            </span>
          </div>
          <div className="text-[0.85rem] font-medium text-ink-soft">{statusLabel}</div>
          {rt.error && (
            <div className="px-6 text-center text-[0.8rem] text-loss">{rt.error}</div>
          )}
        </div>

        {/* transcript */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto border-t border-line px-5 py-4">
          {rt.transcript.length === 0 ? (
            <p className="px-2 pt-6 text-center text-[0.85rem] leading-relaxed text-ink-faint">
              Ask out loud, for example &ldquo;What&apos;s my MOIC on Forgecraft?&rdquo;
              or &ldquo;Do I have any upcoming capital calls?&rdquo;
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {rt.transcript.map((t) =>
                t.role === "user" ? (
                  <div key={t.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-sunk px-3.5 py-2 text-[0.9rem] text-ink">
                      {t.text}
                    </div>
                  </div>
                ) : (
                  <div key={t.id} className="max-w-[92%]">
                    <div className="text-[0.95rem] leading-relaxed text-ink">{t.text}</div>
                    {t.sources && t.sources.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {t.sources.slice(0, 8).map((s) => (
                          <span
                            key={s}
                            className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[0.68rem] text-ink-faint"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* controls */}
        <div className="flex items-center justify-center gap-3 border-t border-line px-6 py-4">
          <button
            onClick={rt.toggleMute}
            disabled={rt.status !== "live"}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[0.85rem] font-medium transition disabled:opacity-40 ${
              rt.muted
                ? "border-loss/30 bg-loss/10 text-loss"
                : "border-line bg-surface text-ink-soft hover:bg-surface-sunk"
            }`}
          >
            {rt.muted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={close}
            className="flex items-center gap-2 rounded-full bg-loss px-5 py-2 text-[0.85rem] font-medium text-surface transition hover:opacity-90"
          >
            End conversation
          </button>
        </div>
      </div>
    </div>
  );
}
