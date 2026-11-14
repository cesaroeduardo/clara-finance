// Adapted from TUFFUI Stat Grid · MIT License · Copyright (c) 2026 TUFFUI contributors
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FinanceSurface } from "./finance-surface";
import { IconTile } from "./surface";

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
  icon?: ReactNode;
  /** Chart or other visual between the label and the value. */
  visual?: ReactNode;
  tone?: string;
  hint?: string;
}) {
  return (
    <FinanceSurface
      className={cn("mini-stat tuff-stat", visual && "tuff-stat-with-chart")}
    >
      <div className="tuff-stat-heading">
        <p>{label}</p>
        {!visual && (
          <IconTile className={`tuff-stat-icon ${tone || "neutral"}`}>
            {icon}
          </IconTile>
        )}
      </div>
      {visual && (
        <div className={`tuff-stat-chart ${tone || "neutral"}`}>{visual}</div>
      )}
      <strong className="tuff-stat-value">{value}</strong>
      {hint && <p className="tuff-stat-hint">{hint}</p>}
    </FinanceSurface>
  );
}
