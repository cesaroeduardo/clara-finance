// Adapted from TUFFUI Chart Card (SVG/Motion) · MIT License · Copyright (c) 2026 TUFFUI contributors
"use client";
import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function BudgetGauge({
  value,
  color,
  children,
}: {
  value: number;
  color: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const progress = Math.max(0, Math.min(1, value));
  return (
    <div className="budget-gauge">
      <svg viewBox="0 0 260 175" aria-hidden="true">
        <path
          d="M 18 150 A 114 114 0 1 1 242 150"
          fill="none"
          stroke="var(--control-surface)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <m.path
          d="M 18 150 A 114 114 0 1 1 242 150"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: progress }}
          transition={{ duration: reduce ? 0 : 0.8, ease: [0.23, 1, 0.32, 1] }}
        />
      </svg>
      <div className="budget-gauge-value">{children}</div>
    </div>
  );
}
