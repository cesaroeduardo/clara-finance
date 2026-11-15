"use client";

import { WarningCircle } from "@/components/icons";
import { ClaraAgentRichCard } from "@/components/clara-agent-rich-card";
import type { ClaraPendingBillsCard } from "@/lib/clara-agent-insights";
import { dateLabel, money } from "@/lib/format";
import { cn } from "@/lib/utils";

type ClaraAgentPendingCardProps = {
  card: ClaraPendingBillsCard;
  compact?: boolean;
  className?: string;
};

export function ClaraAgentPendingCard({
  card,
  compact = false,
  className,
}: ClaraAgentPendingCardProps) {
  return (
    <ClaraAgentRichCard
      className={className}
      compact={compact}
      icon={WarningCircle}
      title="A pagar"
      subtitle={card.periodLabel}
      aside={
        <strong className="clara-agent-rich-aside">{money(card.total)}</strong>
      }
    >
      <dl className={cn("clara-agent-rich-stats", compact && "is-compact")}>
        <div>
          <dt>Total</dt>
          <dd>{money(card.total)}</dd>
        </div>
        <div>
          <dt>Contas</dt>
          <dd>{card.count}</dd>
        </div>
      </dl>
      {card.bills.length > 0 ? (
        <div className="clara-agent-rich-list">
          <p className="clara-agent-rich-list-label">Próximas</p>
          <ul>
            {card.bills.map((row) => (
              <li key={row.id}>
                <span>
                  {row.description}
                  <em className="clara-agent-rich-meta">
                    {" · "}
                    {dateLabel(row.date, { year: true })}
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
