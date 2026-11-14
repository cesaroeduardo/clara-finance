"use client";

import { useEffect, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { ClaraMark } from "@/components/clara-mark";
import { cn } from "@/lib/utils";

export const CLARA_AGENT_GREETING =
  "Oi meu neto! Tá economizando certinho? Do que você precisa hoje?";

const BUBBLE_DELAY_MS = 160;
const TYPE_START_MS = 420;
const TYPE_MS_PER_CHAR = 22;

type ClaraAgentGreetingProps = {
  compact?: boolean;
  className?: string;
};

export function ClaraAgentGreeting({
  compact = false,
  className,
}: ClaraAgentGreetingProps) {
  const reduceMotion = useReducedMotion();
  const [typed, setTyped] = useState(
    reduceMotion ? CLARA_AGENT_GREETING : "",
  );
  const [typing, setTyping] = useState(!reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      setTyped(CLARA_AGENT_GREETING);
      setTyping(false);
      return;
    }

    setTyped("");
    setTyping(true);
    let index = 0;
    let intervalId = 0;
    const startId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        index += 1;
        setTyped(CLARA_AGENT_GREETING.slice(0, index));
        if (index >= CLARA_AGENT_GREETING.length) {
          window.clearInterval(intervalId);
          setTyping(false);
        }
      }, TYPE_MS_PER_CHAR);
    }, TYPE_START_MS);

    return () => {
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
    };
  }, [reduceMotion]);

  return (
    <div
      className={cn(
        "clara-agent-greeting",
        compact && "is-compact",
        className,
      )}
    >
      <m.div
        className="clara-agent-greeting-bubble"
        role="status"
        aria-live="polite"
        initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                type: "spring",
                stiffness: 380,
                damping: 28,
                delay: BUBBLE_DELAY_MS / 1000,
              }
        }
      >
        <p>
          {typed}
          {typing ? (
            <span className="clara-agent-greeting-caret" aria-hidden="true" />
          ) : null}
        </p>
        <span className="clara-agent-greeting-tail" aria-hidden="true" />
      </m.div>
      <ClaraMark
        className={cn(
          compact
            ? "clara-agent-float-empty-mark"
            : "clara-agent-empty-mark-icon",
          "clara-agent-mark brand-mark",
        )}
      />
    </div>
  );
}
