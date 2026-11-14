"use client";
import { useContext, useEffect, useId, useRef } from "react";
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
import { RollingNumber } from "@/components/ui/rolling-number";
import { PrivacyContext } from "./finance-privacy";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";

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
      <SegmentedControl
        className="type-switch motion-segments"
        aria-label={label}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        {options.map(([option, text]) => (
          <SegmentedControlItem
            value={option}
            key={option}
            type="button"
            data-active={value === option}
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
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
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
export function AnimatedLabel({
  value,
  direction = 1,
}: {
  value: string;
  /** 1 = entra de baixo (avançar); -1 = entra de cima (voltar) */
  direction?: 1 | -1;
}) {
  const reduced = useReducedMotion();
  return (
    <span className="animated-label">
      <span className="sr-only">{value}</span>
      <AnimatePresence initial={false} mode="wait" custom={direction}>
        <m.span
          key={value}
          className="animated-label-value"
          aria-hidden="true"
          custom={direction}
          variants={{
            initial: (dir: 1 | -1) => ({
              opacity: 0,
              y: reduced ? 0 : 8 * dir,
              filter: reduced ? "blur(0px)" : "blur(2px)",
            }),
            animate: { opacity: 1, y: 0, filter: "blur(0px)" },
            exit: (dir: 1 | -1) => ({
              opacity: 0,
              y: reduced ? 0 : -8 * dir,
              filter: reduced ? "blur(0px)" : "blur(2px)",
            }),
          }}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: reduced ? 0 : 0.18, ease: easeInOut }}
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
  const hidden = useContext(PrivacyContext);
  if (hidden)
    return <span className={`amount ${className}`.trim()}>••••••</span>;
  return (
    <RollingNumber
      value={prefix + money(value, currency)}
      className={`t-reel amount ${className}`.trim()}
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
    <div ref={ref} className={`page-enter${reduced ? " is-shown" : ""}`}>
      {children}
    </div>
  );
}
