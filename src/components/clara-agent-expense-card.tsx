"use client";

import { Receipt } from "@/components/icons";
import { ClaraAgentRichCard } from "@/components/clara-agent-rich-card";
import { TransactionAvatar } from "@/components/transaction-avatar";
import type { ClaraBiggestExpenseCard } from "@/lib/clara-agent-insights";
import { dateLabel, money } from "@/lib/format";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

type ClaraAgentExpenseCardProps = {
  card: ClaraBiggestExpenseCard;
  categories?: Category[];
  compact?: boolean;
  className?: string;
};

export function ClaraAgentExpenseCard({
  card,
  categories,
  compact = false,
  className,
}: ClaraAgentExpenseCardProps) {
  const { transaction } = card;
  return (
    <ClaraAgentRichCard
      className={className}
      compact={compact}
      icon={Receipt}
      title="Maior gasto"
      subtitle={card.monthLabel}
      aside={
        <strong className="clara-agent-rich-aside">
          {money(transaction.amount, transaction.currency)}
        </strong>
      }
    >
      <div className="clara-agent-rich-row">
        <TransactionAvatar
          transaction={{
            description: transaction.description,
            category: transaction.category,
          }}
          categories={categories}
        />
        <div className="clara-agent-rich-copy">
          <p className="clara-agent-rich-title">{transaction.description}</p>
          <p className="clara-agent-rich-meta">
            {dateLabel(transaction.date, { year: true })}
            {" · "}
            {transaction.category}
            {transaction.accountName ? ` · ${transaction.accountName}` : ""}
          </p>
        </div>
      </div>

      <dl className={cn("clara-agent-rich-stats", compact && "is-compact")}>
        <div>
          <dt>Do mês</dt>
          <dd>{card.sharePercent}%</dd>
        </div>
        <div>
          <dt>Saídas</dt>
          <dd>{money(card.monthExpenseTotal)}</dd>
        </div>
        <div>
          <dt>Lançamentos</dt>
          <dd>{card.expenseCount}</dd>
        </div>
      </dl>

      {card.runnersUp.length > 0 ? (
        <div className="clara-agent-rich-list">
          <p className="clara-agent-rich-list-label">Em seguida</p>
          <ul>
            {card.runnersUp.map((row) => (
              <li key={row.id}>
                <span>{row.description}</span>
                <strong>{money(row.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ClaraAgentRichCard>
  );
}
