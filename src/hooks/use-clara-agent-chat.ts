"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Mutate } from "@/components/finance-form";
import { getClaraAgent } from "@/lib/clara-agent-bridge";
import { completeGoalWithAgentCursor } from "@/lib/clara-agent-cursor";
import { previewSidebarAgentPress } from "@/lib/clara-agent-sidebar-press";
import {
  appendClaraChatMessages,
  getClaraAgentStore,
  setClaraChatMessages,
  setClaraLastUndo,
  setClaraPending,
  setClaraSuggestions,
  subscribeClaraAgentStore,
  type ClaraChatMessage,
} from "@/lib/clara-chat-session";
import {
  runClaraMock,
  wantsClearChat,
  type ClaraView,
} from "@/lib/clara-mock-agent";
import type { FinanceData } from "@/lib/types";

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** After UI SDK nav, put keyboard focus back on the PiP composer. */
function focusClaraPipComposer() {
  if (typeof document === "undefined") return;
  if (getClaraAgentStore().presentation !== "float") return;
  const pip = document.querySelector(
    ".clara-agent-float textarea[aria-label='Mensagem para a Clara']",
  );
  if (pip instanceof HTMLTextAreaElement) {
    pip.focus({ preventScroll: true });
  }
}

async function restorePipFocusAfterNav() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 120));
  focusClaraPipComposer();
  // SDK / route paint can steal focus once more — nudge again.
  await new Promise((resolve) => setTimeout(resolve, 180));
  focusClaraPipComposer();
}

export function useClaraAgentStore() {
  return useSyncExternalStore(
    subscribeClaraAgentStore,
    getClaraAgentStore,
    getClaraAgentStore,
  );
}

type SendOptions = {
  data: FinanceData;
  currentView: ClaraView;
  onNavigate: (view: ClaraView) => void;
  mutate: Mutate;
};

export function useClaraAgentChat({
  data,
  currentView,
  onNavigate,
  mutate,
}: SendOptions) {
  const store = useClaraAgentStore();

  const runUiSteps = useCallback(
    async (
      steps: { ref: string; action: string; args?: unknown[] }[] | undefined,
    ) => {
      if (!steps?.length) return;
      try {
        for (const step of steps) {
          const release =
            step.action === "press"
              ? await previewSidebarAgentPress(step.ref)
              : undefined;
          try {
            await getClaraAgent().act({ steps: [step] });
          } finally {
            await release?.();
          }
        }
      } catch {
        // Best-effort for the mock bridge.
      }
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setClaraChatMessages([]);
    setClaraSuggestions([]);
    setClaraLastUndo(null);
    setClaraPending(false);
  }, []);

  const send = useCallback(
    async (raw: string): Promise<string | null> => {
      const text = raw.trim();
      if (!text || store.pending) return null;
      if (wantsClearChat(text)) {
        clearMessages();
        return null;
      }
      setClaraSuggestions([]);
      const userMessage: ClaraChatMessage = {
        id: nextId(),
        role: "user",
        text,
      };
      appendClaraChatMessages(userMessage);
      setClaraPending(true);
      try {
        const result = await runClaraMock({
          message: text,
          data,
          currentView,
          lastUndo: store.lastUndo,
        });
        const assistantMessage: ClaraChatMessage = {
          id: nextId(),
          role: "assistant",
          text: result.reply,
          card: result.card,
        };
        appendClaraChatMessages(assistantMessage);

        const changingView = Boolean(
          result.view && result.view !== currentView,
        );
        // Prefer UI SDK press on the nav control; fall back to React navigate.
        if (result.steps?.length) {
          if (changingView) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
          await runUiSteps(result.steps);
          if (changingView && result.view) {
            onNavigate(result.view);
          }
        } else if (changingView && result.view) {
          onNavigate(result.view);
        }

        const completeAction =
          result.action?.type === "complete-goal" ? result.action : null;
        if (completeAction) {
          // Wait for Metas only when we just navigated there.
          await new Promise((resolve) =>
            setTimeout(resolve, changingView ? 450 : 80),
          );
          const goal = data.goals.find(
            (row) => row.id === completeAction.goalId,
          );
          if (goal && !goal.completed) {
            const ok = await completeGoalWithAgentCursor({
              id: goal.id,
              name: goal.name,
            });
            if (!ok) {
              appendClaraChatMessages({
                id: nextId(),
                role: "assistant",
                text: "Não consegui concluir a meta agora, meu bem. Tenta de novo pela tela de Metas.",
              });
            }
          }
        }

        if (result.action?.type === "undo") {
          const last = store.lastUndo;
          if (last?.type === "complete-goal") {
            await new Promise((resolve) => setTimeout(resolve, 350));
            const goal = data.goals.find((row) => row.id === last.goalId);
            if (goal?.completed) {
              try {
                await mutate("goals", { ...goal, completed: false }, "PATCH");
                setClaraLastUndo(null);
                appendClaraChatMessages({
                  id: nextId(),
                  role: "assistant",
                  text: `Pronto: “${last.label}” voltou pra ativas.`,
                });
              } catch {
                appendClaraChatMessages({
                  id: nextId(),
                  role: "assistant",
                  text: "Não consegui desfazer agora, meu bem. Olha na tela de Metas.",
                });
              }
            } else {
              setClaraLastUndo(null);
              appendClaraChatMessages({
                id: nextId(),
                role: "assistant",
                text: "Essa meta já não estava concluída. Limpei o desfazer.",
              });
            }
          } else {
            setClaraLastUndo(null);
          }
        }

        if (
          changingView ||
          result.steps?.length ||
          result.action?.type === "complete-goal" ||
          result.action?.type === "undo"
        ) {
          await restorePipFocusAfterNav();
        }

        return result.reply;
      } finally {
        setClaraPending(false);
      }
    },
    [
      clearMessages,
      currentView,
      data,
      mutate,
      onNavigate,
      runUiSteps,
      store.lastUndo,
      store.pending,
    ],
  );

  return { ...store, send, clearMessages };
}
