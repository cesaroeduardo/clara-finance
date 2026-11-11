"use client";
import { useState } from "react";
import { CircleNotch, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { FieldSelect } from "@/components/ui/field-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { taxonomyCategories } from "@/lib/categorize";
import { localDate, monthLabel, parseMoney } from "@/lib/format";
import { AnimatedLabel, MotionSegmentedControl } from "./finance-motion";
import type { FinanceData } from "@/lib/types";

export type FormState = {
  resource:
    | "transactions"
    | "groups"
    | "goals"
    | "investments"
    | "connections"
    | "plan"
    | "recurrings";
  record?: Record<string, unknown>;
  contribute?: boolean;
  kind?: string;
  month?: string;
};
export type Mutate = (
  resource: string,
  body: Record<string, unknown>,
  method?: string,
) => Promise<void>;
export function FinanceForm({
  form,
  data,
  onClose,
  mutate,
}: {
  form: FormState;
  data: FinanceData;
  onClose: () => void;
  mutate: Mutate;
}) {
  const row = form.record;
  const planMonth =
    form.month ||
    (typeof row?.month === "string" ? row.month : "") ||
    localDate().slice(0, 7);
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [kind, setKind] = useState(String(row?.kind || form.kind || "expense"));
  const [recurringType, setRecurringType] = useState(
    String(row?.type || "fixed"),
  );
  const titles = {
    transactions: row ? "Editar lançamento" : "Novo lançamento",
    groups: row ? "Editar grupo" : "Novo grupo",
    goals: form.contribute
      ? "Atualizar progresso"
      : row
        ? "Editar meta"
        : "Nova meta",
    investments: row ? "Editar investimento" : "Novo investimento",
    connections: "Conectar Meu Pluggy",
    plan: `Planejamento · ${monthLabel(planMonth)}`,
    recurrings: row ? "Editar recorrência" : "Nova recorrência",
  };
  const isImported = row?.source === "pluggy";
  const moneyValue = (value: unknown) =>
    typeof value === "number" ? (value / 100).toFixed(2).replace(".", ",") : "";
  const categorySuggestions = [
    ...new Set([
      ...taxonomyCategories,
      ...data.transactions.map((item) => item.category).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const groupField = (
    <Field title="Grupo" name="groupId">
      <FieldSelect
        id="groupId"
        name="groupId"
        defaultValue={String(row?.groupId || data.groups[0]?.id)}
        options={data.groups.map((group) => ({
          value: group.id,
          label: group.name,
        }))}
      />
    </Field>
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const body: Record<string, unknown> = {
      ...fields,
      ...(row ? { id: row.id } : {}),
    };
    const moneyFields = form.contribute
      ? ["contribution"]
      : form.resource === "transactions" || form.resource === "recurrings"
        ? ["amount"]
        : form.resource === "groups"
          ? ["budget"]
          : form.resource === "goals"
            ? ["target", "current"]
            : form.resource === "investments"
              ? ["balance", "invested"]
              : form.resource === "plan"
                ? [
                    "monthlyLimit",
                    "fixedCost",
                    "monthlySavings",
                    "expectedSalary",
                    "expectedFreelance",
                  ]
                : [];
    for (const key of moneyFields) {
      const raw = String(fields[key] ?? "").trim();
      if (key === "invested" && !raw) {
        body[key] = null;
        continue;
      }
      body[key] = parseMoney(raw || "0");
      if (!Number.isSafeInteger(body[key])) {
        setError("Use valores como 1500,00, sem separador de milhar.");
        setBusy(false);
        return;
      }
    }
    if (form.resource === "transactions") {
      body.kind = kind;
      body.accountId = fields.accountId || null;
    }
    if (form.resource === "recurrings") {
      body.kind = kind;
      body.type = recurringType;
      body.accountId = fields.accountId || null;
      body.dayOfMonth = Number(fields.dayOfMonth);
      body.installmentCurrent = fields.installmentCurrent
        ? Number(fields.installmentCurrent)
        : null;
      body.installmentTotal = fields.installmentTotal
        ? Number(fields.installmentTotal)
        : null;
      body.startDate = fields.startDate || null;
      body.endDate = fields.endDate || null;
    }
    if (form.resource === "groups" && !body.icon) body.icon = "layers";
    if (form.resource === "plan") body.month = planMonth;
    try {
      await mutate(
        form.resource,
        body,
        form.resource === "plan" || row ? "PATCH" : "POST",
      );
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await mutate(form.resource, { id: row?.id }, "DELETE");
      close();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível excluir.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="finance-dialog sm:max-w-[480px] p-7">
        <DialogHeader>
          <DialogTitle className="text-[24px] font-semibold tracking-tight">
            {titles[form.resource]}
          </DialogTitle>
          {(form.contribute || isImported || form.resource === "plan") && (
            <DialogDescription>
              {form.contribute
                ? "O valor será somado ao progresso. Não movimenta contas."
                : form.resource === "plan"
                  ? `Válido para ${monthLabel(planMonth)}. Limite do card = renda (previsto ou já entrada) − guardar. Teto digitado só vale se não houver renda.`
                  : "Valores importados. Edite o grupo, a categoria ou o tipo."}
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={submit} className="finance-form">
          {form.contribute ? (
            <>
              <Field title="Valor reservado (R$)" name="contribution">
                <Input
                  id="contribution"
                  name="contribution"
                  inputMode="decimal"
                  required
                  placeholder="0,00"
                  autoFocus
                />
              </Field>
            </>
          ) : (
            <>
              {form.resource === "transactions" && (
                <>
                  <MotionSegmentedControl
                    label="Tipo do lançamento"
                    value={kind}
                    onChange={setKind}
                    options={[
                      ["expense", "Saída"],
                      ["income", "Entrada"],
                      ["transfer", "Transferência"],
                    ]}
                  />
                  <Field title="Descrição" name="description">
                    <Input
                      id="description"
                      name="description"
                      defaultValue={String(row?.description || "")}
                      required
                      maxLength={160}
                      placeholder="Ex.: Mercado da semana"
                      readOnly={isImported}
                    />
                  </Field>
                  <div className="form-row">
                    <Field
                      title={`Valor (${row?.currency && row.currency !== "BRL" ? row.currency : "R$"})`}
                      name="amount"
                    >
                      <Input
                        id="amount"
                        name="amount"
                        inputMode="decimal"
                        defaultValue={moneyValue(row?.amount)}
                        required
                        placeholder="0,00"
                        readOnly={isImported}
                      />
                    </Field>
                    <Field title="Data" name="date">
                      <Input
                        id="date"
                        name="date"
                        type="date"
                        defaultValue={String(row?.date || localDate())}
                        required
                        readOnly={isImported}
                      />
                    </Field>
                  </div>
                  <div className="form-row">
                    {groupField}
                    <Field title="Categoria" name="category">
                      <Input
                        id="category"
                        name="category"
                        list="category-suggestions"
                        defaultValue={String(row?.category || "")}
                        placeholder="Ex.: Alimentação"
                        maxLength={80}
                        required
                      />
                      <datalist id="category-suggestions">
                        {categorySuggestions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field title="Situação" name="status">
                      <FieldSelect
                        id="status"
                        name={isImported ? undefined : "status"}
                        defaultValue={String(row?.status || "paid")}
                        disabled={isImported}
                        options={[
                          { value: "paid", label: "Confirmado" },
                          { value: "pending", label: "Pendente" },
                        ]}
                      />
                      {isImported && (
                        <input
                          type="hidden"
                          name="status"
                          value={String(row?.status)}
                        />
                      )}
                    </Field>
                    <Field title="Conta" name="accountId">
                      <FieldSelect
                        id="accountId"
                        name={isImported ? undefined : "accountId"}
                        defaultValue={String(row?.accountId || "")}
                        disabled={isImported}
                        options={[
                          { value: "", label: "Registro manual" },
                          ...data.accounts
                            .filter((a) => a.currency === "BRL")
                            .map((account) => ({
                              value: account.id,
                              label: `${account.institution} · ${account.name}`,
                            })),
                        ]}
                      />
                      {isImported && (
                        <input
                          type="hidden"
                          name="accountId"
                          value={String(row?.accountId || "")}
                        />
                      )}
                    </Field>
                  </div>
                </>
              )}
              {form.resource === "groups" && (
                <>
                  <Field title="Nome do grupo" name="name">
                    <Input
                      id="name"
                      name="name"
                      defaultValue={String(row?.name || "")}
                      placeholder="Ex.: Casa & rotina"
                      required
                      maxLength={60}
                    />
                  </Field>
                  <Field title="Orçamento mensal (R$)" name="budget">
                    <Input
                      id="budget"
                      name="budget"
                      inputMode="decimal"
                      defaultValue={moneyValue(row?.budget) || "0,00"}
                      required
                    />
                  </Field>
                  <div className="form-row">
                    <Field title="Ícone" name="icon">
                      <FieldSelect
                        id="icon"
                        name="icon"
                        defaultValue={String(row?.icon || "layers")}
                        options={[
                          { value: "house", label: "Casa" },
                          { value: "coffee", label: "Estilo de vida" },
                          { value: "sprout", label: "Futuro" },
                          { value: "briefcase", label: "Trabalho" },
                          { value: "plane", label: "Viagem" },
                          { value: "heart", label: "Saúde" },
                          { value: "car", label: "Transporte" },
                          { value: "layers", label: "Outros" },
                        ]}
                      />
                    </Field>
                    <Field title="Cor" name="color">
                      <Input
                        id="color"
                        name="color"
                        type="color"
                        defaultValue={String(row?.color || "#737373")}
                      />
                    </Field>
                  </div>
                </>
              )}
              {form.resource === "goals" && (
                <>
                  <Field title="Nome da meta" name="name">
                    <Input
                      id="name"
                      name="name"
                      defaultValue={String(row?.name || "")}
                      placeholder="Ex.: Minha próxima viagem"
                      required
                      maxLength={80}
                    />
                  </Field>
                  <div className="form-row">
                    <Field title="Valor da meta (R$)" name="target">
                      <Input
                        id="target"
                        name="target"
                        inputMode="decimal"
                        defaultValue={moneyValue(row?.target)}
                        required
                        placeholder="0,00"
                      />
                    </Field>
                    <Field title="Valor reservado (R$)" name="current">
                      <Input
                        id="current"
                        name="current"
                        inputMode="decimal"
                        defaultValue={moneyValue(row?.current) || "0,00"}
                        required
                      />
                    </Field>
                  </div>
                  <div className="form-row">
                    {groupField}
                    <Field title="Prazo" name="deadline">
                      <Input
                        id="deadline"
                        name="deadline"
                        type="date"
                        defaultValue={String(row?.deadline || "")}
                        required
                      />
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field title="Ilustração" name="icon">
                      <FieldSelect
                        id="icon"
                        name="icon"
                        defaultValue={String(row?.icon || "target")}
                        options={[
                          { value: "target", label: "Objetivo" },
                          { value: "shield", label: "Reserva" },
                          { value: "plane", label: "Viagem" },
                          { value: "house", label: "Casa" },
                          { value: "car", label: "Carro" },
                        ]}
                      />
                    </Field>
                    <Field title="Cor" name="color">
                      <Input
                        id="color"
                        name="color"
                        type="color"
                        defaultValue={String(row?.color || "#737373")}
                      />
                    </Field>
                  </div>
                </>
              )}
              {form.resource === "investments" && (
                <>
                  <Field title="Nome do investimento" name="name">
                    <Input
                      id="name"
                      name="name"
                      defaultValue={String(row?.name || "")}
                      placeholder="Ex.: Tesouro Selic"
                      readOnly={isImported}
                      required
                      maxLength={120}
                    />
                  </Field>
                  <div className="form-row">
                    <Field title="Instituição" name="institution">
                      <Input
                        id="institution"
                        name="institution"
                        defaultValue={String(row?.institution || "")}
                        placeholder="Ex.: Nubank"
                        readOnly={isImported}
                        required
                        maxLength={80}
                      />
                    </Field>
                    <Field title="Tipo" name="type">
                      <FieldSelect
                        id="type"
                        name={isImported ? undefined : "type"}
                        defaultValue={String(row?.type || "FIXED_INCOME")}
                        disabled={isImported}
                        options={[
                          { value: "FIXED_INCOME", label: "Renda fixa" },
                          { value: "EQUITY", label: "Ações" },
                          { value: "ETF", label: "ETFs" },
                          { value: "MUTUAL_FUND", label: "Fundos" },
                          { value: "SECURITY", label: "Previdência" },
                          { value: "COE", label: "COE" },
                          { value: "OTHER", label: "Outros" },
                        ]}
                      />
                      {isImported && (
                        <input
                          type="hidden"
                          name="type"
                          value={String(row?.type)}
                        />
                      )}
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field
                      title={`Saldo atual (${row?.currency && row.currency !== "BRL" ? row.currency : "R$"})`}
                      name="balance"
                    >
                      <Input
                        id="balance"
                        name="balance"
                        inputMode="decimal"
                        defaultValue={moneyValue(row?.balance)}
                        readOnly={isImported}
                        required
                      />
                    </Field>
                    <Field title="Custo de aquisição (R$)" name="invested">
                      <Input
                        id="invested"
                        name="invested"
                        inputMode="decimal"
                        defaultValue={
                          row?.invested == null
                            ? ""
                            : moneyValue(row.invested)
                        }
                        placeholder="Ex.: 450,00"
                        autoFocus={isImported}
                      />
                      <span className="muted text-xs">
                        {isImported
                          ? "A Pluggy não envia o preço de compra. Informe aqui para ver a valorização. A sync não apaga esse valor."
                          : "Quanto você pagou no total. Vazio = sem valorização."}
                      </span>
                    </Field>
                  </div>
                  {groupField}
                </>
              )}
              {form.resource === "plan" && (
                <>
                  <Field title="Salário CNPJ (R$)" name="expectedSalary">
                    <Input
                      id="expectedSalary"
                      name="expectedSalary"
                      inputMode="decimal"
                      defaultValue={moneyValue(row?.expectedSalary) || "0,00"}
                      required
                      autoFocus
                    />
                  </Field>
                  <Field title="Freelas previstos (R$)" name="expectedFreelance">
                    <Input
                      id="expectedFreelance"
                      name="expectedFreelance"
                      inputMode="decimal"
                      defaultValue={
                        moneyValue(row?.expectedFreelance) || "0,00"
                      }
                      required
                    />
                  </Field>
                  <Field
                    title="Teto fallback (R$)"
                    name="monthlyLimit"
                  >
                    <Input
                      id="monthlyLimit"
                      name="monthlyLimit"
                      inputMode="decimal"
                      defaultValue={moneyValue(row?.monthlyLimit) || "0,00"}
                      required
                    />
                  </Field>
                  <Field title="Reserva alimentação (R$)" name="fixedCost">
                    <Input
                      id="fixedCost"
                      name="fixedCost"
                      inputMode="decimal"
                      defaultValue={moneyValue(row?.fixedCost) || "0,00"}
                      required
                    />
                  </Field>
                  <Field title="Quanto guardar por mês (R$)" name="monthlySavings">
                    <Input
                      id="monthlySavings"
                      name="monthlySavings"
                      inputMode="decimal"
                      defaultValue={moneyValue(row?.monthlySavings) || "0,00"}
                      required
                    />
                  </Field>
                </>
              )}
              {form.resource === "recurrings" && (
                <>
                  <MotionSegmentedControl
                    label="Tipo"
                    value={kind}
                    onChange={setKind}
                    options={[
                      ["expense", "Despesa"],
                      ["income", "Receita"],
                    ]}
                  />
                  <MotionSegmentedControl
                    label="Forma"
                    value={recurringType}
                    onChange={setRecurringType}
                    options={[
                      ["fixed", "Conta fixa"],
                      ["installment", "Parcela"],
                    ]}
                  />
                  <Field title="Descrição" name="description">
                    <Input
                      id="description"
                      name="description"
                      defaultValue={String(row?.description || "")}
                      required
                      maxLength={160}
                      placeholder="Ex.: Aluguel"
                      autoFocus
                    />
                  </Field>
                  <div className="form-row">
                    <Field title="Valor (R$)" name="amount">
                      <Input
                        id="amount"
                        name="amount"
                        inputMode="decimal"
                        defaultValue={moneyValue(row?.amount)}
                        required
                        placeholder="0,00"
                      />
                    </Field>
                    <Field title="Dia do mês" name="dayOfMonth">
                      <Input
                        id="dayOfMonth"
                        name="dayOfMonth"
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={String(row?.dayOfMonth || 1)}
                        required
                      />
                    </Field>
                  </div>
                  <div className="form-row">
                    {groupField}
                    <Field title="Categoria" name="category">
                      <Input
                        id="category"
                        name="category"
                        list="recurring-category-suggestions"
                        defaultValue={String(row?.category || "")}
                        placeholder="Ex.: Moradia"
                        maxLength={80}
                        required
                      />
                      <datalist id="recurring-category-suggestions">
                        {categorySuggestions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </Field>
                  </div>
                  <Field title="Conta" name="accountId">
                    <FieldSelect
                      id="accountId"
                      name="accountId"
                      defaultValue={String(row?.accountId || "")}
                      options={[
                        { value: "", label: "Sem conta" },
                        ...data.accounts
                          .filter((account) => account.currency === "BRL")
                          .map((account) => ({
                            value: account.id,
                            label: `${account.institution} · ${account.name}`,
                          })),
                      ]}
                    />
                  </Field>
                  {recurringType === "installment" && (
                    <div className="form-row">
                      <Field title="Parcela atual" name="installmentCurrent">
                        <Input
                          id="installmentCurrent"
                          name="installmentCurrent"
                          type="number"
                          min={1}
                          max={360}
                          defaultValue={String(row?.installmentCurrent || 1)}
                          required
                        />
                      </Field>
                      <Field title="Total de parcelas" name="installmentTotal">
                        <Input
                          id="installmentTotal"
                          name="installmentTotal"
                          type="number"
                          min={2}
                          max={360}
                          defaultValue={String(row?.installmentTotal || 2)}
                          required
                        />
                      </Field>
                    </div>
                  )}
                </>
              )}
              {form.resource === "connections" && (
                <>
                  <div className="connection-note">
                    Conecte seus bancos no{" "}
                    <a
                      href="https://meu.pluggy.ai"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Meu Pluggy
                    </a>
                    . No Dashboard, autorize o conector{" "}
                    <strong>MeuPluggy</strong> e copie o itemId de cada
                    instituição.
                  </div>
                  <Field title="Nome da conexão" name="name">
                    <Input
                      id="name"
                      name="name"
                      placeholder="Ex.: Meu Nubank"
                      maxLength={80}
                      required
                    />
                  </Field>
                  <Field title="itemId" name="itemId">
                    <Input
                      id="itemId"
                      name="itemId"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      required
                      autoComplete="off"
                    />
                  </Field>
                  <p className="muted text-xs">
                    As credenciais da API ficam somente no arquivo .env.local do
                    servidor.
                  </p>
                </>
              )}
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {confirmDelete ? (
            <div className="delete-confirm">
              <p>Excluir este registro? Esta ação não pode ser desfeita.</p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={remove}
              >
                Confirmar exclusão
              </Button>
            </div>
          ) : (
            <div className="form-actions">
              {row &&
                !isImported &&
                !form.contribute &&
                form.resource !== "plan" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="delete-btn"
                  aria-label="Excluir registro"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash size={16} />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={close}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <CircleNotch className="animate-spin" size={16} />}{" "}
                <AnimatedLabel
                  value={
                    busy
                      ? "Salvando…"
                      : form.contribute
                        ? "Registrar progresso"
                        : form.resource === "plan"
                          ? "Salvar planejamento"
                          : row
                            ? "Salvar alterações"
                            : form.resource === "connections"
                              ? "Adicionar conexão"
                              : "Salvar"
                  }
                />
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Field({
  title,
  name,
  children,
}: {
  title: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-field">
      <Label htmlFor={name}>{title}</Label>
      {children}
    </div>
  );
}
