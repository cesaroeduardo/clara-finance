"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowsClockwise,
  ArrowsLeftRight,
  Bank,
  CalendarDots,
  CaretDown,
  CaretLeft,
  CaretRight,
  CircleNotch,
  Eye,
  EyeSlash,
  List,
  Moon,
  Plant,
  Plus,
  Question,
  SquaresFour,
  Stack,
  Sun,
  Tag,
  Target,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldSelect } from "@/components/ui/field-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClaraMark } from "./clara-mark";
import { FinanceForm, type FormState, type Mutate } from "./finance-form";
import { PrivacyContext } from "./finance-privacy";
import {
  AnimatedLabel,
  IconSwap,
  NavigationIndicator,
  NavAccordion,
  PageEnter,
} from "./finance-motion";
import {
  DashboardView,
  TransactionsView,
  InvestmentsView,
  GoalsView,
  GroupsView,
  AccountsView,
} from "./finance-views";
import { RecurringView } from "./finance-recurring";
import { CommandTrigger, FinanceCommandBar } from "./finance-command";
import { monthKey, monthLabel } from "@/lib/format";
import type { FinanceData } from "@/lib/types";
export type View =
  | "dashboard"
  | "transactions"
  | "recurring"
  | "investments"
  | "goals"
  | "groups"
  | "accounts";
