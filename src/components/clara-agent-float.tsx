"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Minus, PictureInPicture, X } from "@/components/icons";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ClaraAgentComposerPlus } from "@/components/clara-agent-composer-plus";
import { ClaraAgentComposerSend } from "@/components/clara-agent-composer-send";
import { ClaraAgentGreeting } from "@/components/clara-agent-greeting";
import { ClaraAgentMessageCard } from "@/components/clara-agent-message-card";
import { ClaraAgentThinking } from "@/components/clara-agent-thinking";
import { ClaraAgentVoiceRecord } from "@/components/clara-agent-voice-record";
import { ClaraMark } from "@/components/clara-mark";
import { ClaraType } from "@/components/clara-type";
import { Textarea } from "@/components/ui/textarea";
import { useClaraAgentChat } from "@/hooks/use-clara-agent-chat";
import {
  closeClaraAgentFloat,
  expandClaraAgentFloat,
  minimizeClaraAgent,
  openClaraAgentNewFloatChat,
  restoreClaraAgentInline,
  setClaraVoiceMode,
  toggleClaraVoiceMode,
} from "@/lib/clara-chat-session";
import type { Mutate } from "@/components/finance-form";
import type { ClaraView } from "@/lib/clara-mock-agent";
import type { FinanceData } from "@/lib/types";
import { cn } from "@/lib/utils";

type ClaraAgentFloatProps = {
  data: FinanceData;
  currentView: ClaraView;
  onNavigate: (view: ClaraView) => void;
  mutate: Mutate;
};

const FLOAT_PAD = 16;
const savedFloatPos: { left: number | null; top: number | null } = {
  left: null,
  top: null,
};

function defaultFloatPos() {
  const w = Math.min(420, window.innerWidth - 24);
  const h = Math.min(680, window.innerHeight - 88);
  return {
    left: Math.max(FLOAT_PAD, window.innerWidth - w - FLOAT_PAD),
    top: Math.max(FLOAT_PAD, window.innerHeight - h - FLOAT_PAD),
  };
}

function clampFloatPos(
  left: number,
  top: number,
  panel: HTMLElement | null,
) {
  const w = panel?.offsetWidth || Math.min(420, window.innerWidth - 24);
  const h = panel?.offsetHeight || Math.min(680, window.innerHeight - 88);
  return {
    left: Math.max(FLOAT_PAD, Math.min(left, window.innerWidth - w - FLOAT_PAD)),
    top: Math.max(FLOAT_PAD, Math.min(top, window.innerHeight - h - FLOAT_PAD)),
  };
}

