"use client";

import { ClaraAgentAccountCard } from "@/components/clara-agent-account-card";
import { ClaraAgentBalancesCard } from "@/components/clara-agent-balances-card";
import { ClaraAgentExpenseCard } from "@/components/clara-agent-expense-card";
import { ClaraAgentHelpCard } from "@/components/clara-agent-help-card";
import { ClaraAgentWorthCard } from "@/components/clara-agent-worth-card";
import type { ClaraAgentCard } from "@/lib/clara-agent-insights";
import type { Category } from "@/lib/types";

type ClaraAgentMessageCardProps = {
  card: ClaraAgentCard;
  categories?: Category[];
  compact?: boolean;
  onPrefill?: (prompt: string) => void;
};

export function ClaraAgentMessageCard({
  card,
  categories,
  compact = false,
  onPrefill,
}: ClaraAgentMessageCardProps) {
  switch (card.type) {
    case "biggest-expense":
      return (
        <ClaraAgentExpenseCard
          card={card}
          categories={categories}
          compact={compact}
        />
      );
    case "balances":
      return <ClaraAgentBalancesCard card={card} compact={compact} />;
    case "net-worth":
      return <ClaraAgentWorthCard card={card} compact={compact} />;
    case "account":
      return <ClaraAgentAccountCard card={card} compact={compact} />;
    case "help":
      return (
        <ClaraAgentHelpCard
          card={card}
          compact={compact}
          onPrefill={onPrefill ?? (() => undefined)}
        />
      );
    default:
      return null;
  }
}
