"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ChatText,
  Microphone,
  MicrophoneSlash,
  SpeakerHigh,
  SpeakerSlash,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { Mutate } from "@/components/finance-form";
import { ClaraMark } from "@/components/clara-mark";
import { useClaraAgentChat } from "@/hooks/use-clara-agent-chat";
import { useClaraVoiceSession } from "@/hooks/use-clara-voice-session";
import {
  appendClaraVoiceEnded,
  appendClaraVoiceStarted,
  getClaraAgentStore,
  setClaraVoiceMode,
  subscribeClaraAgentStore,
} from "@/lib/clara-chat-session";
import type { ClaraView } from "@/lib/clara-mock-agent";
import type { FinanceData } from "@/lib/types";
import { cn } from "@/lib/utils";

type VoiceTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const VOICE_PAD = 16;
const savedVoicePos: { left: number | null; top: number | null } = {
  left: null,
  top: null,
};

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultVoicePos(panel: HTMLElement | null) {
  const w = panel?.offsetWidth || Math.min(320, window.innerWidth - 32);
  return {
    left: Math.max(VOICE_PAD, (window.innerWidth - w) / 2),
    top: VOICE_PAD,
  };
}

function clampVoicePos(
  left: number,
  top: number,
  panel: HTMLElement | null,
) {
  const w = panel?.offsetWidth || Math.min(320, window.innerWidth - 32);
  const h = panel?.offsetHeight || 120;
  return {
    left: Math.max(
      VOICE_PAD,
      Math.min(left, window.innerWidth - w - VOICE_PAD),
    ),
    top: Math.max(
      VOICE_PAD,
      Math.min(top, window.innerHeight - h - VOICE_PAD),
    ),
  };
}

function VoiceWaveform({
  userLevels,
  agentLevels,
  reduced,
  inputMuted,
  outputMuted,
}: {
  userLevels: number[];
  agentLevels: number[];
  reduced: boolean;
  inputMuted: boolean;
  outputMuted: boolean;
}) {
  const count = Math.max(userLevels.length, agentLevels.length);
  return (
    <div
      className="clara-voice-wave"
      role="img"
      aria-label="Medidor de volume"
    >
      {Array.from({ length: count }, (_, index) => {
        const user = userLevels[index] ?? 0.08;
        const agent = agentLevels[index] ?? 0.08;
        const userHeight = reduced ? 5 : Math.max(4, Math.round(user * 28));
        const agentHeight = reduced
          ? 4
          : Math.max(3, Math.round(agent * 28 * 0.7));
        return (
          <span key={index} className="clara-voice-wave-slot">
            <span
              className="clara-voice-wave-bar is-agent"
              style={{
                height: agentHeight,
                opacity: outputMuted ? 0.1 : 0.28,
              }}
            />
            <span
              className="clara-voice-wave-bar is-user"
              style={{
                height: userHeight,
                opacity: inputMuted ? 0.3 : 1,
              }}
            />
          </span>
        );
      })}
    </div>
  );
}

type ClaraAgentVoiceOverlayProps = {
  data: FinanceData;
  currentView: ClaraView;
  onNavigate: (view: ClaraView) => void;
  mutate: Mutate;
};