const navigationSections = [
  {
    id: "principal",
    label: "Principal",
    items: [
      { id: "dashboard", label: "Visão geral", icon: SquaresFour },
      { id: "transactions", label: "Lançamentos", icon: ArrowsLeftRight },
      { id: "recurring", label: "Recorrentes", icon: CalendarDots },
      { id: "investments", label: "Investimentos", icon: Plant },
      { id: "goals", label: "Metas", icon: Target },
    ],
  },
  {
    id: "organizacao",
    label: "Organização",
    items: [
      { id: "groups", label: "Grupos", icon: Stack },
      { id: "accounts", label: "Contas", icon: Bank },
    ],
  },
] as const;
const subscribePreferences = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("clara-preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("clara-preferences", callback);
  };
};
const subscribeHydration = () => () => {};
function usePreference(key: string, fallback: string) {
  const value = useSyncExternalStore(
    subscribePreferences,
    () => localStorage.getItem(key) || fallback,
    () => fallback,
  );
  const save = (next: string) => {
    localStorage.setItem(key, next);
    window.dispatchEvent(new Event("clara-preferences"));
  };
  return [value, save] as const;
}
export function FinanceApp() {
  const [view, setView] = useState<View>("dashboard"),
    [data, setData] = useState<FinanceData | null>(null);
  const [theme, saveTheme] = usePreference("clara-theme", "light");
  const mode = "personal" as const;
  const dark = theme === "dark";
  const setDark = (update: (value: boolean) => boolean) =>
    saveTheme(update(dark) ? "dark" : "light");
  const ready = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const [month, setMonth] = useState(monthKey()),
    [monthDirection, setMonthDirection] = useState<1 | -1>(1),
    [category, setCategory] = useState("all"),
    [query, setQuery] = useState(""),
    [txType, setTxType] = useState("all");
  const [form, setForm] = useState<FormState | null>(null),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState("");
  const [sidebar, setSidebar] = useState(false),
    [hidden, setHidden] = useState(false),
    [syncing, setSyncing] = useState(false),
    [commandOpen, setCommandOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(navigationSections.map((section) => [section.id, true])),
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k")
        return;
      event.preventDefault();
      setCommandOpen((open) => !open);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    fetch(`/api/data?mode=${mode}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error);
        setData(json);
        setError("");
      })
      .catch((err) => {
        if (err.name !== "AbortError")
          setError("Não foi possível abrir seus dados. Tente novamente.");
      });
    return () => controller.abort();
  }, [mode, refresh, ready]);
  const openSectionForView = (next: View) => {
    const section = navigationSections.find((entry) =>
      entry.items.some((item) => item.id === next),
    );
    if (!section) return;
    setOpenSections((current) =>
      current[section.id] ? current : { ...current, [section.id]: true },
    );
  };
  const navigate = (next: View) => {
    openSectionForView(next);
    setView(next);
    setSidebar(false);
  };
  const openTransactions = (filters?: {
    category?: string;
    type?: string;
  }) => {
    setCategory(filters?.category ?? "all");
    setTxType(filters?.type ?? "all");
    setQuery("");
    navigate("transactions");
  };
  const mutate: Mutate = useCallback(
    async (resource, body, method = "POST") => {
      const response = await fetch(`/api/manage/${resource}?mode=${mode}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setRefresh((v) => v + 1);
      toast.success(method === "DELETE" ? "Registro excluído." : "Salvo.");
    },
    [mode],
  );
  async function sync() {
    setSyncing(true);
    try {
      const response = await fetch("/api/pluggy/sync?mode=personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (result.results) {
        const failed = result.results.filter((r: { ok: boolean }) => !r.ok);
        if (failed.length) toast.error(failed[0].error);
        if (result.results.some((r: { ok: boolean }) => r.ok))
          toast.success("Seus dados locais foram atualizados.");
        const warning = result.results.find(
          (r: { warning?: string }) => r.warning,
        )?.warning;
        if (warning) toast.warning(warning);
        setRefresh((v) => v + 1);
      } else if (!response.ok) throw new Error(result.error);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível sincronizar.",
      );
    } finally {
      setSyncing(false);
    }
  }
  function changeMonth(delta: number) {
    setMonthDirection(delta >= 0 ? 1 : -1);
    const date = new Date(month + "-15T12:00:00");
    date.setMonth(date.getMonth() + delta);
    setMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  function goToCurrentMonth() {
    const next = monthKey();
    setMonthDirection(next > month ? 1 : -1);
    setMonth(next);
  }
  const categoryOptions = data
    ? [
        ...new Set(
          [
            ...data.transactions
              .filter(
                (row) =>
                  row.date.startsWith(month) && row.currency === "BRL",
              )
              .map((row) => row.category || "Sem categoria"),
            ...(category !== "all" ? [category] : []),
          ],
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR"))
    : [];
  const props =
    data?.mode === mode
      ? {
          data,
          month,
          category,
          setCategory,
          query,
          setQuery,
          txType,
          setTxType,
          openForm: setForm,
          mutate,
          navigate,
          openTransactions,
        }
      : null;
  return (
    <PrivacyContext value={hidden}>
      <div className={`app-shell ${hidden ? "values-hidden" : ""}`}>
        {sidebar && (
          <button
            className="sidebar-backdrop"
            aria-label="Fechar menu"
            onClick={() => setSidebar(false)}
          />
        )}
        <aside className={`sidebar ${sidebar ? "is-open" : ""}`}>
          <div className="sidebar-top">
            <div className="brand-row">
              <button
                className="brand"
                onClick={() => navigate("dashboard")}
                aria-label="Clara, página inicial"
              >
                <ClaraMark className="brand-mark" />
                <span>
                  clara<span className="brand-dot">.</span>
                </span>
              </button>
              <button
                className="icon-button privacy-toggle"
                aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                onClick={() => setHidden((v) => !v)}
              >
                <IconSwap
                  active={hidden}
                  first={<Eye size={18} />}
                  second={<EyeSlash size={18} />}
                />
              </button>
            </div>
            <CommandTrigger onOpen={() => setCommandOpen(true)} />
          </div>
          <div className="sidebar-nav">
            {navigationSections.map((section) => {
              const open = openSections[section.id] ?? true;
              return (
                <NavAccordion
                  key={section.id}
                  id={`nav-section-${section.id}`}
                  label={section.label}
                  open={open}
                  onToggle={() =>
                    setOpenSections((current) => ({
                      ...current,
                      [section.id]: !open,
                    }))
                  }
                >
                  {section.items.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => navigate(id)}
                      className={`nav-item ${view === id ? "active" : ""}`}
                      aria-current={view === id ? "page" : undefined}
                    >
                      {view === id && <NavigationIndicator />}
                      <Icon size={16} />
                      <span>{label}</span>
                      {id === "goals" && !!data?.goals.length && (
                        <small>{data.goals.length}</small>
                      )}
                    </button>
                  ))}
                </NavAccordion>
              );
            })}
          </div>
          <div className="sidebar-bottom">
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setDark((v) => !v)}
              aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
            >
              <span className="theme-track" data-theme={dark ? "dark" : "light"}>
                <Sun size={13} />
                <Moon size={12} />
              </span>
            </button>
            <a
              className="icon-button sidebar-help"
              href="https://meu.pluggy.ai/api-guide"
              target="_blank"
              rel="noreferrer"
              aria-label="Ajuda com Meu Pluggy"
            >
              <Question size={16} />
            </a>
          </div>
        </aside>
        <div className="app-main">
          <main className="main-content">
            <div className="page-heading">
              <div className="page-heading-start">
                <button
                  className="icon-button mobile-menu"
                  aria-label="Abrir menu"
                  onClick={() => setSidebar(true)}
                >
                  <List size={21} />
                </button>
                {["dashboard", "transactions", "recurring", "groups"].includes(
                  view,
                ) ? (
                  <div className="period-picker">
                    <button
                      className="icon-button"
                      aria-label="Mês anterior"
                      onClick={() => changeMonth(-1)}
                    >
                      <CaretLeft size={17} />
                    </button>
                    <label className="period-label">
                      <AnimatedLabel
                        value={monthLabel(month)}
                        direction={monthDirection}
                      />
                      <input
                        aria-label="Mês de referência"
                        type="month"
                        value={month}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!next) return;
                          setMonthDirection(next > month ? 1 : -1);
                          setMonth(next);
                        }}
                      />
                    </label>
                    <button
                      className="icon-button"
                      aria-label="Próximo mês"
                      onClick={() => changeMonth(1)}
                    >
                      <CaretRight size={17} />
                    </button>
                  </div>
                ) : null}
                {view !== "accounts" && (
                  <div className="group-filter">
                    <Tag size={15} />
                    <FieldSelect
                      aria-label="Filtrar por categoria"
                      value={category}
                      onValueChange={setCategory}
                      triggerClassName="group-filter-select"
                      options={[
                        { value: "all", label: "Todas as categorias" },
                        ...categoryOptions.map((name) => ({
                          value: name,
                          label: name,
                        })),
                      ]}
                    />
                  </div>
                )}
              </div>
              <div className="page-heading-actions">
                <button
                  className="sync-button"
                  onClick={sync}
                  disabled={syncing}
                  aria-label={syncing ? "Sincronizando…" : "Sincronizar"}
                  aria-busy={syncing}
                >
                  <ArrowsClockwise
                    size={14}
                    className={syncing ? "animate-spin" : ""}
                  />
                  <AnimatedLabel
                    value={syncing ? "Sincronizando…" : "Sincronizar"}
                  />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button className="add-button" />}
                  >
                    <Plus size={17} /> Adicionar <CaretDown size={15} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      onClick={() =>
                        setForm({ resource: "transactions", kind: "income" })
                      }
                    >
                      <ArrowDownLeft />
                      Nova entrada
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        setForm({ resource: "transactions", kind: "expense" })
                      }
                    >
                      <ArrowUpRight />
                      Nova saída
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setForm({ resource: "investments" })}
                    >
                      <Plant />
                      Investimento
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setForm({ resource: "goals" })}
                    >
                      <Target />
                      Meta
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        setForm({ resource: "recurrings", kind: "expense" })
                      }
                    >
                      <CalendarDots />
                      Recorrência
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setForm({ resource: "groups" })}
                    >
                      <Stack />
                      Grupo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {error ? (
              <div className="error-state" role="alert">
                <h2>Erro ao carregar</h2>
                <p>{error}</p>
                <Button onClick={() => setRefresh((v) => v + 1)}>
                  Recarregar
                </Button>
              </div>
            ) : !props ? (
              <div className="loading-state">
                <CircleNotch className="animate-spin" size={24} />
                <p>Carregando…</p>
              </div>
            ) : (
              <div className="view-content" key={`${view}-${mode}`}>
                <PageEnter>
                  {view === "dashboard" ? (
                    <DashboardView {...props} />
                  ) : view === "transactions" ? (
                    <TransactionsView {...props} />
                  ) : view === "recurring" ? (
                    <RecurringView {...props} />
                  ) : view === "investments" ? (
                    <InvestmentsView {...props} />
                  ) : view === "goals" ? (
                    <GoalsView {...props} />
                  ) : view === "groups" ? (
                    <GroupsView {...props} />
                  ) : (
                    <AccountsView
                      {...props}
                      syncing={syncing}
                      sync={sync}
                    />
                  )}
                </PageEnter>
              </div>
            )}
          </main>
        </div>
        {form && data && (
          <FinanceForm
            key={`${form.resource}-${String(form.record?.id || "new")}-${!!form.contribute}`}
            form={form}
            data={data}
            onClose={() => setForm(null)}
            mutate={mutate}
          />
        )}
        <FinanceCommandBar
          open={commandOpen}
          onOpenChange={setCommandOpen}
          dark={dark}
          hidden={hidden}
          syncing={syncing}
          navigate={navigate}
          openForm={setForm}
          sync={sync}
          setDark={setDark}
          setHidden={setHidden}
          changeMonth={changeMonth}
          goToCurrentMonth={goToCurrentMonth}
        />
      </div>
    </PrivacyContext>
  );
}
