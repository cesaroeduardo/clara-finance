"use client";

import { ChartPieSlice } from "@phosphor-icons/react";
import { ClaraAgentRichCard } from "@/components/clara-agent-rich-card";
import type { ClaraCategorySpendCard } from "@/lib/clara-agent-insights";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type ClaraAgentCategoryCardProps = {
  card: ClaraCategorySpendCard;
  compact?: boolean;
  className?: string;
};

export function ClaraAgentCategoryCard({
  card,
  compact = false,
  className,
}: ClaraAgentCategoryCardProps) {
  const title = card.focusCategory
    ? card.focusCategory
    : "Por categoria";

  return (
    <ClaraAgentRichCard
      className={className}
      compact={compact}
      icon={ChartPieSlice}
      title={title}
      subtitle={card.monthLabel}
      aside={
        <strong className="clara-agent-rich-aside">{money(card.total)}</strong>
      }
    >
      {card.focusCategory ? (
        <p className="clara-agent-rich-hero">{money(card.total)}</p>
      ) : (
        <dl className={cn("clara-agent-rich-stats", compact && "is-compact")}>
          <div>
            <dt>Total</dt>
            <dd>{money(card.total)}</dd>
          </div>
          <div>
            <dt>Categorias</dt>
            <dd>{card.categories.length}</dd>
          </div>
        </dl>
      )}
      {card.categories.length > 0 ? (
        <div className="clara-agent-rich-list">
          <p className="clara-agent-rich-list-label">
            {card.focusCategory ? "Detalhe" : "Maiores"}
          </p>
          <ul>
            {card.categories.map((row) => (
              <li key={row.name}>
                <span>
                  {row.name}
                  <em className="clara-agent-rich-meta">
                    {" · "}
                    {row.sharePercent}%
                  </em>
                </span>
                <strong>{money(row.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ClaraAgentRichCard>
  );
}
