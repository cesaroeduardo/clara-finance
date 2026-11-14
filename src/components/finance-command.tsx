"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowsClockwise,
  ArrowsLeftRight,
  Bank,
  CalendarDots,
  CaretLeft,
  CaretRight,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  Moon,
  Plant,
  Plugs,
  Question,
  SquaresFour,
  Sun,
  Tag,
  Target,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem as CommandOption,
} from "@/components/ui/command";
import { Keynodes, type ShortcutPart } from "./finance-command-trigger";
export { CommandTrigger, Keynodes } from "./finance-command-trigger";
export type { ShortcutPart } from "./finance-command-trigger";
import type { FormState } from "./finance-form";
import { TransactionAvatar } from "./transaction-avatar";
import type { FinanceData } from "@/lib/types";
import { filterTransactions } from "@/lib/analytics";
import { useIsMac } from "@/components/ui/key-hint";
import { dateLabel, money } from "@/lib/format";

type AppView =
  | "dashboard"
  | "transactions"
  | "recurring"
  | "investments"
  | "goals"
  | "categories"
  | "accounts";

function key(...values: string[]): ShortcutPart[] {
  return values.flatMap((value, index) =>
    index === 0
      ? [{ type: "key", value }]
      : [
          { type: "text", value: "then" },
          { type: "key", value },
        ],
  );
}

function mod(modifier: string, value: string): ShortcutPart[] {
  return [
    { type: "key", value: modifier },
    { type: "key", value },
  ];
}

type CommandItem = {
  id: string;
  section: string;
  label: string;
  keywords?: string;
  detail?: string;
  amount?: string;
  icon: ReactNode;
  shortcut?: ShortcutPart[];
  run: () => void;
};

