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
  CircleNotch,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  Moon,
  Plant,
  Plus,
  Question,
  SquaresFour,
  Sun,
  Tag,
  Target,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { categoryFieldOptions } from "@/components/category-mark";
import { FieldSelect } from "@/components/ui/field-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClaraMark } from "./clara-mark";
import { FinanceForm, type FormState, type Mutate } from "./finance-form";
import type { CategoryViewState } from "./category-rules-editor";
import { MerchantAssetsContext } from "./merchant-logo";
import { PrivacyContext } from "./finance-privacy";
import {
  AnimatedLabel,
  IconSwap,
  NavigationIndicator,
  NavAccordion,
  PageEnter,
} from "./finance-motion";
import { PeriodPicker } from "./period-picker";
import {
  DashboardView,
  TransactionsView,
  InvestmentsView,
  GoalsView,
  CategoriesView,
  AccountsView,
  AccountsHeader,
  CategoriesHeader,
} from "./finance-views";
import { RecurringView } from "./finance-recurring";
import { CommandTrigger, FinanceCommandBar } from "./finance-command";
import {
  type AppPeriod,
  currentAppPeriod,
  periodAnchor,
  periodDateBounds,
  periodLabel,
  shiftAppPeriod,
} from "@/lib/analytics";
import type { FinanceData } from "@/lib/types";
export type View =
  | "dashboard"
  | "transactions"
  | "recurring"
  | "investments"
  | "goals"
  | "categories"
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
      { id: "accounts", label: "Contas", icon: Bank },
      { id: "categories", label: "Categorias", icon: Tag },
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
  const [demoEnabled, saveDemoEnabled] = usePreference(
    "clara-demo-enabled",
    "false",
  );
  const mode = demoEnabled === "true" ? "demo" : "personal";
  const dark = theme === "dark";
  const setDark = (update: (value: boolean) => boolean) =>
    saveTheme(update(dark) ? "dark" : "light");
  const [period, setPeriod] = useState<AppPeriod>(() => currentAppPeriod()),
    [monthDirection, setMonthDirection] = useState<1 | -1>(1),
    [category, setCategory] = useState("all"),
    [query, setQuery] = useState(""),
    [txType, setTxType] = useState("all");
  const month = periodAnchor(period);
  const [form, setForm] = useState<FormState | null>(null),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState("");
  const [categoryView, setCategoryView] = useState<CategoryViewState>({
    view: "categories",
    categoryId: "all",
  });
  const [sidebar, setSidebar] = useState(false),
    [hidden, setHidden] = useState(false),
    [syncing, setSyncing] = useState(false),
    [commandOpen, setCommandOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        navigationSections.map((section) => [section.id, true]),
      ),
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const navigation = document.getElementById("main-navigation");
    const main = document.querySelector<HTMLElement>(".app-main");
    const update = () => {
      if (navigation) navigation.inert = media.matches && !sidebar;
      if (main) main.inert = media.matches && sidebar;
    };
    const onKey = (event: KeyboardEvent) => {
      if (media.matches && sidebar && event.key === "Escape") {
        setSidebar(false);
        document
          .querySelector<HTMLButtonElement>(".mobile-navigation-menu")
          ?.focus();
      }
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("keydown", onKey);
    return () => {
      if (navigation) navigation.inert = false;
      if (main) main.inert = false;
      media.removeEventListener("change", update);
      window.removeEventListener("keydown", onKey);
    };
  }, [sidebar]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => {
    let pending: "g" | "c" | null = null;
    let timer = 0;
    const clearPending = () => {
      pending = null;
      window.clearTimeout(timer);
      timer = 0;
    };
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        clearPending();
        setCommandOpen((open) => !open);
        return;
      }
      if (commandOpen || form) return;
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        if (!syncing) void sync();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) {
        clearPending();
        return;
      }
      if (event.key === "Escape") {
        clearPending();
        return;
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (pending) {
        const prefix = pending;
        clearPending();
        event.preventDefault();
        if (prefix === "g") {
          if (key === "v") navigate("dashboard");
          else if (key === "l") navigate("transactions");
          else if (key === "r") navigate("recurring");
          else if (key === "i") navigate("investments");
          else if (key === "m") navigate("goals");
          else if (key === "c") navigate("accounts");
          else if (key === "a") navigate("categories");
        } else if (prefix === "c") {
          if (key === "e")
            setForm({ resource: "transactions", kind: "income" });
          else if (key === "s")
            setForm({ resource: "transactions", kind: "expense" });
          else if (key === "i") setForm({ resource: "investments" });
          else if (key === "m") setForm({ resource: "goals" });
          else if (key === "r")
            setForm({ resource: "recurrings", kind: "expense" });
          else if (key === "c") setForm({ resource: "connections" });
        }
        return;
      }
      if (key === "g" || key === "c") {
        event.preventDefault();
        pending = key;
        timer = window.setTimeout(clearPending, 1000);
        return;
      }
      if (key === "t") {
        event.preventDefault();
        setDark((value) => !value);
        return;
      }
      if (key === "h") {
        event.preventDefault();
        setHidden((value) => !value);
        return;
      }
      if (key === "[") {
        event.preventDefault();
        changeMonth(-1);
        return;
      }
      if (key === "]") {
        event.preventDefault();
        changeMonth(1);
        return;
      }
      if (key === "/") {
        event.preventDefault();
        navigate("transactions");
        window.setTimeout(
          () => document.getElementById("transaction-search")?.focus(),
          0,
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearPending();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [commandOpen, form, syncing, mode]);
  useEffect(() => {
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
  }, [mode, refresh]);
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
  const openTransactions = (filters?: { category?: string; type?: string }) => {
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
  function changeMode(next: string) {
    if (syncing || (next !== "personal" && next !== "demo")) return;
    setForm(null);
    setData(null);
    setError("");
    setCategory("all");
    setQuery("");
    setCategoryView({ view: "categories", categoryId: "all" });
    saveDemoEnabled(next === "demo" ? "true" : "false");
  }
  async function sync() {
    if (mode === "demo") {
      toast.info("Use seus dados para sincronizar com a Pluggy.");
      return;
    }
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
    setPeriod((current) => shiftAppPeriod(current, delta));
  }
  function goToCurrentMonth() {
    const next = currentAppPeriod();
    setMonthDirection(periodLabel(next) > periodLabel(period) ? 1 : -1);
    setPeriod(next);
  }
  function handlePeriodChange(next: AppPeriod, direction: 1 | -1) {
    setMonthDirection(direction);
    setPeriod(next);
  }
  const periodBounds = periodDateBounds(period);
  const categoryOptions = data
    ? [
        ...new Set([
          ...(view === "goals"
            ? [
                ...data.categories.map((item) => item.name),
                ...data.goals.map((goal) => goal.category),
              ]
            : []),
          ...data.transactions
            .filter(
              (row) =>
                row.currency === "BRL" &&
                (!periodBounds ||
                  (row.date >= periodBounds.from &&
                    row.date <= periodBounds.to)),
            )
            .map((row) => row.category || "Sem categoria"),
          ...(category !== "all" ? [category] : []),
        ]),
      ].sort((a, b) => a.localeCompare(b, "pt-BR"))
    : [];
  const props =
    data?.mode === mode
      ? {
          data,
          month,
          period,
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
      <MerchantAssetsContext value={data?.merchantAssets ?? []}>
        <div className={`app-shell ${hidden ? "values-hidden" : ""}`}>
          <button
            className={`sidebar-backdrop${sidebar ? " is-open" : ""}`}
            aria-label="Fechar menu"
            aria-hidden={!sidebar}
            tabIndex={sidebar ? 0 : -1}
            onClick={() => setSidebar(false)}
          />
          <aside
            id="main-navigation"
            className={`sidebar ${sidebar ? "is-open" : ""}`}
          >
            <span className="mobile-sheet-handle" aria-hidden="true" />
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
                        {id === "categories" && !!data?.categories.length && (
                          <small>{data.categories.length}</small>
                        )}
                      </button>
                    ))}
                  </NavAccordion>
                );
              })}
              {mode === "demo" && (
                <button
                  type="button"
                  className="sidebar-demo-status"
                  onClick={() => navigate("accounts")}
                >
                  <span className="sidebar-demo-dot" aria-hidden="true" />
                  <span>Dados fictícios</span>
                </button>
              )}
            </div>
            <div className="sidebar-bottom">
              <button
                type="button"
                className="theme-toggle"
                onClick={() => setDark((v) => !v)}
                aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
              >
                <span
                  className="theme-track"
                  data-theme={dark ? "dark" : "light"}
                >
                  <Sun size={13} />
                  <Moon size={12} />
                </span>
              </button>
              <a
                className="icon-button sidebar-help"
                href="https://github.com/cesaroeduardo/clara-finance"
                target="_blank"
                rel="noreferrer"
                aria-label="Abrir projeto no GitHub"
              >
                <Question size={16} />
              </a>
            </div>
          </aside>
          <div className="app-main">
            <main className="main-content">
              <div
                className={`page-heading${view === "accounts" || view === "categories" ? " page-heading-organization" : ""}`}
              >
                <div
                  className={`page-heading-start${view === "accounts" || view === "categories" ? " organization-menu" : ""}`}
                >
                  {["dashboard", "transactions", "recurring"].includes(view) ? (
                    <PeriodPicker
                      period={period}
                      direction={monthDirection}
                      onPeriodChange={handlePeriodChange}
                      onShift={changeMonth}
                    />
                  ) : null}
                  {view !== "accounts" && view !== "categories" && (
                    <div className="category-filter">
                      <FieldSelect
                        aria-label="Filtrar por categoria"
                        value={category}
                        onValueChange={setCategory}
                        triggerClassName="category-filter-select"
                        options={categoryFieldOptions(categoryOptions, {
                          categories: data?.categories,
                        })}
                      />
                    </div>
                  )}
                </div>
                {props && view === "categories" && (
                  <CategoriesHeader
                    categoryView={categoryView}
                    onCategoryViewChange={setCategoryView}
                    openForm={setForm}
                  />
                )}
                {props && view === "accounts" && (
                  <AccountsHeader
                    data={props.data}
                    openForm={setForm}
                    syncing={syncing}
                    onDemoChange={(enabled) =>
                      changeMode(enabled ? "demo" : "personal")
                    }
                  />
                )}
                {view === "goals" && (
                  <div className="page-heading-actions">
                    <Button
                      className="add-button"
                      onClick={() => setForm({ resource: "goals" })}
                    >
                      <Plus size={17} /> Nova meta
                    </Button>
                  </div>
                )}
                {view !== "accounts" &&
                  view !== "categories" &&
                  view !== "goals" && (
                    <div className="page-heading-actions">
                      <button
                        className="sync-button"
                        onClick={sync}
                        disabled={syncing || mode === "demo"}
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
                              setForm({
                                resource: "transactions",
                                kind: "income",
                              })
                            }
                          >
                            <ArrowDownLeft />
                            Nova entrada
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setForm({
                                resource: "transactions",
                                kind: "expense",
                              })
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
                            onClick={() => setForm({ resource: "categories" })}
                          >
                            <Tag />
                            Categoria
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setForm({
                                resource: "recurrings",
                                kind: "expense",
                              })
                            }
                          >
                            <CalendarDots />
                            Recorrência
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
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
                    ) : view === "categories" ? (
                      <CategoriesView
                        {...props}
                        categoryView={categoryView}
                        onCategoryViewChange={setCategoryView}
                      />
                    ) : (
                      <AccountsView
                        {...props}
                        syncing={syncing}
                        sync={sync}
                        onDemoChange={(enabled) =>
                          changeMode(enabled ? "demo" : "personal")
                        }
                      />
                    )}
                  </PageEnter>
                </div>
              )}
            </main>
          </div>
          <nav
            className="mobile-navigation"
            aria-label="Navegação rápida"
            hidden={commandOpen || !!form}
          >
            <button
              type="button"
              className="mobile-navigation-search"
              onClick={() => {
                setSidebar(false);
                setCommandOpen(true);
              }}
            >
              <MagnifyingGlass size={18} />
              <span>Buscar</span>
            </button>
            <span className="mobile-navigation-divider" aria-hidden="true" />
            <button
              type="button"
              className="mobile-navigation-menu"
              aria-label={sidebar ? "Fechar menu" : "Abrir menu"}
              aria-controls="main-navigation"
              aria-expanded={sidebar}
              onClick={() => setSidebar((open) => !open)}
              data-open={sidebar}
            >
              <span className="mobile-menu-glyph" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </nav>
          {form && data && (
            <FinanceForm
              key={`${form.resource}-${String(form.record?.id || "new")}-${!!form.contribute}`}
              form={form}
              data={data}
              onClose={() => setForm(null)}
              mutate={mutate}
              onOpenCategoryConfiguration={(categoryId) => {
                setCategoryView({ view: "configuration", categoryId });
                navigate("categories");
              }}
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
      </MerchantAssetsContext>
    </PrivacyContext>
  );
}
