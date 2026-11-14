// Adapted from TUFFUI Stat Grid · MIT License · Copyright (c) 2026 TUFFUI contributors
"use client";

import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FinanceSurface } from "./finance-surface";
import { ShellHeader } from "./surface";

export function StatCard({
  label,
  value,
  icon,
  visual,
  tone,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: Icon;
  /** Chart or other visual between the label and the value. */
  visual?: ReactNode;
  tone?: string;
  hint?: string;
}) {
  if (visual) {
    return (
      <FinanceSurface
        className={cn("mini-stat tuff-stat tuff-stat-with-chart")}
      >
        <div className="tuff-stat-heading">
          <p>{label}</p>
        </div>
        <div className={`tuff-stat-chart ${tone || "neutral"}`}>{visual}</div>
        <strong className="tuff-stat-value">{value}</strong>
        {hint ? <p className="tuff-stat-hint">{hint}</p> : null}
      </FinanceSurface>
    );
  }

  return (
    <FinanceSurface
      className="mini-stat tuff-stat"
      header={
        <ShellHeader as="h2" icon={icon} title={label} subtitle={hint} />
      }
    >
      <strong className="tuff-stat-value">{value}</strong>
    </FinanceSurface>
  );
}
