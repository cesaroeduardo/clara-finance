import type { ClaraAgentCard } from "@/lib/clara-agent-insights";
import type {
  ClaraSuggestion,
  ClaraUndoEntry,
} from "@/lib/clara-mock-agent";

type ChatRole = "user" | "assistant";

export type ClaraChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  card?: ClaraAgentCard;
};

/** inline = página Agente · float = PiP · minimized = pílula */
export type ClaraPresentation = "inline" | "float" | "minimized";

export type ClaraAgentStore = {
  messages: ClaraChatMessage[];
  suggestions: ClaraSuggestion[];
  presentation: ClaraPresentation;
  pending: boolean;
  voiceMode: boolean;
  lastUndo: ClaraUndoEntry | null;
};

let store: ClaraAgentStore = {
  messages: [],
  suggestions: [],
  presentation: "inline",
  pending: false,
  voiceMode: false,
  lastUndo: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function patch(partial: Partial<ClaraAgentStore>) {
  store = { ...store, ...partial };
  emit();
}

export function getClaraAgentStore() {
  return store;
}

export function subscribeClaraAgentStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getClaraChatMessages() {
  return store.messages;
}

export function setClaraChatMessages(next: ClaraChatMessage[]) {
  patch({ messages: next });
}

export function appendClaraChatMessages(...rows: ClaraChatMessage[]) {
  const messages = [...store.messages, ...rows];
  patch({ messages });
  return messages;
}

export function setClaraSuggestions(next: ClaraSuggestion[]) {
  patch({ suggestions: next });
}

export function setClaraPending(pending: boolean) {
  patch({ pending });
}

export function setClaraPresentation(presentation: ClaraPresentation) {
  patch({ presentation });
}

/** Abre PiP se já houver conversa. */
export function dockClaraAgentToFloat() {
  if (store.messages.length === 0 && !store.pending) return false;
  patch({ presentation: "float" });
  return true;
}

export function minimizeClaraAgent() {
  if (store.presentation === "inline" && store.messages.length === 0) {
    return false;
  }
  patch({ presentation: "minimized" });
  return true;
}

export function expandClaraAgentFloat() {
  patch({ presentation: "float" });
}

export function restoreClaraAgentInline() {
  patch({ presentation: "inline" });
}

export function closeClaraAgentFloat() {
  patch({ presentation: "inline" });
}

/** Limpa a conversa e abre o PiP para um chat novo. */
export function openClaraAgentNewFloatChat() {
  patch({
    messages: [],
    suggestions: [],
    pending: false,
    voiceMode: false,
    presentation: "float",
    lastUndo: null,
  });
}

export function setClaraLastUndo(lastUndo: ClaraUndoEntry | null) {
  patch({ lastUndo });
}

export function getClaraLastUndo() {
  return store.lastUndo;
}

export function setClaraVoiceMode(voiceMode: boolean) {
  patch({ voiceMode });
}

export function toggleClaraVoiceMode() {
  patch({ voiceMode: !store.voiceMode });
}

export function claraAgentHasStarted() {
  return store.messages.length > 0 || store.pending;
}
