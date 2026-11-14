"use client";

import { Wallet } from "@phosphor-icons/react";
import { ClaraAgentRichCard } from "@/components/clara-agent-rich-card";
import { InstitutionLogo } from "@/components/institution-logo";
import type { ClaraBalancesCard } from "@/lib/clara-agent-insights";
import { money } from "@/lib/format";

type ClaraAgentBalancesCardProps = {
  card: ClaraBalancesCard;
  compact?: boolean;
  className?: string;
};

export function ClaraAgentBalancesCard({
  card,
  compact = false,
  className,
}: ClaraAgentBalancesCardProps) {
  return (
    <ClaraAgentRichCard
      className={className}
      compact={compact}
      icon={Wallet}
      title="Saldos"
      subtitle={`${card.accounts.length} contas`}
      aside={
        <strong className="clara-agent-rich-aside">
          {money(card.total, card.currency)}
        </strong>
      }
    >
      <ul className="clara-agent-rich-accounts">
        {card.accounts.map((account) => (
          <li key={account.id}>
            <div className="clara-agent-rich-account-mark">
              <InstitutionLogo institution={account.institution} size={28} />
            </div>
            <div className="clara-agent-rich-copy">
              <p className="clara-agent-rich-title">{account.name}</p>
              <p className="clara-agent-rich-meta">
                {account.institution} · {account.channel}
              </p>
            </div>
            <strong className="clara-agent-rich-amount">
              {money(account.balance, account.currency)}
            </strong>
          </li>
        ))}
      </ul>
    </ClaraAgentRichCard>
  );
}
