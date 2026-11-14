"use client";

import { ClaraAgentAccountCard } from "@/components/clara-agent-account-card";
import { ClaraAgentBalancesCard } from "@/components/clara-agent-balances-card";
import { ClaraAgentCategoryCard } from "@/components/clara-agent-category-card";
import { ClaraAgentExpenseCard } from "@/components/clara-agent-expense-card";
import { ClaraAgentGoalsCard } from "@/components/clara-agent-goals-card";
import { ClaraAgentHelpCard } from "@/components/clara-agent-help-card";
import { ClaraAgentPaceCard } from "@/components/clara-agent-pace-card";
import { ClaraAgentPendingCard } from "@/components/clara-agent-pending-card";
import { ClaraAgentRecurringCard } from "@/components/clara-agent-recurring-card";
import { ClaraAgentSummaryCard } from "@/components/clara-agent-summary-card";
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
    case "pace":
      return <ClaraAgentPaceCard card={card} compact={compact} />;
    case "period-summary":
      return <ClaraAgentSummaryCard card={card} compact={compact} />;
    case "pending-bills":
      return <ClaraAgentPendingCard card={card} compact={compact} />;
    case "recurrings":
      return <ClaraAgentRecurringCard card={card} compact={compact} />;
    case "category-spend":
      return <ClaraAgentCategoryCard card={card} compact={compact} />;
    case "goals":
      return <ClaraAgentGoalsCard card={card} compact={compact} />;
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
