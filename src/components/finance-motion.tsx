"use client";
import { useId } from "react";
import {
  AnimatePresence,
  domMax,
  LayoutGroup,
  LazyMotion,
  m,
  MotionConfig,
  useReducedMotion,
} from "motion/react";

// Free Transitions.dev recipes. Sources and license: docs/microinteractions.md.
const easeOutQuint = [0.22, 1, 0.36, 1] as const;
const easeInOut = [0.42, 0, 0.58, 1] as const;

export function FinanceMotion({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: 0.25, ease: easeOutQuint }}
      >
        <LayoutGroup id="clara">{children}</LayoutGroup>
      </MotionConfig>
    </LazyMotion>
  );
}
export function NavigationIndicator() {
  const reduced = useReducedMotion();
  return (
    <m.span
      className="nav-indicator"
      layoutId="sidebar-selection"
      aria-hidden="true"
      transition={{ duration: reduced ? 0 : 0.25, ease: easeOutQuint }}
    />
  );
}
export function MotionSegmentedControl({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  label: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <LayoutGroup id={id}>
      <div
        className="type-switch motion-segments"
        role="group"
        aria-label={label}
      >
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            data-active={value === option}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {value === option && (
              <m.span
                layoutId="active-segment"
                className="segment-indicator"
                aria-hidden="true"
                transition={{
                  duration: reduced ? 0 : 0.25,
                  ease: easeOutQuint,
                }}
              />
            )}
            <span>{text}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
export function IconSwap({
  active,
  first,
  second,
}: {
  active: boolean;
  first: React.ReactNode;
  second: React.ReactNode;
}) {
  return (
    <span
      className="t-icon-swap"
      data-state={active ? "b" : "a"}
      aria-hidden="true"
    >
      <span className="t-icon" data-icon="a">
        {first}
      </span>
      <span className="t-icon" data-icon="b">
        {second}
      </span>
    </span>
  );
}
export function AnimatedLabel({ value }: { value: string }) {
  const reduced = useReducedMotion();
  return (
    <span className="animated-label">
      <span className="sr-only">{value}</span>
      <AnimatePresence initial={false} mode="wait">
        <m.span
          key={value}
          className="animated-label-value"
          aria-hidden="true"
          initial={{
            opacity: 0,
            y: reduced ? 0 : 4,
            filter: reduced ? "blur(0px)" : "blur(2px)",
          }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{
            opacity: 0,
            y: reduced ? 0 : -4,
            filter: reduced ? "blur(0px)" : "blur(2px)",
          }}
          transition={{ duration: reduced ? 0 : 0.15, ease: easeInOut }}
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
export function LinkChevron() {
  return (
    <span className="t-learn-chevron" aria-hidden="true">
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path className="t-learn-arm t-learn-arm-top" d="M6 4L10 8" />
        <path className="t-learn-arm t-learn-arm-bot" d="M10 8L6 12" />
      </svg>
    </span>
  );
}
