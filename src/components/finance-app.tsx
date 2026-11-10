"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  LayoutGrid,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sprout,
  Sun,
  Target,
  Layers3,
  Landmark,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FinanceForm, type FormState, type Mutate } from "./finance-form";
import { PrivacyContext } from "./finance-privacy";
import { AnimatedLabel, IconSwap, NavigationIndicator } from "./finance-motion";
import {
  DashboardView,
  TransactionsView,
  InvestmentsView,
  GoalsView,
  GroupsView,
  AccountsView,
} from "./finance-views";
import { monthKey, monthLabel } from "@/lib/format";
import type { FinanceData, Mode } from "@/lib/types";
export type View =
  | "dashboard"
  | "transactions"
  | "investments"
  | "goals"
  | "groups"
  | "accounts";
const navigation = [
  { id: "dashboard", label: "Visão geral", icon: LayoutGrid },
  { id: "transactions", label: "Lançamentos", icon: ArrowLeftRight },
  { id: "investments", label: "Investimentos", icon: Sprout },
  { id: "goals", label: "Minhas metas", icon: Target },
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
  const [modeValue, saveMode] = usePreference("clara-mode", "demo"),
    [theme, saveTheme] = usePreference("clara-theme", "light");
  const mode: Mode = modeValue === "personal" ? "personal" : "demo",
    dark = theme === "dark";
  const setDark = (update: (value: boolean) => boolean) =>
    saveTheme(update(dark) ? "dark" : "light");
  const ready = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const [month, setMonth] = useState(monthKey()),
    [group, setGroup] = useState("all"),
    [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState | null>(null),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState("");
  const [sidebar, setSidebar] = useState(false),
    [hidden, setHidden] = useState(false),
    [syncing, setSyncing] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
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
  const navigate = (next: View) => {
    setView(next);
    setSidebar(false);
  };
  const switchMode = (next: Mode) => {
    saveMode(next);
    setGroup("all");
    setData(null);
    setForm(null);
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
      toast.success(
        method === "DELETE" ? "Registro excluído." : "Tudo salvo por aqui.",
      );
    },
    [mode],
  );
  async function sync() {
    if (mode === "demo") {
      toast.info("Ative o modo pessoal para sincronizar suas contas.");
      navigate("accounts");
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
    const date = new Date(month + "-15T12:00:00");
    date.setMonth(date.getMonth() + delta);
    setMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  const props =
    data?.mode === mode
      ? {
          data,
          month,
          group,
          query,
          setQuery,
          openForm: setForm,
          mutate,
          navigate,
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
          <button
            className="brand"
            onClick={() => navigate("dashboard")}
            aria-label="Clara, página inicial"
          >
            <span>
              clara<span className="brand-dot">.</span>
            </span>
          </button>
          <div className="workspace-chip">
            <span className="avatar">E</span>
            <div>
              <strong>Meu espaço</strong>
              <span>Finanças pessoais</span>
            </div>
            <ChevronDown size={15} />
          </div>
          <span className="nav-label">PRINCIPAL</span>
          <nav aria-label="Navegação principal">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={`nav-item ${view === id ? "active" : ""}`}
                aria-current={view === id ? "page" : undefined}
              >
                {view === id && <NavigationIndicator />}
                <Icon size={19} strokeWidth={1.8} />
                <span>{label}</span>
                {id === "goals" && !!data?.goals.length && (
                  <small>{data.goals.length}</small>
                )}
              </button>
            ))}
          </nav>
          <span className="nav-label second">ORGANIZAÇÃO</span>
          <nav aria-label="Organização">
            <button
              className={`nav-item ${view === "groups" ? "active" : ""}`}
              onClick={() => navigate("groups")}
            >
              {view === "groups" && <NavigationIndicator />}
              <Layers3 size={19} strokeWidth={1.8} />
              <span>Meus grupos</span>
            </button>
            <button
              className={`nav-item ${view === "accounts" ? "active" : ""}`}
              onClick={() => navigate("accounts")}
            >
              {view === "accounts" && <NavigationIndicator />}
              <Landmark size={19} strokeWidth={1.8} />
              <span>Contas & conexões</span>
            </button>
          </nav>
          <div className="sidebar-bottom">
            <div className="connect-promo">
              <div className="promo-symbol">
                <ArrowLeftRight size={20} />
                <span />
              </div>
              <strong>
                Todos os bancos.
                <br />
                Um só lugar.
              </strong>
              <p>Traga suas contas e enxergue o todo com clareza.</p>
              <button
                onClick={() => {
                  navigate("accounts");
                }}
              >
                Conectar minhas contas <ArrowUpRight size={15} />
              </button>
            </div>
            <button className="theme-toggle" onClick={() => setDark((v) => !v)}>
              <IconSwap
                active={dark}
                first={<Sun size={16} />}
                second={<Moon size={16} />}
              />
              <span>Aparência</span>
              <span className="theme-track">
                <Sun size={13} />
                <Moon size={12} />
              </span>
            </button>
            <div className="sidebar-footer">
              <span className="avatar">E</span>
              <div>
                <strong>Conta pessoal</strong>
                <span>
                  <i /> Armazenamento local
                </span>
              </div>
              <Settings2 size={16} />
            </div>
          </div>
        </aside>
        <div className="app-main">
          <header className="topbar">
            <div className="topbar-start">
              <button
                className="icon-button mobile-menu"
                aria-label="Abrir menu"
                onClick={() => setSidebar(true)}
              >
                <Menu size={21} />
              </button>
              <span className="breadcrumb">
                Meu espaço <ChevronRight size={13} />{" "}
                <strong>
                  {view === "dashboard"
                    ? "Visão geral"
                    : view === "transactions"
                      ? "Lançamentos"
                      : view === "investments"
                        ? "Investimentos"
                        : view === "goals"
                          ? "Minhas metas"
                          : view === "groups"
                            ? "Meus grupos"
                            : "Contas & conexões"}
                </strong>
              </span>
            </div>
            <div className="topbar-actions">
              <span className="local-indicator">
                <span /> Tudo no seu computador
              </span>
              <button
                className="icon-button"
                aria-label="Buscar lançamentos"
                onClick={() => {
                  navigate("transactions");
                  setTimeout(
                    () =>
                      document.getElementById("transaction-search")?.focus(),
                    100,
                  );
                }}
              >
                <Search size={19} />
              </button>
              <button
                className="icon-button"
                aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                onClick={() => setHidden((v) => !v)}
              >
                <IconSwap
                  active={hidden}
                  first={<Eye size={19} />}
                  second={<EyeOff size={19} />}
                />
              </button>
              <a
                className="icon-button help-button"
                href="https://meu.pluggy.ai/api-guide"
                target="_blank"
                rel="noreferrer"
                aria-label="Ajuda com Meu Pluggy"
              >
                <CircleHelp size={19} />
              </a>
              <span className="avatar top-avatar">E</span>
            </div>
          </header>
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  UM POUCO MAIS DE CLAREZA, TODOS OS DIAS
                </div>
                <h1>
                  {view === "dashboard"
                    ? "Seu dinheiro, bem cuidado."
                    : view === "transactions"
                      ? "Cada movimento conta."
                      : view === "investments"
                        ? "Seu futuro está crescendo."
                        : view === "goals"
                          ? "Dê espaço aos seus sonhos."
                          : view === "groups"
                            ? "Tudo no seu lugar."
                            : "Suas contas, conectadas."}
                </h1>
                <p>
                  {view === "dashboard"
                    ? "Uma visão tranquila de onde você está e para onde quer ir."
                    : view === "transactions"
                      ? "Acompanhe o que entra, o que sai e o que fica para depois."
                      : view === "investments"
                        ? "Acompanhe suas posições e organize o que você está construindo."
                        : view === "goals"
                          ? "Transforme planos em pequenos passos possíveis."
                          : view === "groups"
                            ? "Organize sua vida financeira de um jeito que faça sentido para você."
                            : "Importe seus dados com o Meu Pluggy e mantenha uma cópia local."}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button className="add-button" />}>
                  <Plus size={17} /> Adicionar <ChevronDown size={15} />
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
                    <Sprout />
                    Investimento
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setForm({ resource: "goals" })}
                  >
                    <Target />
                    Meta
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setForm({ resource: "groups" })}
                  >
                    <Layers3 />
                    Grupo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="toolbar">
              <div className="period-picker">
                {["dashboard", "transactions", "groups"].includes(view) ? (
                  <>
                    <button
                      className="icon-button"
                      aria-label="Mês anterior"
                      onClick={() => changeMonth(-1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <label className="period-label">
                      <AnimatedLabel value={monthLabel(month)} />
                      <ChevronDown size={14} />
                      <input
                        aria-label="Mês de referência"
                        type="month"
                        value={month}
                        onChange={(e) => {
                          if (e.target.value) setMonth(e.target.value);
                        }}
                      />
                    </label>
                    <button
                      className="icon-button"
                      aria-label="Próximo mês"
                      onClick={() => changeMonth(1)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </>
                ) : (
                  <span className="period-label">
                    {view === "investments"
                      ? "Posições atuais"
                      : view === "goals"
                        ? "Minhas metas"
                        : "Leitura mais recente"}
                  </span>
                )}
              </div>
              <div className="toolbar-right">
                {view !== "accounts" && (
                  <div className="group-filter">
                    <Layers3 size={15} />
                    <select
                      aria-label="Filtrar por grupo"
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                    >
                      <option value="all">Todos os grupos</option>
                      {data?.groups.map((g) => (
                        <option value={g.id} key={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  className="sync-button"
                  onClick={sync}
                  disabled={syncing}
                  aria-label={syncing ? "Sincronizando…" : "Sincronizar"}
                  aria-busy={syncing}
                >
                  <RefreshCw
                    size={14}
                    className={syncing ? "animate-spin" : ""}
                  />
                  <AnimatedLabel
                    value={syncing ? "Sincronizando…" : "Sincronizar"}
                  />
                </button>
              </div>
            </div>
            {mode === "demo" ? (
              <div className="demo-banner">
                <span>
                  <i /> Você está explorando com dados de demonstração.
                </span>
                <button
                  onClick={() => {
                    switchMode("personal");
                    navigate("accounts");
                  }}
                >
                  Usar meus dados <ArrowUpRight size={14} />
                </button>
              </div>
            ) : (
              <div className="personal-banner">
                <span>
                  <i /> Meu espaço pessoal
                </span>
                <button onClick={() => switchMode("demo")}>
                  Explorar demonstração
                </button>
              </div>
            )}
            {error ? (
              <div className="error-state" role="alert">
                <h2>Vamos tentar de novo?</h2>
                <p>{error}</p>
                <Button onClick={() => setRefresh((v) => v + 1)}>
                  Recarregar
                </Button>
              </div>
            ) : !props ? (
              <div className="loading-state">
                <LoaderCircle className="animate-spin" size={24} />
                <p>Preparando seu espaço…</p>
              </div>
            ) : (
              <div className="view-content" key={`${view}-${mode}`}>
                {view === "dashboard" ? (
                  <DashboardView {...props} />
                ) : view === "transactions" ? (
                  <TransactionsView {...props} />
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
                    switchMode={switchMode}
                  />
                )}
              </div>
            )}
            <footer className="main-footer">
              <span>
                <span className="footer-brand">clara.</span> Feito para dar
                tranquilidade.
              </span>
              <span>Seus planos. Seu ritmo.</span>
            </footer>
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
      </div>
    </PrivacyContext>
  );
}
