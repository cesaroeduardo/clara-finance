"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  Bank,
  ChartLineUp,
  Plus,
  Question,
  Receipt,
  SquaresFour,
  Wallet,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CLARA_HELP_PROMPTS } from "@/lib/clara-agent-help";

const MENU_META: Record<
  string,
  { icon: Icon; description: string }
> = {
  balances: { icon: Wallet, description: "Saldos por conta" },
  worth: { icon: ChartLineUp, description: "Contas + investimentos" },
  biggest: { icon: Receipt, description: "Maior despesa do mês" },
  "open-accounts": { icon: Bank, description: "Tela de Contas" },
  "open-dashboard": { icon: SquaresFour, description: "Painel principal" },
  help: { icon: Question, description: "Lista de comandos" },
};

const QUICK_PROMPTS = CLARA_HELP_PROMPTS.filter((item) =>
  Object.hasOwn(MENU_META, item.id),
).map((item) => ({
  ...item,
  ...MENU_META[item.id],
}));

type ClaraAgentComposerPlusProps = {
  onPrefill: (prompt: string) => void;
  disabled?: boolean;
};

export function ClaraAgentComposerPlus({
  onPrefill,
  disabled = false,
}: ClaraAgentComposerPlusProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="quiet"
            size="icon"
            aria-label="Atalhos do agente"
            disabled={disabled}
            className="clara-agent-composer-plus"
            icon={Plus}
            iconWeight="bold"
          />
        }
      />
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="clara-agent-composer-menu"
      >
        {QUICK_PROMPTS.map((item) => {
          const ItemIcon = item.icon;
          return (
            <DropdownMenuItem
              key={item.id}
              className="clara-agent-composer-menu-item"
              onSelect={() => onPrefill(item.prompt)}
            >
              <ItemIcon
                size={15}
                className="clara-agent-composer-menu-icon"
                aria-hidden
              />
              <span className="clara-agent-composer-menu-copy">
                <span className="clara-agent-composer-menu-label">
                  {item.label}
                </span>
                <span className="clara-agent-composer-menu-detail">
                  {item.description}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
