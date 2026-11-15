"use client";

import { Bank } from "@/components/icons";
import { ClaraAgentRichCard } from "@/components/clara-agent-rich-card";
import { InstitutionLogo } from "@/components/institution-logo";
import type { ClaraAccountCard } from "@/lib/clara-agent-insights";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type ClaraAgentAccountCardProps = {
  card: ClaraAccountCard;
  compact?: boolean;
  className?: string;
};

export function ClaraAgentAccountCard({
  card,
  compact = false,
  className,
}: ClaraAgentAccountCardProps) {
  return (
    <ClaraAgentRichCard
      className={className}
      compact={compact}
      icon={Bank}
      title={card.name}
      subtitle={`${card.institution} · ${card.channel}`}
      aside={
        <strong className="clara-agent-rich-aside">
          {money(card.balance, card.currency)}
        </strong>
      }
    >
      <div className="clara-agent-rich-row">
        <div className="clara-agent-rich-account-mark is-lg">
          <InstitutionLogo institution={card.institution} size={36} />
        </div>
        <div className="clara-agent-rich-copy">
          <p className="clara-agent-rich-title">{card.name}</p>
          <p className="clara-agent-rich-meta">
            {card.institution} · {card.channel}
          </p>
        </div>
      </div>

      {(card.creditLimit != null || card.availableCreditLimit != null) && (
        <dl className={cn("clara-agent-rich-stats", compact && "is-compact")}>
          {card.creditLimit != null ? (
            <div>
              <dt>Limite</dt>
              <dd>{money(card.creditLimit, card.currency)}</dd>
            </div>
          ) : null}
          {card.availableCreditLimit != null ? (
            <div>
              <dt>Disponível</dt>
              <dd>{money(card.availableCreditLimit, card.currency)}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </ClaraAgentRichCard>
  );
}
