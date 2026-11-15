"use client";

import { Flag } from "@/components/icons";
import { ClaraAgentRichCard } from "@/components/clara-agent-rich-card";
import type { ClaraGoalsCard } from "@/lib/clara-agent-insights";
import { dateLabel, money } from "@/lib/format";
import { cn } from "@/lib/utils";

type ClaraAgentGoalsCardProps = {
  card: ClaraGoalsCard;
  compact?: boolean;
  className?: string;
};

export function ClaraAgentGoalsCard({
  card,
  compact = false,
  className,
}: ClaraAgentGoalsCardProps) {
  return (
    <ClaraAgentRichCard
      className={className}
      compact={compact}
      icon={Flag}
      title="Metas"
      subtitle={`${card.activeCount} ativas · ${card.completedCount} concluídas`}
    >
      <div className="clara-agent-rich-list">
        <ul>
          {card.goals.map((goal) => (
            <li key={goal.id}>
              <span>
                {goal.name}
                <em className="clara-agent-rich-meta">
                  {" · "}
                  {goal.completed
                    ? "concluída"
                    : `${goal.percent}% · até ${dateLabel(goal.deadline, { year: true })}`}
                </em>
              </span>
              <strong>
                {money(goal.current)}
                <span className={cn("clara-agent-rich-meta")}>
                  {" / "}
                  {money(goal.target)}
                </span>
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </ClaraAgentRichCard>
  );
}
