"use client";

import { ArrowsClockwise } from "@/components/icons";
import { ClaraAgentRichCard } from "@/components/clara-agent-rich-card";
import type { ClaraRecurringsCard } from "@/lib/clara-agent-insights";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type ClaraAgentRecurringCardProps = {
  card: ClaraRecurringsCard;
  compact?: boolean;
  className?: string;
};

export function ClaraAgentRecurringCard({
  card,
  compact = false,
  className,
}: ClaraAgentRecurringCardProps) {
  return (
    <ClaraAgentRichCard
      className={className}
      compact={compact}
      icon={ArrowsClockwise}
      title="Recorrentes"
      subtitle={card.monthLabel}
      aside={
        <strong className="clara-agent-rich-aside">{money(card.total)}</strong>
      }
    >
      <dl className={cn("clara-agent-rich-stats", compact && "is-compact")}>
        <div>
          <dt>Fixos</dt>
          <dd>{money(card.fixedTotal)}</dd>
        </div>
        <div>
          <dt>Parcelas</dt>
          <dd>{money(card.installmentTotal)}</dd>
        </div>
        <div>
          <dt>Ainda falta</dt>
          <dd>{money(card.remaining)}</dd>
        </div>
      </dl>
      {card.topItems.length > 0 ? (
        <div className="clara-agent-rich-list">
          <p className="clara-agent-rich-list-label">Principais</p>
          <ul>
            {card.topItems.map((row) => (
              <li key={`${row.id}-${row.description}`}>
                <span>
                  {row.description}
                  <em className="clara-agent-rich-meta">
                    {" · "}
                    {row.type === "fixed" ? "fixo" : "parcela"}
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
