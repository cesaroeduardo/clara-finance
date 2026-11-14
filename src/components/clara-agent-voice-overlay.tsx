"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ChatText,
  GearSix,
  Microphone,
  MicrophoneSlash,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ClaraMark } from "@/components/clara-mark";
import {
  appendClaraChatMessages,
  getClaraAgentStore,
  setClaraVoiceMode,
  subscribeClaraAgentStore,
} from "@/lib/clara-chat-session";
import { cn } from "@/lib/utils";

const BAR_COUNT = 18;
const VOICE_REPLIES = [
  "Entendi, meu bem. Continua falando que eu te acompanho.",
  "Anotei. Quando quiser, manda o mesmo pelo texto pra eu agir na tela.",
  "Ouvi sim. Pode repetir com mais detalhe se precisar afinar.",
  "Beleza. Se for saldo ou gasto, é só pedir — por voz ou por escrito.",
];

type VoiceTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type VoicePhase = "listening" | "thinking" | "speaking";

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function VoiceWaveform({
  levels,
  reduced,
  muted,
}: {
  levels: number[];
  reduced: boolean;
  muted: boolean;
}) {
  return (
    <div
      className="clara-voice-wave"
      role="img"
      aria-label="Medidor de volume"
    >
      {levels.map((level, index) => {
        const height = reduced ? 5 : Math.max(4, Math.round(level * 28));
        return (
          <span key={index} className="clara-voice-wave-slot">
            <span
              className="clara-voice-wave-bar is-agent"
              style={{
                height: reduced ? 4 : Math.max(3, Math.round(height * 0.7)),
                opacity: muted ? 0.12 : 0.28,
              }}
            />
            <span
              className="clara-voice-wave-bar is-user"
              style={{
                height,
                opacity: muted ? 0.35 : 1,
              }}
            />
          </span>
        );
      })}
    </div>
  );
}

export function ClaraAgentVoiceOverlay() {
  const reduceMotion = useReducedMotion();
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(() => getClaraAgentStore().voiceMode);
  const [muted, setMuted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [levels, setLevels] = useState(() =>
    Array.from({ length: BAR_COUNT }, () => 0.12),
  );
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [phase, setPhase] = useState<VoicePhase>("listening");
  const startedAtRef = useRef(0);
  const replyIndexRef = useRef(0);
  const phaseRef = useRef<VoicePhase>("listening");
  const mutedRef = useRef(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setPortalHost(document.body);
  }, []);

  useEffect(() => {
    return subscribeClaraAgentStore(() => {
      setOpen(getClaraAgentStore().voiceMode);
    });
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (!open) {
      setMuted(false);
      setSettingsOpen(false);
      setTranscriptOpen(false);
      setTurns([]);
      setPhase("listening");
      return;
    }
    startedAtRef.current = Date.now();
  }, [open]);

  useEffect(() => {
    if (!open || muted || reduceMotion) {
      setLevels(Array.from({ length: BAR_COUNT }, () => 0.1));
      return;
    }
    const tick = window.setInterval(() => {
      const speaking = phaseRef.current === "speaking";
      setLevels(
        Array.from({ length: BAR_COUNT }, () => {
          const base = speaking ? 0.35 : 0.14;
          const span = speaking ? 0.55 : 0.7;
          return base + Math.random() * span;
        }),
      );
    }, 90);
    return () => window.clearInterval(tick);
  }, [open, muted, reduceMotion]);

  useEffect(() => {
    if (!open) return;

    let thinkTimer = 0;
    let speakTimer = 0;
    const loop = window.setInterval(() => {
      if (mutedRef.current) return;
      if (phaseRef.current !== "listening") return;

      setTurns((current) => [
        ...current,
        { id: nextId(), role: "user", text: "…" },
      ]);
      setPhase("thinking");

      thinkTimer = window.setTimeout(() => {
        const reply =
          VOICE_REPLIES[replyIndexRef.current % VOICE_REPLIES.length] ??
          VOICE_REPLIES[0];
        replyIndexRef.current += 1;
        setTurns((current) => [
          ...current,
          { id: nextId(), role: "assistant", text: reply },
        ]);
        setPhase("speaking");
        speakTimer = window.setTimeout(() => {
          setPhase("listening");
        }, 2200);
      }, 1200);
    }, 5600);

    return () => {
      window.clearInterval(loop);
      window.clearTimeout(thinkTimer);
      window.clearTimeout(speakTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [settingsOpen]);

  const endSession = useCallback(() => {
    const durationMs = Math.max(0, Date.now() - startedAtRef.current);
    const seconds = Math.max(1, Math.round(durationMs / 1000));
    appendClaraChatMessages({
      id: nextId(),
      role: "assistant",
      text: `Sessão de voz encerrada (${seconds}s). Se quiser, meu bem, manda a mesma pergunta por texto que eu cuido da tela.`,
    });
    setClaraVoiceMode(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      if (transcriptOpen) {
        setTranscriptOpen(false);
        return;
      }
      endSession();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, settingsOpen, transcriptOpen, endSession]);

  if (!portalHost) return null;

  const statusLabel =
    muted
      ? "Microfone mutado"
      : phase === "thinking"
        ? "Clara pensando…"
        : phase === "speaking"
          ? "Clara falando…"
          : "Ouvindo…";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          key="clara-voice-mode"
          className="clara-voice-root pointer-events-none fixed inset-0 z-[90] overflow-hidden"
        >
          <m.div
            role="dialog"
            aria-modal="false"
            aria-label="Modo voz"
            className="clara-voice-bar pointer-events-auto"
            initial={reduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <div className="clara-voice-bar-head">
              <div className="clara-voice-bar-main">
                <span className="clara-voice-bar-icon" aria-hidden>
                  {muted ? (
                    <MicrophoneSlash size={16} weight="fill" />
                  ) : (
                    <Microphone size={16} weight="fill" />
                  )}
                </span>
                <VoiceWaveform
                  levels={levels}
                  reduced={Boolean(reduceMotion)}
                  muted={muted}
                />
              </div>

              <div className="clara-voice-bar-actions">
                <div className="clara-voice-settings" ref={settingsRef}>
                  <button
                    type="button"
                    className="clara-voice-icon-btn"
                    aria-label="Configurações do modo voz"
                    aria-expanded={settingsOpen}
                    onClick={() => setSettingsOpen((value) => !value)}
                  >
                    <GearSix size={16} />
                  </button>
                  {settingsOpen ? (
                    <div
                      role="dialog"
                      aria-label="Configurações do modo voz"
                      className="clara-voice-settings-menu"
                    >
                      <label className="clara-voice-settings-row">
                        <span>Silenciar microfone</span>
                        <input
                          type="checkbox"
                          checked={muted}
                          onChange={(event) => setMuted(event.target.checked)}
                        />
                      </label>
                      <p className="clara-voice-settings-note">
                        Modo voz mock — a Clara responde com frases prontas. O
                        chat de texto fica separado até você encerrar.
                      </p>
                    </div>
                  ) : null}
                </div>

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
              <ClaraMark className="clara-voice-bar-mark clara-agent-mark brand-mark" />
              <p>{statusLabel}</p>
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
                  {turns.length === 0 ? (
                    <p className="clara-voice-transcript-empty">
                      A conversa por voz aparece aqui.
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
