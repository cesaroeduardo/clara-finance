"use client";

import type { Icon } from "@/components/icons";
import {
  ArrowsClockwise,
  Bank,
  ChartBar,
  ChartLineUp,
  ChartPieSlice,
  ArrowCounterClockwise,
  CheckCircle,
  Flag,
  Gauge,
  Plus,
  Question,
  Receipt,
  SquaresFour,
  Wallet,
  WarningCircle,
} from "@/components/icons";
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
  pace: { icon: Gauge, description: "Quanto pode gastar por dia" },
  summary: { icon: ChartBar, description: "Entradas e saídas" },
  pending: { icon: WarningCircle, description: "Contas pendentes" },
  recurring: { icon: ArrowsClockwise, description: "Fixos e parcelas" },
  category: { icon: ChartPieSlice, description: "Gastos por categoria" },
  goals: { icon: Flag, description: "Progresso das metas" },
  "complete-goal": { icon: CheckCircle, description: "Conclui pelo nome" },
  undo: { icon: ArrowCounterClockwise, description: "Desfaz a última ação" },
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
