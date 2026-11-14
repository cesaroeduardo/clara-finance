// Adapted from TUFFUI Stat Grid · MIT License · Copyright (c) 2026 TUFFUI contributors
"use client";

import type { ReactNode } from "react";
import { FinanceSurface } from "./finance-surface";
import { IconTile } from "./surface";

export function StatCard({
  label,
  value,
  icon,
  tone,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: string;
  hint?: string;
}) {
  return (
    <FinanceSurface className="mini-stat tuff-stat">
      <div className="tuff-stat-heading">
        <p>{label}</p>
        <IconTile className={`tuff-stat-icon ${tone || "neutral"}`}>
          {icon}
        </IconTile>
      </div>
      <strong className="tuff-stat-value">{value}</strong>
      {hint && <p className="tuff-stat-hint">{hint}</p>}
    </FinanceSurface>
  );
}
