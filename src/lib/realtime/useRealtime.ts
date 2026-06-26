"use client";

import { useCallback, useRef, useState } from "react";

// Client hook that drives an OpenAI Realtime voice session over WebRTC.
// The model calls our deterministic tools (executed server-side, investor-scoped);
// transcripts are built from data-channel events. No numbers are computed here.

export type RealtimeStatus = "idle" | "connecting" | "live" | "error";

export interface TranscriptTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: string[];
  done: boolean;
}

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

// Keep the voice transcript free of em/en dashes, consistent with the text surface.
function stripDashes(text: string): string {
  return text.replace(/\s+[—–]\s+/g, ", ").replace(/[—–]/g, "-");
}

export function useRealtime(investorId: string) {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const assistantTurnId = useRef<string | null>(null);
  const pendingSources = useRef<string[]>([]);
  const counter = useRef(0);
  const nextId = () => `t${counter.current++}`;

  const send = (obj: unknown) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") dc.send(JSON.stringify(obj));
  };

  const upsertAssistantDelta = useCallback((delta: string) => {
    setSpeaking(true);
    setTranscript((prev) => {
      const turns = [...prev];
      let id = assistantTurnId.current;
      if (!id) {
        id = nextId();
        assistantTurnId.current = id;
        turns.push({ id, role: "assistant", text: "", done: false });
      }
      const idx = turns.findIndex((t) => t.id === id);
      if (idx >= 0) turns[idx] = { ...turns[idx], text: turns[idx].text + delta };
      return turns;
    });
  }, []);

  const finishAssistant = useCallback((finalText?: string) => {
    setSpeaking(false);
    const id = assistantTurnId.current;
    assistantTurnId.current = null;
    const srcs = pendingSources.current;
    pendingSources.current = [];
    setTranscript((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              text: stripDashes(finalText ?? t.text),
              sources: srcs.length ? srcs : t.sources,
              done: true,
            }
          : t,
      ),
    );
  }, []);

  const addUserTurn = useCallback((text: string) => {
    if (!text.trim()) return;
    setTranscript((prev) => [
      ...prev,
      { id: nextId(), role: "user", text, done: true },
    ]);
  }, []);

  const runToolCall = useCallback(
    async (name: string, callId: string, argsJson: string) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(argsJson || "{}");
      } catch {
        args = {};
      }
      try {
        const res = await fetch("/api/realtime/tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ investorId, name, arguments: args }),
        });
        const data = await res.json();
        if (Array.isArray(data.sources)) {
          pendingSources.current = [
            ...new Set([...pendingSources.current, ...data.sources]),
          ];
        }
        send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(data.result ?? {}),
          },
        });
      } catch {
        send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ error: "tool failed" }),
          },
        });
      }
    },
    [investorId],
  );

  const handleEvent = useCallback(
    async (raw: string) => {
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(raw);
      } catch {
        return;
      }
      const type = ev.type as string;

      switch (type) {
        case "input_audio_buffer.speech_started":
          setListening(true);
          break;
        case "input_audio_buffer.speech_stopped":
          setListening(false);
          break;
        case "conversation.item.input_audio_transcription.completed":
          addUserTurn((ev.transcript as string) ?? "");
          break;
        case "response.output_audio_transcript.delta":
          upsertAssistantDelta((ev.delta as string) ?? "");
          break;
        case "response.output_audio_transcript.done":
          finishAssistant((ev.transcript as string) ?? undefined);
          break;
        case "response.done": {
          const response = ev.response as
            | { output?: Array<Record<string, unknown>> }
            | undefined;
          const output = response?.output ?? [];
          const calls = output.filter((o) => o.type === "function_call");
          if (calls.length > 0) {
            for (const c of calls) {
              await runToolCall(
                c.name as string,
                c.call_id as string,
                c.arguments as string,
              );
            }
            send({ type: "response.create" });
          } else if (assistantTurnId.current) {
            finishAssistant();
          }
          break;
        }
        default:
          break;
      }
    },
    [addUserTurn, upsertAssistantDelta, finishAssistant, runToolCall],
  );

  const disconnect = useCallback(() => {
    dcRef.current?.close();
    dcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setStatus("idle");
    setListening(false);
    setSpeaking(false);
    setMuted(false);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setTranscript([]);
    setStatus("connecting");
    try {
      const tokenRes = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorId }),
      });
      const token = await tokenRes.json();
      if (!tokenRes.ok || !token.value) {
        throw new Error(token.detail || token.error || "Could not start session");
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0];
        audio.play().catch(() => {});
      };

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => setStatus("live");
      dc.onmessage = (e) => handleEvent(e.data);
      dc.onclose = () => setStatus("idle");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(CALLS_URL, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${token.value}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!sdpRes.ok) throw new Error("WebRTC handshake failed");
      const answer = { type: "answer" as const, sdp: await sdpRes.text() };
      await pc.setRemoteDescription(answer);
    } catch (err) {
      disconnect();
      const msg = err instanceof Error ? err.message : "Voice connection failed";
      // Friendlier message for the most common cause: no mic / permission denied.
      setError(
        /denied|notallowed|notfound|permission/i.test(msg)
          ? "Microphone access is needed for voice. Allow it and try again."
          : msg,
      );
      setStatus("error");
    }
  }, [investorId, handleEvent, disconnect]);

  const toggleMute = useCallback(() => {
    const mic = micRef.current;
    if (!mic) return;
    const next = !muted;
    mic.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  // For verification without a microphone: drive a text turn through the data channel.
  const sendText = useCallback((text: string) => {
    send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    send({ type: "response.create" });
  }, []);

  return {
    status,
    error,
    listening,
    speaking,
    muted,
    transcript,
    connect,
    disconnect,
    toggleMute,
    sendText,
  };
}