export function ClaraAgentFloat({
  data,
  currentView,
  onNavigate,
  mutate,
}: ClaraAgentFloatProps) {
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const { messages, presentation, pending, voiceMode, send } =
    useClaraAgentChat({ data, currentView, onNavigate, mutate });
  const [draft, setDraft] = useState("");
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragOriginRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  const floating = presentation === "float";
  const minimized = presentation === "minimized";
  const empty = messages.length === 0 && !pending;
  const showLauncher =
    currentView !== "clara" &&
    (presentation === "inline" || presentation === "minimized");

  useLayoutEffect(() => {
    setPortalHost(document.body);
  }, []);

  useLayoutEffect(() => {
    if (!floating) return;
    if (pos != null) return;
    if (savedFloatPos.left != null && savedFloatPos.top != null) {
      setPos(
        clampFloatPos(savedFloatPos.left, savedFloatPos.top, panelRef.current),
      );
      return;
    }
    setPos(defaultFloatPos());
  }, [floating, pos]);

  useEffect(() => {
    if (!floating || pos == null) return;
    const onResize = () => {
      setPos((current) => {
        if (!current) return current;
        const next = clampFloatPos(
          current.left,
          current.top,
          panelRef.current,
        );
        savedFloatPos.left = next.left;
        savedFloatPos.top = next.top;
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [floating, pos]);

  useEffect(() => {
    if (!floating) return;
    const node = threadRef.current;
    if (!node || typeof node.scrollTo !== "function") return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [floating, messages, pending, reduceMotion]);

  useEffect(() => {
    if (!floating) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") minimizeClaraAgent();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [floating]);

  useEffect(() => {
    if (!floating || pos == null) return;
    const timer = window.setTimeout(() => {
      composerRef.current
        ?.querySelector("textarea")
        ?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [floating, pos]);

  const handleClose = useCallback(() => {
    savedFloatPos.left = null;
    savedFloatPos.top = null;
    setPos(null);
    setClaraVoiceMode(false);
    closeClaraAgentFloat();
  }, []);

  const handleRestoreInline = useCallback(() => {
    restoreClaraAgentInline();
    onNavigate("clara");
  }, [onNavigate]);

  const onFloatDragDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("button, a, input, textarea, [role='menu']")) return;
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

  const onFloatDragMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const origin = dragOriginRef.current;
      if (!origin) return;
      setPos(
        clampFloatPos(
          origin.left + (event.clientX - origin.x),
          origin.top + (event.clientY - origin.y),
          panelRef.current,
        ),
      );
    },
    [],
  );

  const onFloatDragUp = useCallback(
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
          savedFloatPos.left = current.left;
          savedFloatPos.top = current.top;
        }
        return current;
      });
      setDragging(false);
    },
    [],
  );

  function focusComposer() {
    const node = composerRef.current?.querySelector("textarea");
    node?.focus({ preventScroll: true });
  }

  async function submitDraft() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    requestAnimationFrame(() => focusComposer());
    await send(text);
    focusComposer();
  }

  if (!portalHost) return null;

  return createPortal(
    <AnimatePresence>
      {showLauncher ? (
        <m.button
          key="clara-agent-launcher"
          type="button"
          className="clara-agent-launcher"
          aria-label={
            minimized ? "Expandir conversa do agente" : "Abrir novo chat do agente"
          }
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          onClick={() => {
            if (minimized) {
              expandClaraAgentFloat();
              return;
            }
            setDraft("");
            openClaraAgentNewFloatChat();
          }}
        >
          <ClaraMark className="clara-agent-launcher-mark clara-agent-mark brand-mark" />
        </m.button>
      ) : null}

      {floating && pos ? (
        <m.aside
          key="clara-agent-float"
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Agente"
          aria-modal={false}
          style={{
            left: pos.left,
            top: pos.top,
            transformOrigin: "bottom right",
          }}
          className={cn(
            "clara-agent-float pointer-events-auto fixed z-[80] flex flex-col overflow-hidden",
            dragging && "clara-agent-float-dragging",
          )}
          initial={
            reduceMotion ? false : { opacity: 0, scale: 0.9, y: 18 }
          }
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={
            reduceMotion
              ? undefined
              : { opacity: 0, scale: 0.94, y: 12 }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 30, mass: 0.78 }
          }
        >
          <div className="clara-agent-float-body">
            <header
              className={cn(
                "clara-agent-float-topbar",
                dragging ? "is-dragging" : "is-grab",
              )}
              aria-label="Arrastar painel do agente"
              onPointerDown={onFloatDragDown}
              onPointerMove={onFloatDragMove}
              onPointerUp={onFloatDragUp}
              onPointerCancel={onFloatDragUp}
            >
              <ClaraMark className="clara-agent-float-mark clara-agent-mark brand-mark" />
              <ClaraType className="clara-agent-float-title brand-type" />
              <button
                type="button"
                className="clara-agent-float-icon"
                aria-label="Abrir em tela cheia"
                onClick={handleRestoreInline}
              >
                <PictureInPicture size={15} />
              </button>
              <button
                type="button"
                className="clara-agent-float-icon"
                aria-label="Minimizar"
                onClick={() => minimizeClaraAgent()}
              >
                <Minus size={15} />
              </button>
              <button
                type="button"
                className="clara-agent-float-icon"
                aria-label="Fechar painel"
                onClick={handleClose}
              >
                <X size={15} />
              </button>
            </header>

            <div ref={threadRef} className="clara-agent-float-thread">
              {empty ? (
                <div className="clara-agent-float-empty">
                  <ClaraAgentGreeting compact />
                </div>
              ) : (
                <div className="clara-agent-float-rail">
                  {messages.map((message, index) =>
                    message.role === "voice" ? (
                      <div
                        key={message.id}
                        className={cn(
                          "clara-agent-voice-slot",
                          messages[index - 1]?.role === "voice" && "is-tight",
                        )}
                      >
                        <ClaraAgentVoiceRecord
                          event={
                            message.voiceEvent === "started"
                              ? "started"
                              : "ended"
                          }
                          durationMs={message.durationMs}
                          compact
                        />
                      </div>
                    ) : message.role === "user" ? (
                      <div
                        key={message.id}
                        className="clara-agent-user is-compact"
                      >
                        <p className="clara-agent-user-text">{message.text}</p>
                      </div>
                    ) : (
                      <div
                        key={message.id}
                        className="clara-agent-turn is-compact"
                      >
                        <p className="clara-agent-turn-text">{message.text}</p>
                        {message.card ? (
                          <ClaraAgentMessageCard
                            card={message.card}
                            categories={data.categories}
                            compact
                            onPrefill={(prompt) => setDraft(prompt)}
                          />
                        ) : null}
                      </div>
                    ),
                  )}
                  {pending ? (
                    <div className="clara-agent-turn is-compact">
                      <ClaraAgentThinking compact />
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="clara-agent-float-composer">
              <form
                ref={composerRef}
                className="clara-agent-composer-outer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitDraft();
                }}
              >
                <div className="clara-agent-composer-inner">
                  <Textarea
                    aria-label="Mensagem para a Clara"
                    className="clara-agent-composer-input is-compact"
                    value={draft}
                    rows={1}
                    autoResize
                    placeholder="Pergunte ou digite /help"
                    onValueChange={(value) => setDraft(String(value))}
                    onSubmit={() => {
                      void submitDraft();
                    }}
                    submitShortcut="enter"
                  />
                  <div className="clara-agent-composer-toolbar">
                    <ClaraAgentComposerPlus
                      disabled={pending}
                      onPrefill={(prompt) => setDraft(prompt)}
                    />
                    <ClaraAgentComposerSend
                      draft={draft}
                      pending={pending}
                      voiceMode={voiceMode}
                      onToggleVoice={() => toggleClaraVoiceMode()}
                    />
                  </div>
                </div>
              </form>
            </div>
          </div>
        </m.aside>
      ) : null}

    </AnimatePresence>,
    portalHost,
  );
}
