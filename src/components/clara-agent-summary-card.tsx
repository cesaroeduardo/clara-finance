"use client";

import { ChartBar } from "@/components/icons";
import { ClaraAgentRichCard } from "@/components/clara-agent-rich-card";
import type { ClaraPeriodSummaryCard } from "@/lib/clara-agent-insights";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type ClaraAgentSummaryCardProps = {
  card: ClaraPeriodSummaryCard;
  compact?: boolean;
  className?: string;
};

export function ClaraAgentSummaryCard({
  card,
  compact = false,
  className,
}: ClaraAgentSummaryCardProps) {
  const resultLabel =
    card.balance >= 0
      ? `+${money(card.balance)}`
      : `−${money(Math.abs(card.balance))}`;

  return (
    <ClaraAgentRichCard
      className={className}
      compact={compact}
      icon={ChartBar}
      title="Resumo"
      subtitle={card.periodLabel}
      aside={
        <span
          className={cn(
            "clara-agent-rich-change",
            card.balance > 0 && "is-up",
            card.balance < 0 && "is-down",
          )}
        >
          {resultLabel}
        </span>
      }
    >
      <dl className={cn("clara-agent-rich-stats", compact && "is-compact")}>
        <div>
          <dt>Entradas</dt>
          <dd>{money(card.income)}</dd>
        </div>
        <div>
          <dt>Saídas</dt>
          <dd>{money(card.expenses)}</dd>
        </div>
        <div>
          <dt>Resultado</dt>
          <dd>{resultLabel}</dd>
        </div>
      </dl>
      <dl className={cn("clara-agent-rich-stats", compact && "is-compact")}>
        <div>
          <dt>Pagas</dt>
          <dd>{money(card.paid)}</dd>
        </div>
        <div>
          <dt>Pendentes</dt>
          <dd>{money(card.pending)}</dd>
        </div>
        <div>
          <dt>Lançamentos</dt>
          <dd>{card.transactionCount}</dd>
        </div>
      </dl>
    </ClaraAgentRichCard>
  );
}
