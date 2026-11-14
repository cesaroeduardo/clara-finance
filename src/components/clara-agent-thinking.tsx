"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const STATES = [
  "Tricotando…",
  "Enrolando o fio…",
  "Ajustando os pontos…",
] as const;

const SIZER = "Ajustando os pontos…";

type ClaraAgentThinkingProps = {
  className?: string;
  compact?: boolean;
};

export function ClaraAgentThinking({
  className,
  compact = false,
}: ClaraAgentThinkingProps) {
  const reduceMotion = useReducedMotion();
  const boxRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduceMotion) return;
    const box = boxRef.current;
    if (!box) return;

    let live = box.querySelector<HTMLSpanElement>(".t-think-text");
    if (!live) return;

    let index = 0;
    let holdTimer = 0;
    let swapTimer = 0;
    let gapTimer = 0;
    let cancelled = false;

    const ms = (name: string, fallback: number) => {
      const value = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(name),
      );
      return Number.isFinite(value) ? value : fallback;
    };

    const cycle = () => {
      holdTimer = window.setTimeout(() => {
        if (cancelled || !live) return;
        const swap = ms("--think-swap", 150);
        const gap = ms("--think-gap", 50);
        const leaving = live;
        index = (index + 1) % STATES.length;
        leaving.classList.add("is-exit");

        const next = document.createElement("span");
        next.className = "t-think-text is-enter-start";
        next.textContent = STATES[index];
        next.setAttribute("data-text", STATES[index]);
        next.setAttribute("aria-hidden", "true");
        box.appendChild(next);
        live = next;

        const release = () => {
          if (cancelled) return;
          void next.offsetWidth;
          next.classList.remove("is-enter-start");
        };
        if (gap > 0) gapTimer = window.setTimeout(release, gap);
        else release();

        swapTimer = window.setTimeout(() => {
          leaving.remove();
          if (!cancelled) cycle();
        }, swap + gap);
      }, ms("--think-hold", 2000));
    };

    cycle();

    return () => {
      cancelled = true;
      window.clearTimeout(holdTimer);
      window.clearTimeout(swapTimer);
      window.clearTimeout(gapTimer);
    };
  }, [reduceMotion]);

  return (
    <span
      ref={boxRef}
      className={cn(
        "t-think clara-agent-thinking",
        compact && "is-compact",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label="Tricotando"
    >
      <span className="t-think-sizer" aria-hidden="true">
        {SIZER}
      </span>
      <span className="t-think-text" data-text={STATES[0]}>
        {STATES[0]}
      </span>
    </span>
  );
}
