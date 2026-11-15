"use client";

import type { Icon } from "@/components/icons";
import type { ReactNode } from "react";
import { FinanceSurface } from "@/components/ui/finance-surface";
import { ShellHeader } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

type ClaraAgentRichCardProps = {
  title: string;
  subtitle?: string;
  icon?: Icon;
  aside?: ReactNode;
  compact?: boolean;
  className?: string;
  children: ReactNode;
};

export function ClaraAgentRichCard({
  title,
  subtitle,
  icon,
  aside,
  compact = false,
  className,
  children,
}: ClaraAgentRichCardProps) {
  return (
    <FinanceSurface
      className={cn(
        "clara-agent-rich-card",
        compact && "is-compact",
        className,
      )}
      header={
        <ShellHeader
          icon={icon}
          title={title}
          subtitle={subtitle}
          aside={aside}
        />
      }
    >
      {children}
    </FinanceSurface>
  );
}
