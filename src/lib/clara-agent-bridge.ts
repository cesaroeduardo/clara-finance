"use client";

import {
  agentTools,
  createAgent,
  registerTools,
  type AgentAction,
} from "@ui-sdk/react/agent";

type ClaraAgent = ReturnType<typeof createAgent>;

let agent: ClaraAgent | null = null;
let unregisterTools: (() => void) | null = null;

function askPerson(message: string, signal: AbortSignal) {
  if (typeof window === "undefined") return false;
  if (signal.aborted) return false;
  return window.confirm(message);
}

function allowStep(step: AgentAction, context: { signal: AbortSignal }) {
  if (!step.confirm) return true;
  return askPerson(step.confirm, context.signal);
}

/** Bridge ui-sdk: create once on the client before the page uses it. */
export function getClaraAgent() {
  if (typeof window === "undefined") {
    throw new Error("A bridge da Clara só existe no navegador.");
  }
  if (!agent) {
    agent = createAgent({ allow: allowStep });
  }
  return agent;
}

/** Publica snapshot/act/query no WebMCP do browser, se existir. */
export function mountClaraAgentTools() {
  const bridge = getClaraAgent();
  unregisterTools?.();
  unregisterTools = registerTools(bridge, { allow: () => true });
  return () => {
    unregisterTools?.();
    unregisterTools = null;
  };
}

export { agentTools };
export type { AgentAction, AgentStep } from "@ui-sdk/react/agent";
