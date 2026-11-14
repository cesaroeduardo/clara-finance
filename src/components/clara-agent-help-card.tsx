"use client";

import { Button } from "@/components/ui/button";
import type { ClaraHelpCard } from "@/lib/clara-agent-help";
import { cn } from "@/lib/utils";

type ClaraAgentHelpCardProps = {
  card: ClaraHelpCard;
  onPrefill: (prompt: string) => void;
  compact?: boolean;
  className?: string;
};

export function ClaraAgentHelpCard({
  card,
  onPrefill,
  compact = false,
  className,
}: ClaraAgentHelpCardProps) {
  return (
    <div
      className={cn(
        "clara-agent-help-card",
        compact && "is-compact",
        className,
      )}
    >
      <ul className="clara-agent-help-list">
        {card.prompts.map((item) => (
          <li key={item.id} className="clara-agent-help-item">
            <div className="clara-agent-help-copy">
              <p className="clara-agent-help-label">{item.label}</p>
              <p className="clara-agent-help-detail">{item.detail}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              className="clara-agent-help-fill"
              onClick={() => onPrefill(item.prompt)}
            >
              Usar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
