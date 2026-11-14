"use client";

import { Gauge } from "@phosphor-icons/react";
import { ClaraAgentRichCard } from "@/components/clara-agent-rich-card";
import type { ClaraPaceCard } from "@/lib/clara-agent-insights";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type ClaraAgentPaceCardProps = {
  card: ClaraPaceCard;
  compact?: boolean;
  className?: string;
};

export function ClaraAgentPaceCard({
  card,
  compact = false,
  className,
}: ClaraAgentPaceCardProps) {
  return (
    <ClaraAgentRichCard
      className={className}
      compact={compact}
      icon={Gauge}
      title="Ritmo do mês"
      subtitle={card.monthLabel}
      aside={
        <strong className="clara-agent-rich-aside">
          {money(card.dailyAllowance)}/dia
        </strong>
      }
    >
      <p className="clara-agent-rich-hero">{money(card.dailyAllowance)}</p>
      <p className="clara-agent-rich-meta">por dia · {card.daysLeft} dia(s) restantes</p>
      <dl className={cn("clara-agent-rich-stats", compact && "is-compact")}>
        <div>
          <dt>Usado</dt>
          <dd>{card.limitUsedPercent}%</dd>
        </div>
        <div>
          <dt>Gasto</dt>
          <dd>{money(card.spentToDate)}</dd>
        </div>
        <div>
          <dt>Limite</dt>
          <dd>{money(card.monthlyLimit)}</dd>
        </div>
      </dl>
      {(card.openInvoices > 0 || card.projectedEndSpend > 0) && (
        <dl className={cn("clara-agent-rich-stats", compact && "is-compact")}>
          {card.openInvoices > 0 ? (
            <div>
              <dt>Faturas abertas</dt>
              <dd>{money(card.openInvoices)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Projeção</dt>
            <dd>{money(card.projectedEndSpend)}</dd>
          </div>
          <div>
            <dt>Resta</dt>
            <dd>{money(card.remaining)}</dd>
          </div>
        </dl>
      )}
    </ClaraAgentRichCard>
  );
}
