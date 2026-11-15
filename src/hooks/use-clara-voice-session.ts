"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  speakText,
  stopAllSpeech,
  type SpeakHandle,
} from "@/lib/clara-neural-tts";

export type ClaraVoicePhase =
  | "idle"
  | "listening"
  | "hearing"
  | "thinking"
  | "speaking"
  | "muted"
  | "denied"
  | "unsupported";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const BAR_COUNT = 18;

function floorBars() {
  return Array.from({ length: BAR_COUNT }, () => 0.08);
}

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type UseClaraVoiceSessionArgs = {
  active: boolean;
  muted: boolean;
  busy: boolean;
  speakText: string | null;
  onFinalTranscript: (text: string) => void;
};

export function useClaraVoiceSession({
  active,
  muted,
  busy,
  speakText: speakPayload,
  onFinalTranscript,
}: UseClaraVoiceSessionArgs) {
  const [phase, setPhase] = useState<ClaraVoicePhase>("idle");
  const [userLevels, setUserLevels] = useState<number[]>(floorBars);
  const [agentLevels, setAgentLevels] = useState<number[]>(floorBars);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListenRef = useRef(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const phaseRef = useRef<ClaraVoicePhase>("idle");
  phaseRef.current = phase;
  const lastSpokenRef = useRef<string | null>(null);
  const speakHandleRef = useRef<SpeakHandle | null>(null);

  const stopSpeaking = useCallback(() => {
    speakHandleRef.current?.stop();
    speakHandleRef.current = null;
    stopAllSpeech();
    if (phaseRef.current === "speaking") {
      setPhase(mutedRef.current ? "muted" : "listening");
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const tick = () => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const now = performance.now();
      const mid = (BAR_COUNT - 1) / 2;

      const nextUser = Array.from({ length: BAR_COUNT }, (_, i) => {
        const dist = Math.abs(i - mid) / mid;
        const envelope = 1 - dist * 0.65;
        const bin = Math.min(
          data.length - 1,
          Math.floor((i / BAR_COUNT) * data.length),
        );
        const raw = (data[bin] ?? 0) / 255;
        const floor = 0.08 + (1 - dist) * 0.04;
        if (mutedRef.current) return floor * 0.5;
        if (phaseRef.current === "speaking") return floor * 0.55;
        return Math.min(1, Math.max(floor, raw * envelope * 1.4));
      });

      const agentActive =
        phaseRef.current === "speaking" || phaseRef.current === "thinking";
      const nextAgent = Array.from({ length: BAR_COUNT }, (_, i) => {
        const dist = Math.abs(i - mid) / mid;
        const envelope = 1 - dist * 0.55;
        const floor = 0.1 + (1 - dist) * 0.05;
        if (!agentActive) return floor * 0.45;
        const pulse =
          0.35 +
          0.45 * Math.abs(Math.sin(now / 160 + i * 0.55)) +
          0.2 * Math.abs(Math.sin(now / 90 + i * 0.9));
        return Math.min(1, Math.max(floor, pulse * envelope));
      });

      setUserLevels(nextUser);
      setAgentLevels(nextAgent);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    const startMic = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("unsupported");
        setError("Este navegador não libera o microfone pra modo voz.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        for (const track of stream.getAudioTracks()) {
          track.enabled = !mutedRef.current;
        }
        const Ctx =
          window.AudioContext ||
          (
            window as unknown as {
              webkitAudioContext: typeof AudioContext;
            }
          ).webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => {});
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);
        analyserRef.current = analyser;
        rafRef.current = window.requestAnimationFrame(tick);
        if (!mutedRef.current) setPhase("listening");
        else setPhase("muted");
      } catch {
        if (cancelled) return;
        setPhase("denied");
        setError(
          "Microfone bloqueado. Libera o acesso nas configurações do navegador.",
        );
      }
    };

    void startMic();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      analyserRef.current = null;
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
      setUserLevels(floorBars());
      setAgentLevels(floorBars());
    };
  }, [active]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      track.enabled = !muted;
    }
  }, [muted, active]);

  useEffect(() => {
    if (!active) return;

    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setPhase((current) => (current === "denied" ? current : "unsupported"));
      setError(
        (prev) =>
          prev ??
          "Reconhecimento de fala indisponível neste navegador. Usa Chrome ou Edge.",
      );
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-BR";
    recognitionRef.current = recognition;
    wantListenRef.current = true;

    recognition.onresult = (event) => {
      if (mutedRef.current || busyRef.current) return;
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i];
        if (!piece) continue;
        const chunk = piece[0]?.transcript ?? "";
        if (piece.isFinal) finalText += chunk;
        else interimText += chunk;
      }
      if (interimText) {
        setInterim(interimText.trim());
        setPhase("hearing");
      }
      const cleaned = finalText.trim();
      if (cleaned) {
        setInterim("");
        onFinalRef.current(cleaned);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setPhase("denied");
        setError(
          "Microfone bloqueado. Libera o acesso nas configurações do navegador.",
        );
        wantListenRef.current = false;
        return;
      }
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError("Falha na escuta. Tenta de novo em instantes.");
    };

    recognition.onend = () => {
      if (!wantListenRef.current) return;
      if (mutedRef.current || busyRef.current) return;
      if (phaseRef.current === "speaking" || phaseRef.current === "denied") {
        return;
      }
      try {
        recognition.start();
      } catch {
        /* already started */
      }
    };

    const sync = () => {
      const shouldListen =
        wantListenRef.current &&
        !mutedRef.current &&
        !busyRef.current &&
        phaseRef.current !== "speaking" &&
        phaseRef.current !== "denied";
      if (shouldListen) {
        try {
          recognition.start();
          setPhase((current) =>
            current === "hearing" ||
            current === "thinking" ||
            current === "speaking"
              ? current
              : "listening",
          );
        } catch {
          /* already started */
        }
      } else {
        try {
          recognition.stop();
        } catch {
          /* already stopped */
        }
      }
    };

    sync();
    const id = window.setInterval(sync, 700);

    return () => {
      wantListenRef.current = false;
      window.clearInterval(id);
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
      setInterim("");
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (phase === "denied" || phase === "unsupported") return;
    if (muted) {
      stopSpeaking();
      setPhase("muted");
      setInterim("");
      return;
    }
    if (busy) {
      stopSpeaking();
      setPhase("thinking");
      setInterim("");
      return;
    }
    if (phase === "muted" || phase === "thinking") {
      setPhase("listening");
    }
  }, [active, muted, busy, phase, stopSpeaking]);

  useEffect(() => {
    if (!active || !speakPayload) return;
    if (muted) return;
    if (lastSpokenRef.current === speakPayload) return;

    let cancelled = false;
    lastSpokenRef.current = speakPayload;
    setPhase("speaking");
    setInterim("");

    void (async () => {
      try {
        const handle = await speakText(speakPayload);
        if (cancelled) {
          handle.stop();
          return;
        }
        speakHandleRef.current = handle;
        await handle.done;
        if (cancelled) return;
        speakHandleRef.current = null;
        setPhase(mutedRef.current ? "muted" : "listening");
      } catch {
        if (cancelled) return;
        speakHandleRef.current = null;
        setPhase(mutedRef.current ? "muted" : "listening");
      }
    })();

    return () => {
      cancelled = true;
      speakHandleRef.current?.stop();
      speakHandleRef.current = null;
      stopAllSpeech();
    };
  }, [active, speakPayload, muted]);

  useEffect(() => {
    if (active) return;
    lastSpokenRef.current = null;
    stopSpeaking();
    setPhase("idle");
    setInterim("");
    setError(null);
  }, [active, stopSpeaking]);

  return {
    phase,
    userLevels,
    agentLevels,
    interim,
    error,
    stopSpeaking,
  };
}
