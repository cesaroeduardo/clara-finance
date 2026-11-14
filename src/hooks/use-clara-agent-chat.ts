"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getClaraAgent } from "@/lib/clara-agent-bridge";
import {
  appendClaraChatMessages,
  getClaraAgentStore,
  setClaraChatMessages,
  setClaraPending,
  setClaraSuggestions,
  subscribeClaraAgentStore,
  type ClaraChatMessage,
} from "@/lib/clara-chat-session";
import { runClaraMock, type ClaraView } from "@/lib/clara-mock-agent";
import type { FinanceData } from "@/lib/types";

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
};

export function useClaraAgentChat({
  data,
  currentView,
  onNavigate,
}: SendOptions) {
  const store = useClaraAgentStore();

  const runUiSteps = useCallback(
    async (
      steps: { ref: string; action: string; args?: unknown[] }[] | undefined,
    ) => {
      if (!steps?.length) return;
      try {
        await getClaraAgent().act({ steps });
      } catch {
        // Best-effort for the mock bridge.
      }
    },
    [],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || store.pending) return;
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
        });
        const assistantMessage: ClaraChatMessage = {
          id: nextId(),
          role: "assistant",
          text: result.reply,
          card: result.card,
        };
        appendClaraChatMessages(assistantMessage);
        setClaraSuggestions(result.suggestions ?? []);

        if (result.view && result.view !== currentView) {
          await new Promise((resolve) => setTimeout(resolve, 450));
          onNavigate(result.view);
          await new Promise((resolve) => setTimeout(resolve, 120));
          await runUiSteps(result.steps);
        } else {
          await runUiSteps(result.steps);
        }
      } finally {
        setClaraPending(false);
      }
    },
    [currentView, data, onNavigate, runUiSteps, store.pending],
  );

  const clearMessages = useCallback(() => {
    setClaraChatMessages([]);
    setClaraSuggestions([]);
  }, []);

  return { ...store, send, clearMessages };
}