export function ClaraAgentVoiceOverlay({
  data,
  currentView,
  onNavigate,
  mutate,
}: ClaraAgentVoiceOverlayProps) {
  const reduceMotion = useReducedMotion();
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(() => getClaraAgentStore().voiceMode);
  const [inputMuted, setInputMuted] = useState(false);
  const [outputMuted, setOutputMuted] = useState(false);
  const outputMutedRef = useRef(false);
  outputMutedRef.current = outputMuted;
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [speakText, setSpeakText] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const startedAtRef = useRef(0);
  const sendingRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOriginRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  const { send, pending } = useClaraAgentChat({
    data,
    currentView,
    onNavigate,
    mutate,
  });

  const handleUserUtterance = useCallback(
    async (text: string) => {
      const cleaned = text.trim();
      if (!cleaned || sendingRef.current || pending) return;

      sendingRef.current = true;
      setTurns((current) => [
        ...current,
        { id: nextId(), role: "user", text: cleaned },
      ]);
      setVoiceBusy(true);
      setSpeakText(null);

      try {
        const reply = await send(cleaned);
        if (reply) {
          setTurns((current) => [
            ...current,
            { id: nextId(), role: "assistant", text: reply },
          ]);
          setSpeakText(reply);
          if (outputMutedRef.current) {
            setTranscriptOpen(true);
          }
        }
      } finally {
        sendingRef.current = false;
        setVoiceBusy(false);
      }
    },
    [pending, send],
  );

  const { phase, userLevels, agentLevels, interim, error, stopSpeaking } =
    useClaraVoiceSession({
      active: open,
      inputMuted,
      outputMuted,
      busy: voiceBusy || pending,
      speakText,
      onFinalTranscript: handleUserUtterance,
    });

  useLayoutEffect(() => {
    setPortalHost(document.body);
  }, []);

  useEffect(() => {
    return subscribeClaraAgentStore(() => {
      setOpen(getClaraAgentStore().voiceMode);
    });
  }, []);

  const sessionLiveRef = useRef(false);

  useEffect(() => {
    if (open) {
      if (!sessionLiveRef.current) {
        sessionLiveRef.current = true;
        startedAtRef.current = Date.now();
        appendClaraVoiceStarted();
      }
      return;
    }

    if (sessionLiveRef.current) {
      sessionLiveRef.current = false;
      appendClaraVoiceEnded(Math.max(0, Date.now() - startedAtRef.current));
    }

    setInputMuted(false);
    setOutputMuted(false);
    setTranscriptOpen(false);
    setTurns([]);
    setVoiceBusy(false);
    setSpeakText(null);
    setDragging(false);
    setPos(null);
    dragOriginRef.current = null;
    sendingRef.current = false;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    if (pos != null) return;
    if (savedVoicePos.left != null && savedVoicePos.top != null) {
      setPos(
        clampVoicePos(
          savedVoicePos.left,
          savedVoicePos.top,
          panelRef.current,
        ),
      );
      return;
    }
    setPos(defaultVoicePos(null));
  }, [open, pos]);

  useEffect(() => {
    if (!open || pos == null) return;
    const onResize = () => {
      setPos((current) => {
        if (!current) return current;
        const next = clampVoicePos(
          current.left,
          current.top,
          panelRef.current,
        );
        savedVoicePos.left = next.left;
        savedVoicePos.top = next.top;
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, pos]);

  const onVoiceDragDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("button, a, input, textarea")) return;
      if (!pos) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragOriginRef.current = {
        x: event.clientX,
        y: event.clientY,
        left: pos.left,
        top: pos.top,
      };
      setDragging(true);
    },
    [pos],
  );

  const onVoiceDragMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const origin = dragOriginRef.current;
      if (!origin) return;
      setPos(
        clampVoicePos(
          origin.left + (event.clientX - origin.x),
          origin.top + (event.clientY - origin.y),
          panelRef.current,
        ),
      );
    },
    [],
  );

  const onVoiceDragUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!dragOriginRef.current) return;
      dragOriginRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      setPos((current) => {
        if (current) {
          savedVoicePos.left = current.left;
          savedVoicePos.top = current.top;
        }
        return current;
      });
      setDragging(false);
    },
    [],
  );

  const endSession = useCallback(() => {
    stopSpeaking();
    setClaraVoiceMode(false);
  }, [stopSpeaking]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (transcriptOpen) {
        setTranscriptOpen(false);
        return;
      }
      endSession();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, transcriptOpen, endSession]);

  if (!portalHost) return null;

  const muteHints = [
    inputMuted ? "Mic mutado" : null,
    outputMuted ? "Voz mutada" : null,
  ].filter(Boolean);
  const muteSuffix =
    muteHints.length > 0 ? ` · ${muteHints.join(" · ")}` : "";

  const statusLabel =
    error && (phase === "denied" || phase === "unsupported")
      ? error
      : inputMuted && !(phase === "thinking" || voiceBusy || pending) && phase !== "speaking"
        ? `Microfone mutado${outputMuted ? " · Voz mutada" : ""}`
        : phase === "thinking" || voiceBusy || pending
          ? outputMuted
            ? "Clara pensando… Resposta no chat."
            : "Clara pensando…"
          : phase === "speaking"
            ? "Clara falando…"
            : phase === "hearing"
              ? `${interim || "Ouvindo…"}${muteSuffix}`
              : `Ouvindo…${muteSuffix}`;

  return createPortal(
    <AnimatePresence>
      {open && pos ? (
        <div
          key="clara-voice-mode"
          className="clara-voice-root pointer-events-none fixed inset-0 z-[90] overflow-hidden"
        >
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label="Modo voz"
            className={cn(
              "clara-voice-bar pointer-events-auto",
              dragging && "is-dragging",
            )}
            style={{ left: pos.left, top: pos.top }}
            initial={reduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <div
              className={cn(
                "clara-voice-bar-drag",
                dragging ? "is-dragging" : "is-grab",
              )}
              aria-label="Arrastar modo voz"
              onPointerDown={onVoiceDragDown}
              onPointerMove={onVoiceDragMove}
              onPointerUp={onVoiceDragUp}
              onPointerCancel={onVoiceDragUp}
            >
              <div className="clara-voice-bar-head">
                <div className="clara-voice-bar-main">
                  <span className="clara-voice-bar-icon" aria-hidden>
                    <ClaraMark className="clara-voice-bar-logo clara-agent-mark brand-mark" />
                  </span>
                  <VoiceWaveform
                    userLevels={userLevels}
                    agentLevels={agentLevels}
                    reduced={Boolean(reduceMotion)}
                    inputMuted={inputMuted}
                    outputMuted={outputMuted}
                  />
                </div>

                <div className="clara-voice-bar-actions">
                  <button
                    type="button"
                    className={cn(
                      "clara-voice-icon-btn",
                      inputMuted && "is-active",
                    )}
                    aria-label={
                      inputMuted ? "Ativar microfone" : "Silenciar microfone"
                    }
                    aria-pressed={inputMuted}
                    onClick={() => setInputMuted((value) => !value)}
                  >
                    {inputMuted ? (
                      <MicrophoneSlash size={16} weight="fill" />
                    ) : (
                      <Microphone size={16} weight="fill" />
                    )}
                  </button>

                  <button
                    type="button"
                    className={cn(
                      "clara-voice-icon-btn",
                      outputMuted && "is-active",
                    )}
                    aria-label={
                      outputMuted
                        ? "Ativar voz da Clara"
                        : "Silenciar voz da Clara"
                    }
                    aria-pressed={outputMuted}
                    onClick={() => setOutputMuted((value) => !value)}
                  >
                    {outputMuted ? (
                      <SpeakerSlash size={16} weight="fill" />
                    ) : (
                      <SpeakerHigh size={16} weight="fill" />
                    )}
                  </button>

                  <button
                    type="button"
                    className={cn(
                      "clara-voice-icon-btn",
                      transcriptOpen && "is-active",
                    )}
                    aria-label={
                      transcriptOpen
                        ? "Fechar transcrição"
                        : "Abrir transcrição"
                    }
                    onClick={() => setTranscriptOpen((value) => !value)}
                  >
                    <ChatText size={16} />
                  </button>

                  <button
                    type="button"
                    className="clara-voice-icon-btn is-end"
                    aria-label="Encerrar modo voz"
                    onClick={endSession}
                  >
                    <X size={15} weight="bold" />
                  </button>
                </div>
              </div>

              <div className="clara-voice-bar-status">
                <p>{statusLabel}</p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {transcriptOpen ? (
                <m.div
                  key="clara-voice-transcript"
                  className="clara-voice-transcript"
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {turns.length === 0 && !interim ? (
                    <p className="clara-voice-transcript-empty">
                      A conversa por voz aparece aqui. Cartões e ações vão
                      para o chat.
                    </p>
                  ) : (
                    <ul className="clara-voice-transcript-list">
                      {turns.map((turn) => (
                        <li
                          key={turn.id}
                          className={cn(
                            "clara-voice-transcript-item",
                            turn.role === "user" ? "is-user" : "is-assistant",
                          )}
                        >
                          {turn.text}
                        </li>
                      ))}
                      {interim ? (
                        <li className="clara-voice-transcript-item is-user">
                          {interim}
                        </li>
                      ) : null}
                    </ul>
                  )}
                </m.div>
              ) : null}
            </AnimatePresence>
          </m.div>
        </div>
      ) : null}
    </AnimatePresence>,
    portalHost,
  );
}
