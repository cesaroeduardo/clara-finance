"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Bank,
  ChartLineUp,
  Gauge,
  PictureInPicture,
  Receipt,
  SquaresFour,
} from "@phosphor-icons/react";
import { m, useReducedMotion } from "motion/react";
import { ClaraAgentComposerPlus } from "@/components/clara-agent-composer-plus";
import { ClaraAgentComposerSend } from "@/components/clara-agent-composer-send";
import { ClaraAgentGreeting } from "@/components/clara-agent-greeting";
import { ClaraAgentMessageCard } from "@/components/clara-agent-message-card";
import { ClaraAgentThinking } from "@/components/clara-agent-thinking";
import { ClaraMark } from "@/components/clara-mark";
import { ClaraType } from "@/components/clara-type";
import { Textarea } from "@/components/ui/textarea";
import { useClaraAgentChat } from "@/hooks/use-clara-agent-chat";
import {
  dockClaraAgentToFloat,
  toggleClaraVoiceMode,
} from "@/lib/clara-chat-session";
import type { Mutate } from "@/components/finance-form";
import type { ClaraView } from "@/lib/clara-mock-agent";
import type { FinanceData } from "@/lib/types";
import { cn } from "@/lib/utils";

type ClaraAgentViewProps = {
  data: FinanceData;
  currentView: ClaraView;
  onNavigate: (view: ClaraView) => void;
  mutate: Mutate;
};

const THREAD_TO_COMPOSER_GAP = 28;
const DOCK_SPRING = {
  type: "spring" as const,
  stiffness: 320,
  damping: 34,
  mass: 0.9,
};

const EMPTY_STARTERS: {
  id: string;
  label: string;
  prompt: string;
  icon: typeof Bank;
}[] = [
  {
    id: "balances",
    label: "Saldos",
    prompt: "Quanto tenho nas contas?",
    icon: Bank,
  },
  {
    id: "worth",
    label: "Patrimônio",
    prompt: "Qual meu patrimônio?",
    icon: ChartLineUp,
  },
  {
    id: "pace",
    label: "Ritmo",
    prompt: "Posso gastar quanto hoje?",
    icon: Gauge,
  },
  {
    id: "biggest",
    label: "Maior gasto",
    prompt: "Qual foi o meu maior gasto este mês?",
    icon: Receipt,
  },
  {
    id: "accounts",
    label: "Abrir Contas",
    prompt: "Abre Contas",
    icon: SquaresFour,
  },
];

export function ClaraAgentView({
  data,
  currentView,
  onNavigate,
  mutate,
}: ClaraAgentViewProps) {
  const reduceMotion = useReducedMotion();
  const { messages, pending, presentation, voiceMode, send } =
    useClaraAgentChat({ data, currentView, onNavigate, mutate });
  const [draft, setDraft] = useState("");
  const [composerH, setComposerH] = useState(88);
  const [liftY, setLiftY] = useState(0);
  const [startersVisible, setStartersVisible] = useState(true);

  const stageRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inline = presentation === "inline";
  const empty = (messages.length === 0 && !pending) || !inline;

  useEffect(() => {
    if (empty) {
      setStartersVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setStartersVisible(false), 480);
    return () => window.clearTimeout(timer);
  }, [empty]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const composer = composerRef.current;
    if (!stage || !composer) return;
    const measure = () => {
      const nextH = composer.offsetHeight;
      setComposerH(nextH);
      setLiftY(-(Math.max(stage.clientHeight - nextH, 0) / 2));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(composer);
    return () => ro.disconnect();
  }, [empty, startersVisible, draft]);

  useEffect(() => {
    const node = threadRef.current;
    if (!node || typeof node.scrollTo !== "function") return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [messages, pending, reduceMotion, inline]);

  function focusComposer() {
    const node = composerRef.current?.querySelector("textarea");
    node?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!inline) return;
    const frame = window.requestAnimationFrame(() => focusComposer());
    return () => window.cancelAnimationFrame(frame);
  }, [inline]);

  async function submitDraft() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    requestAnimationFrame(() => focusComposer());
    await send(text);
    focusComposer();
  }

  function openPictureInPicture() {
    if (!dockClaraAgentToFloat()) return;
    onNavigate("dashboard");
  }

  return (
    <div ref={stageRef} className="clara-agent-stage">
      {inline && !empty ? (
        <div className="clara-agent-topbar">
          <div className="clara-agent-topbar-inner">
            <div className="clara-agent-topbar-brand">
              <ClaraMark className="clara-agent-topbar-mark clara-agent-mark brand-mark" />
              <ClaraType className="clara-agent-topbar-title brand-type" />
            </div>
            <button
              type="button"
              className="clara-agent-topbar-action"
              aria-label="Abrir em janela flutuante"
              onClick={openPictureInPicture}
            >
              <PictureInPicture size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {inline && !empty ? (
        <div
          ref={threadRef}
          className="clara-agent-thread"
          style={{ bottom: composerH + THREAD_TO_COMPOSER_GAP }}
          aria-live="polite"
          aria-relevant="additions"
        >
          <div className="clara-agent-rail">
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="clara-agent-user">
                  <p className="clara-agent-user-text">{message.text}</p>
                </div>
              ) : (
                <div key={message.id} className="clara-agent-turn">
                  <p className="clara-agent-turn-text">{message.text}</p>
                  {message.card ? (
                    <ClaraAgentMessageCard
                      card={message.card}
                      categories={data.categories}
                      onPrefill={(prompt) => setDraft(prompt)}
                    />
                  ) : null}
                </div>
              ),
            )}
            {pending ? (
              <div className="clara-agent-turn">
                <ClaraAgentThinking />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <m.div
        ref={composerRef}
        className="clara-agent-composer-dock"
        initial={false}
        animate={{ y: empty ? liftY : 0 }}
        transition={reduceMotion ? { duration: 0 } : DOCK_SPRING}
      >
        {empty ? <ClaraAgentGreeting /> : null}
        <form
          className="clara-agent-composer-shell"
          onSubmit={(event) => {
            event.preventDefault();
            void submitDraft();
          }}
        >
          <div className="clara-agent-composer-outer">
            <div className="clara-agent-composer-inner">
              <Textarea
                aria-label="Mensagem para a Clara"
                className="clara-agent-composer-input"
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
          </div>
        </form>

        {startersVisible ? (
          <div
            role="group"
            aria-label="Sugestões pra começar"
            className={cn(
              "clara-agent-starters",
              empty
                ? "clara-agent-starters-open"
                : "clara-agent-starters-closed",
            )}
            aria-hidden={!empty}
          >
            <div className="clara-agent-starters-row">
              {EMPTY_STARTERS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    tabIndex={empty ? 0 : -1}
                    className="clara-agent-starter"
                    onClick={() => void send(item.prompt)}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </m.div>
    </div>
  );
}
