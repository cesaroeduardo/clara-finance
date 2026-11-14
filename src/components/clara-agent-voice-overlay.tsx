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
import { useClaraVoiceSession } from "@/hooks/use-clara-voice-session";
import {
  appendClaraChatMessages,
  getClaraAgentStore,
  setClaraVoiceMode,
  subscribeClaraAgentStore,
} from "@/lib/clara-chat-session";
import { cn } from "@/lib/utils";

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

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function VoiceWaveform({
  userLevels,
  agentLevels,
  reduced,
  muted,
}: {
  userLevels: number[];
  agentLevels: number[];
  reduced: boolean;
  muted: boolean;
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
                opacity: muted ? 0.12 : 0.28,
              }}
            />
            <span
              className="clara-voice-wave-bar is-user"
              style={{
                height: userHeight,
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
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [speakText, setSpeakText] = useState<string | null>(null);
  const startedAtRef = useRef(0);
  const replyIndexRef = useRef(0);
  const replyTimerRef = useRef(0);
  const settingsRef = useRef<HTMLDivElement>(null);

  const handleUserUtterance = useCallback((text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;

    setTurns((current) => [
      ...current,
      { id: nextId(), role: "user", text: cleaned },
    ]);
    setVoiceBusy(true);
    setSpeakText(null);
    window.clearTimeout(replyTimerRef.current);
    replyTimerRef.current = window.setTimeout(() => {
      const reply =
        VOICE_REPLIES[replyIndexRef.current % VOICE_REPLIES.length] ??
        VOICE_REPLIES[0];
      replyIndexRef.current += 1;
      setTurns((current) => [
        ...current,
        { id: nextId(), role: "assistant", text: reply },
      ]);
      setSpeakText(reply);
      setVoiceBusy(false);
    }, 1100);
  }, []);

  const { phase, userLevels, agentLevels, interim, error, stopSpeaking } =
    useClaraVoiceSession({
      active: open,
      muted,
      busy: voiceBusy,
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

  useEffect(() => {
    if (!open) {
      setMuted(false);
      setSettingsOpen(false);
      setTranscriptOpen(false);
      setTurns([]);
      setVoiceBusy(false);
      setSpeakText(null);
      window.clearTimeout(replyTimerRef.current);
      return;
    }
    startedAtRef.current = Date.now();
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
    stopSpeaking();
    window.clearTimeout(replyTimerRef.current);
    const durationMs = Math.max(0, Date.now() - startedAtRef.current);
    const seconds = Math.max(1, Math.round(durationMs / 1000));
    appendClaraChatMessages({
      id: nextId(),
      role: "assistant",
      text: `Sessão de voz encerrada (${seconds}s). Se quiser, meu bem, manda a mesma pergunta por texto que eu cuido da tela.`,
    });
    setClaraVoiceMode(false);
  }, [stopSpeaking]);

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
    error && (phase === "denied" || phase === "unsupported")
      ? error
      : muted || phase === "muted"
        ? "Microfone mutado"
        : phase === "thinking"
          ? "Clara pensando…"
          : phase === "speaking"
            ? "Clara falando…"
            : phase === "hearing"
              ? interim || "Ouvindo…"
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
                  {muted || phase === "muted" || phase === "denied" ? (
                    <MicrophoneSlash size={16} weight="fill" />
                  ) : (
                    <Microphone size={16} weight="fill" />
                  )}
                </span>
                <VoiceWaveform
                  userLevels={userLevels}
                  agentLevels={agentLevels}
                  reduced={Boolean(reduceMotion)}
                  muted={muted || phase === "muted"}
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
                        A Clara ouve pelo microfone e responde com frases
                        prontas. O chat de texto fica separado até você
                        encerrar.
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
                  {turns.length === 0 && !interim ? (
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
