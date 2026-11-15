"use client";

import { ArrowUp, Waveform, X } from "@/components/icons";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ClaraAgentComposerSendProps = {
  draft: string;
  pending?: boolean;
  voiceMode: boolean;
  onToggleVoice: () => void;
};

export function ClaraAgentComposerSend({
  draft,
  pending = false,
  voiceMode,
  onToggleVoice,
}: ClaraAgentComposerSendProps) {
  const reduceMotion = useReducedMotion();
  const hasText = Boolean(draft.trim());
  const mode = hasText ? "send" : voiceMode ? "close" : "voice";

  return (
    <Button
      type={hasText ? "submit" : "button"}
      aria-label={
        hasText ? "Enviar" : voiceMode ? "Encerrar modo voz" : "Modo voz"
      }
      size="icon"
      variant={mode === "close" ? "quiet" : "default"}
      disabled={pending && hasText}
      className={cn(
        "clara-agent-composer-send",
        mode === "voice" && "clara-agent-composer-send-voice",
        mode === "close" && "clara-agent-composer-send-close",
      )}
      onClick={(event) => {
        if (hasText) return;
        event.preventDefault();
        onToggleVoice();
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={mode}
          className="clara-agent-composer-send-icon"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.12 }}
        >
          {mode === "send" ? (
            <ArrowUp size={16} weight="bold" aria-hidden />
          ) : mode === "close" ? (
            <X size={16} weight="bold" aria-hidden />
          ) : (
            <Waveform size={18} weight="regular" aria-hidden />
          )}
        </m.span>
      </AnimatePresence>
    </Button>
  );
}
