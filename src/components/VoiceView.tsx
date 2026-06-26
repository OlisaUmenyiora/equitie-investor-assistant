"use client";

import { useEffect, useRef } from "react";
import { useRealtime } from "@/lib/realtime/useRealtime";

// In-chat voice experience, styled after ChatGPT's voice mode: a large, audio-reactive
// orb with a live cited transcript, mic/mute bottom-left and end bottom-right.
// On-brand mint gradient (not ChatGPT blue). Lives inside the chat area, not a modal.
export function VoiceView({
  investorId,
  investorName,
  onEnd,
}: {
  investorId: string;
  investorName: string;
  onEnd: () => void;
}) {
  const rt = useRealtime(investorId);
  const orbRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Connect on mount, disconnect on unmount.
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

  // Audio-reactive orb: drive scale/glow from the live audio level via Web Audio,
  // updating a CSS variable per animation frame (no React re-render in the loop).
  useEffect(() => {
    const streams = [rt.remoteStream, rt.micStream].filter(Boolean) as MediaStream[];
    if (streams.length === 0) return;

    let raf = 0;
    let ctx: AudioContext | null = null;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      ctx.resume().catch(() => {});
      const analysers = streams
        .filter((s) => s.getAudioTracks().length > 0)
        .map((s) => {
          const src = ctx!.createMediaStreamSource(s);
          const an = ctx!.createAnalyser();
          an.fftSize = 256;
          src.connect(an);
          return an;
        });
      const buf = new Uint8Array(analysers[0]?.frequencyBinCount ?? 128);

      const tick = () => {
        let level = 0;
        for (const an of analysers) {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          level = Math.max(level, Math.sqrt(sum / buf.length));
        }
        // smooth + clamp into a pleasant range
        const scaled = Math.min(1, level * 3.2);
        orbRef.current?.style.setProperty("--level", scaled.toFixed(3));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* Web Audio unavailable; orb falls back to its idle breathing animation */
    }

    return () => {
      cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
    };
  }, [rt.remoteStream, rt.micStream]);

  const firstName = investorName.split(" ")[0];
  const statusLabel =
    rt.status === "connecting"
      ? "Connecting…"
      : rt.status === "error"
        ? "Couldn't connect"
        : rt.speaking
          ? "Speaking"
          : rt.listening
            ? "Listening"
            : rt.status === "live"
              ? "Listening… just talk"
              : rt.status === "paused"
                ? "Paused to save usage"
                : "Idle";

  const end = () => {
    rt.disconnect();
    onEnd();
  };

  const paused = rt.status === "paused";

  return (
    <div className="flex h-full flex-col">
      {/* top bar with an always-reachable close */}
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-[0.8rem] text-ink-faint">Voice · {firstName}</span>
        <button
          onClick={end}
          aria-label="Close voice"
          className="grid h-9 w-9 place-items-center rounded-full text-ink-faint transition hover:bg-surface-sunk hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* status */}
      <div className="flex items-center justify-center gap-2 px-4 pt-1 text-center">
        <span
          className={`h-2 w-2 rounded-full ${
            rt.status === "error"
              ? "bg-loss"
              : rt.speaking
                ? "bg-clay"
                : rt.listening
                  ? "bg-gain"
                  : "bg-ink-faint"
          }`}
        />
        <span className="text-[0.85rem] font-medium text-ink-soft">{statusLabel}</span>
      </div>

      {/* orb (tap to resume when paused) */}
      <div className="flex shrink-0 items-center justify-center py-8 sm:py-10">
        <button
          onClick={paused ? () => rt.connect() : undefined}
          className={paused ? "cursor-pointer" : "cursor-default"}
          aria-label={paused ? "Resume voice" : undefined}
        >
          <div className="orb-wrap">
            <div
              ref={orbRef}
              className="orb"
              data-speaking={rt.speaking}
              style={paused ? { opacity: 0.5 } : undefined}
            />
          </div>
        </button>
      </div>

      {rt.error && (
        <p className="px-6 text-center text-[0.85rem] text-loss">{rt.error}</p>
      )}
      {paused && (
        <button
          onClick={() => rt.connect()}
          className="mx-auto mb-1 rounded-full bg-clay px-5 py-2 text-[0.85rem] font-medium text-surface transition hover:bg-clay-deep"
        >
          Tap to resume
        </button>
      )}

      {/* transcript (no source citations in voice, per request) */}
      <div ref={scrollRef} className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-5 pb-4">
        {rt.transcript.length === 0 ? (
          <p className="px-2 pt-4 text-center text-[0.9rem] leading-relaxed text-ink-faint">
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
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* controls: mic/mute bottom-left, end bottom-right; safe-area padded so they
          never hide behind a mobile browser bar */}
      <div className="flex items-center justify-between border-t border-line px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          onClick={rt.toggleMute}
          disabled={rt.status !== "live"}
          aria-label={rt.muted ? "Unmute microphone" : "Mute microphone"}
          className={`grid h-12 w-12 place-items-center rounded-full border transition disabled:opacity-40 ${
            rt.muted
              ? "border-loss/40 bg-loss/15 text-loss"
              : "border-line bg-surface text-ink-soft hover:bg-surface-sunk"
          }`}
        >
          {rt.muted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2 2 20 20" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <path d="M12 19v3" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
            </svg>
          )}
        </button>

        <span className="text-[0.8rem] text-ink-faint">{firstName}</span>

        <button
          onClick={end}
          aria-label="End conversation"
          className="grid h-12 w-12 place-items-center rounded-full bg-loss text-surface transition hover:opacity-90"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
