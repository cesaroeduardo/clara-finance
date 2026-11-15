"use client";

/**
 * TTS do modo voz.
 * Voz sintética (XTTS) só se NEXT_PUBLIC_CLARA_XTTS=true e o sidecar estiver no ar.
 * Por padrão: speechSynthesis do browser.
 */

function xttsEnabled() {
  return process.env.NEXT_PUBLIC_CLARA_XTTS === "true";
}

export type SpeakHandle = {
  stop: () => void;
  done: Promise<void>;
  engine: "neural" | "browser";
};

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

/** Respostas longas deixam o TTS lento — fala só o começo; o chat guarda o texto cheio. */
export function speakableVoiceReply(text: string, maxChars = 220): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/(?<=[.!?…])\s+/);
  let out = "";
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part;
    if (out && next.length > maxChars) break;
    out = next;
    if (out.length >= Math.min(120, maxChars)) break;
  }
  if (!out) out = cleaned.slice(0, maxChars);
  if (out.length < cleaned.length && !/[.!?…]$/.test(out)) {
    out = `${out}…`;
  }
  return out;
}

function stopBrowser() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

function stopNeural() {
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

export function stopAllSpeech() {
  stopNeural();
  stopBrowser();
}

async function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return existing;
  await new Promise<void>((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    window.setTimeout(done, 400);
  });
  return window.speechSynthesis.getVoices();
}

function pickPtVoice(voices: SpeechSynthesisVoice[]) {
  const ptBr = voices.filter((v) => /^pt(-br)?$/i.test(v.lang.replace("_", "-")));
  const pt = ptBr.length ? ptBr : voices.filter((v) => v.lang.toLowerCase().startsWith("pt"));
  const pool = pt.length ? pt : voices;
  return (
    pool.find((v) => /maria|francisca|lucia|luciana|female|feminina/i.test(v.name)) ??
    pool[0] ??
    null
  );
}

async function speakNeural(text: string): Promise<SpeakHandle> {
  stopAllSpeech();
  const res = await fetch("/api/clara/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`tts_${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  currentUrl = url;
  const audio = new Audio(url);
  currentAudio = audio;

  let settle!: () => void;
  const done = new Promise<void>((resolve) => {
    settle = resolve;
  });

  audio.onended = () => {
    stopNeural();
    settle();
  };
  audio.onerror = () => {
    stopNeural();
    settle();
  };

  await audio.play();

  return {
    engine: "neural",
    done,
    stop: () => {
      stopNeural();
      settle();
    },
  };
}

async function speakBrowser(text: string): Promise<SpeakHandle> {
  stopAllSpeech();
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return {
      engine: "browser",
      done: Promise.resolve(),
      stop: () => undefined,
    };
  }

  const voices = await ensureVoices();
  let settle!: () => void;
  const done = new Promise<void>((resolve) => {
    settle = resolve;
  });

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  utter.rate = 1.25;
  const voice = pickPtVoice(voices);
  if (voice) utter.voice = voice;
  utter.onend = () => settle();
  utter.onerror = () => settle();
  window.speechSynthesis.speak(utter);

  return {
    engine: "browser",
    done,
    stop: () => {
      stopBrowser();
      settle();
    },
  };
}

/** XTTS só com flag ligada; senão (ou se falhar) usa o browser. */
export async function speakText(text: string): Promise<SpeakHandle> {
  const cleaned = speakableVoiceReply(text);
  if (!cleaned) {
    return {
      engine: "browser",
      done: Promise.resolve(),
      stop: () => undefined,
    };
  }
  if (!xttsEnabled()) {
    return speakBrowser(cleaned);
  }
  try {
    return await speakNeural(cleaned);
  } catch {
    return speakBrowser(cleaned);
  }
}
