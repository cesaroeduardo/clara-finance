"use client";

import { ChartLineUp } from "@phosphor-icons/react";
import { ClaraAgentRichCard } from "@/components/clara-agent-rich-card";
import type { ClaraNetWorthCard } from "@/lib/clara-agent-insights";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type ClaraAgentWorthCardProps = {
  card: ClaraNetWorthCard;
  compact?: boolean;
  className?: string;
};

export function ClaraAgentWorthCard({
  card,
  compact = false,
  className,
}: ClaraAgentWorthCardProps) {
  const changeLabel =
    card.change === 0
      ? "Sem variação"
      : card.change > 0
        ? `+${money(card.change)}`
        : `−${money(Math.abs(card.change))}`;

  return (
    <ClaraAgentRichCard
      className={className}
      compact={compact}
      icon={ChartLineUp}
      title="Patrimônio"
      subtitle="Contas + investimentos"
      aside={
        <span
          className={cn(
            "clara-agent-rich-change",
            card.change > 0 && "is-up",
            card.change < 0 && "is-down",
          )}
        >
          {changeLabel}
        </span>
      }
    >
      <p className="clara-agent-rich-hero">{money(card.current)}</p>
      <dl className={cn("clara-agent-rich-stats", compact && "is-compact")}>
        <div>
          <dt>Contas</dt>
          <dd>{money(card.accountsTotal)}</dd>
        </div>
        <div>
          <dt>Investimentos</dt>
          <dd>{money(card.investmentsTotal)}</dd>
        </div>
        <div>
          <dt>vs. mês passado</dt>
          <dd>{changeLabel}</dd>
        </div>
      </dl>
    </ClaraAgentRichCard>
  );
}
