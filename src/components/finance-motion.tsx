"use client";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { CaretDown, IconContext } from "@phosphor-icons/react";
import {
  AnimatePresence,
  domMax,
  LayoutGroup,
  LazyMotion,
  m,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import { money } from "@/lib/format";
import { roll, showStatic, zeroLike } from "./finance-reel";

// Free Transitions.dev recipes. Sources and license: docs/microinteractions.md.
const easeOutQuint = [0.22, 1, 0.36, 1] as const;
const easeInOut = [0.42, 0, 0.58, 1] as const;

export function FinanceMotion({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: "light" }}>
      <LazyMotion features={domMax} strict>
        <MotionConfig
          reducedMotion="user"
          transition={{ duration: 0.25, ease: easeOutQuint }}
        >
          <LayoutGroup id="clara">{children}</LayoutGroup>
        </MotionConfig>
      </LazyMotion>
    </IconContext.Provider>
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
export function NavAccordion({
  open,
  id,
  label,
  onToggle,
  children,
}: {
  open: boolean;
  id: string;
  label: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const duration = reduced ? 0 : open ? 0.25 : 0.15;
  return (
    <div className="nav-section">
      <button
        type="button"
        className="nav-label"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span>{label}</span>
        <m.span
          className="nav-label-chevron"
          aria-hidden="true"
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration, ease: easeOutQuint }}
        >
          <CaretDown size={12} />
        </m.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <m.div
            key={id}
            id={id}
            className="nav-section-panel"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration, ease: easeOutQuint },
              opacity: { duration: reduced ? 0 : 0.15, ease: easeOutQuint },
            }}
          >
            <nav aria-label={label}>{children}</nav>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
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

export function SpinningAmount({
  value,
  currency = "BRL",
  prefix = "",
  className = "",
}: {
  value: number;
  currency?: string;
  prefix?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const formatted = prefix + money(value, currency);
    if (reduced) {
      showStatic(el, formatted);
      previous.current = formatted;
      return;
    }
    const from = previous.current ?? zeroLike(formatted);
    previous.current = formatted;
    return roll(el, from, formatted);
  }, [value, currency, prefix, reduced]);

  return (
    <span
      ref={ref}
      className={`t-reel amount ${className}`.trim()}
      aria-live="polite"
    />
  );
}

export function PageEnter({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.classList.add("is-shown");
      return;
    }
    el.classList.remove("is-shown");
    void el.offsetHeight;
    el.classList.add("is-shown");
  }, [reduced]);

  return (
    <div
      ref={ref}
      className={`page-enter${reduced ? " is-shown" : ""}`}
    >
      {children}
    </div>
  );
}