type CommandBarProps = {
  data: FinanceData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dark: boolean;
  hidden: boolean;
  syncing: boolean;
  navigate: (view: AppView) => void;
  openForm: (form: FormState) => void;
  sync: () => void;
  setDark: (update: (value: boolean) => boolean) => void;
  setHidden: (update: (value: boolean) => boolean) => void;
  changeMonth: (delta: number) => void;
  goToCurrentMonth: () => void;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function FinanceCommandBar({
  data,
  open,
  onOpenChange,
  dark,
  hidden,
  syncing,
  navigate,
  openForm,
  sync,
  setDark,
  setHidden,
  changeMonth,
  goToCurrentMonth,
}: CommandBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const isMac = useIsMac();

  const commands = useMemo<CommandItem[]>(() => {
    const go = (view: AppView) => {
      navigate(view);
      onOpenChange(false);
    };
    const create = (form: FormState) => {
      openForm(form);
      onOpenChange(false);
    };
    const run = (action: () => void) => {
      action();
      onOpenChange(false);
    };

    return [
      {
        id: "nav-dashboard",
        section: "Páginas",
        label: "Visão geral",
        keywords: "dashboard inicio home",
        icon: <SquaresFour size={16} />,
        shortcut: key("G", "V"),
        run: () => go("dashboard"),
      },
      {
        id: "nav-transactions",
        section: "Páginas",
        label: "Lançamentos",
        keywords: "transacoes extrato",
        icon: <ArrowsLeftRight size={16} />,
        shortcut: key("G", "L"),
        run: () => go("transactions"),
      },
      {
        id: "nav-recurring",
        section: "Páginas",
        label: "Recorrentes",
        keywords: "assinaturas mensal",
        icon: <CalendarDots size={16} />,
        shortcut: key("G", "R"),
        run: () => go("recurring"),
      },
      {
        id: "nav-investments",
        section: "Páginas",
        label: "Investimentos",
        keywords: "carteira ativos",
        icon: <Plant size={16} />,
        shortcut: key("G", "I"),
        run: () => go("investments"),
      },
      {
        id: "nav-goals",
        section: "Páginas",
        label: "Metas",
        keywords: "objetivos poupanca",
        icon: <Target size={16} />,
        shortcut: key("G", "M"),
        run: () => go("goals"),
      },
      {
        id: "nav-accounts",
        section: "Páginas",
        label: "Contas",
        keywords: "bancos conexoes pluggy",
        icon: <Bank size={16} />,
        shortcut: key("G", "C"),
        run: () => go("accounts"),
      },
      {
        id: "nav-categories",
        section: "Páginas",
        label: "Categorias",
        keywords: "taxonomia labels organizacao",
        icon: <Tag size={16} />,
        shortcut: key("G", "A"),
        run: () => go("categories"),
      },
      {
        id: "create-income",
        section: "Criar",
        label: "Nova entrada…",
        keywords: "receita credito criar",
        icon: <ArrowDownLeft size={16} />,
        shortcut: key("C", "E"),
        run: () => create({ resource: "transactions", kind: "income" }),
      },
      {
        id: "create-expense",
        section: "Criar",
        label: "Nova saída…",
        keywords: "despesa debito gasto criar",
        icon: <ArrowUpRight size={16} />,
        shortcut: key("C", "S"),
        run: () => create({ resource: "transactions", kind: "expense" }),
      },
      {
        id: "create-investment",
        section: "Criar",
        label: "Novo investimento…",
        keywords: "aplicacao posicao criar",
        icon: <Plant size={16} />,
        shortcut: key("C", "I"),
        run: () => create({ resource: "investments" }),
      },
      {
        id: "create-goal",
        section: "Criar",
        label: "Nova meta…",
        keywords: "objetivo criar",
        icon: <Target size={16} />,
        shortcut: key("C", "M"),
        run: () => create({ resource: "goals" }),
      },
      {
        id: "create-category",
        section: "Criar",
        label: "Nova categoria…",
        keywords: "taxonomia label criar",
        icon: <Tag size={16} />,
        run: () => create({ resource: "categories" }),
      },
      {
        id: "create-recurring",
        section: "Criar",
        label: "Nova recorrência…",
        keywords: "assinatura mensalidade criar",
        icon: <CalendarDots size={16} />,
        shortcut: key("C", "R"),
        run: () => create({ resource: "recurrings", kind: "expense" }),
      },
      {
        id: "create-connection",
        section: "Criar",
        label: "Adicionar conexão…",
        keywords: "banco pluggy conta criar",
        icon: <Plugs size={16} />,
        shortcut: key("C", "C"),
        run: () => create({ resource: "connections" }),
      },
      {
        id: "action-sync",
        section: "Ações",
        label: syncing ? "Sincronizando…" : "Sincronizar",
        keywords: "atualizar pluggy refresh",
        icon: (
          <ArrowsClockwise
            size={16}
            className={syncing ? "animate-spin" : ""}
          />
        ),
        shortcut: mod(isMac ? "⌘" : "Ctrl", "."),
        run: () => {
          if (!syncing) run(sync);
          else onOpenChange(false);
        },
      },
      {
        id: "action-theme",
        section: "Ações",
        label: dark ? "Usar tema claro" : "Usar tema escuro",
        keywords: "dark light modo aparencia",
        icon: dark ? <Sun size={16} /> : <Moon size={16} />,
        shortcut: key("T"),
        run: () => run(() => setDark((value) => !value)),
      },
      {
        id: "action-privacy",
        section: "Ações",
        label: hidden ? "Mostrar valores" : "Ocultar valores",
        keywords: "privacidade esconder mascara",
        icon: hidden ? <Eye size={16} /> : <EyeSlash size={16} />,
        shortcut: key("H"),
        run: () => run(() => setHidden((value) => !value)),
      },
      {
        id: "action-month-current",
        section: "Ações",
        label: "Ir para o mês atual",
        keywords: "periodo hoje",
        icon: <CalendarDots size={16} />,
        run: () => run(goToCurrentMonth),
      },
      {
        id: "action-month-prev",
        section: "Ações",
        label: "Mês anterior",
        keywords: "periodo",
        icon: <CaretLeft size={16} />,
        shortcut: key("["),
        run: () => run(() => changeMonth(-1)),
      },
      {
        id: "action-month-next",
        section: "Ações",
        label: "Próximo mês",
        keywords: "periodo",
        icon: <CaretRight size={16} />,
        shortcut: key("]"),
        run: () => run(() => changeMonth(1)),
      },
      {
        id: "action-search-transactions",
        section: "Ações",
        label: "Buscar lançamentos",
        keywords: "pesquisar filtro",
        icon: <MagnifyingGlass size={16} />,
        shortcut: key("/"),
        run: () => {
          navigate("transactions");
          onOpenChange(false);
          window.setTimeout(
            () => document.getElementById("transaction-search")?.focus(),
            0,
          );
        },
      },
      {
        id: "action-help",
        section: "Ações",
        label: "Ajuda com Meu Pluggy",
        keywords: "documentacao suporte",
        icon: <Question size={16} />,
        run: () => {
          window.open(
            "https://meu.pluggy.ai/api-guide",
            "_blank",
            "noreferrer",
          );
          onOpenChange(false);
        },
      },
    ];
  }, [
    changeMonth,
    dark,
    goToCurrentMonth,
    hidden,
    isMac,
    navigate,
    onOpenChange,
    openForm,
    setDark,
    setHidden,
    sync,
    syncing,
  ]);

  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return commands;
    const matchingCommands = commands.filter((item) =>
      normalize(
        `${item.label} ${item.section} ${item.keywords || ""}`,
      ).includes(needle),
    );
    const matchingTransactions: CommandItem[] = (data?.transactions || [])
      .filter(
        (row) =>
          normalize(
            `${row.description} ${row.category || "Sem categoria"}`,
          ).includes(needle) ||
          filterTransactions([row], query, "all", "all").length > 0,
      )
      .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
      .slice(0, 20)
      .map((row) => ({
        id: `transaction-${row.id}`,
        section: "Lançamentos",
        label: row.description,
        detail: `${dateLabel(row.date, { year: true })} · ${row.category || "Sem categoria"}`,
        amount: hidden
          ? "••••"
          : `${row.kind === "expense" ? "− " : row.kind === "income" ? "+ " : ""}${money(row.amount, row.currency)}`,
        icon: (
          <TransactionAvatar transaction={row} categories={data?.categories} />
        ),
        run: () => {
          onOpenChange(false);
          openForm({ resource: "transactions", record: { ...row } });
        },
      }));
    return [...matchingTransactions, ...matchingCommands];
  }, [commands, query, data, hidden, onOpenChange, openForm]);

  const sections = useMemo(() => {
    const order = ["Lançamentos", "Páginas", "Criar", "Ações"];
    return order
      .map((section) => ({
        section,
        items: filtered.filter((item) => item.section === section),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [filtered]);

  const flat = useMemo(
    () => sections.flatMap((entry) => entry.items),
    [sections],
  );

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setQuery("");
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="command-bar t-modal top-[min(18vh,140px)] left-1/2 flex max-h-[min(480px,calc(100dvh-48px))] w-[min(560px,calc(100%-24px))] max-w-none translate-x-[-50%] translate-y-0 flex-col gap-0 rounded-[12px] p-0 sm:max-w-none"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
        <DialogDescription className="sr-only">
          Busque lançamentos, páginas e ações do app
        </DialogDescription>
        <Command
          query={query}
          onQueryChange={setQuery}
          filter={false}
          loop
          onAction={(value) => flat.find((item) => item.id === value)?.run()}
          className="command-bar-body"
        >
          <div className="command-bar-input-row">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <CommandInput
              ref={inputRef}
              placeholder="Buscar lançamentos, páginas ou ações…"
              aria-label="Buscar lançamentos, páginas ou ações"
            />
          </div>
          <CommandList className="command-bar-list">
            {sections.length === 0 ? (
              <p className="command-bar-empty">Nenhum resultado</p>
            ) : (
              sections.map((entry) => (
                <div key={entry.section} className="command-bar-section">
                  <div className="command-bar-section-label">
                    {entry.section}
                  </div>
                  <div className="command-bar-section-items">
                    {entry.items.map((item) => {
                      return (
                        <CommandOption
                          key={item.id}
                          value={item.id}
                          label={item.label}
                          render={<button type="button" />}
                          className="command-bar-item"
                        >
                          <span
                            className={`command-bar-item-icon${item.section === "Lançamentos" ? " command-bar-item-avatar" : ""}`}
                          >
                            {item.icon}
                          </span>
                          <span className="command-bar-item-label">
                            <span className="command-bar-item-title">
                              {item.label}
                            </span>
                            {item.detail && (
                              <small className="command-bar-item-detail">
                                {item.detail}
                              </small>
                            )}
                          </span>
                          {item.amount && (
                            <span className="command-bar-item-amount">
                              {item.amount}
                            </span>
                          )}
                          {item.shortcut ? (
                            <Keynodes parts={item.shortcut} />
                          ) : null}
                        </CommandOption>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
