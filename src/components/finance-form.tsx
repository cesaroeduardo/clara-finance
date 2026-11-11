"use client";
import { useState } from "react";
import { CircleNotch, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
import { localDate, parseMoney } from "@/lib/format";
import { AnimatedLabel, MotionSegmentedControl } from "./finance-motion";
import type { FinanceData } from "@/lib/types";

export type FormState = {
  resource: "transactions" | "groups" | "goals" | "investments" | "connections";
  record?: Record<string, unknown>;
  contribute?: boolean;
  kind?: string;
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
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [kind, setKind] = useState(String(row?.kind || form.kind || "expense"));
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
      <select
        id="groupId"
        name="groupId"
        className="field-select"
        defaultValue={String(row?.groupId || data.groups[0]?.id)}
      >
        {data.groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
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
      : form.resource === "transactions"
        ? ["amount"]
        : form.resource === "groups"
          ? ["budget"]
          : form.resource === "goals"
            ? ["target", "current"]
            : form.resource === "investments"
              ? ["balance", "invested"]
              : [];
    for (const key of moneyFields) {
      body[key] = parseMoney(String(fields[key] || "0"));
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
    if (form.resource === "groups" && !body.icon) body.icon = "layers";
    try {
      await mutate(form.resource, body, row ? "PATCH" : "POST");
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
          {(form.contribute || isImported) && (
            <DialogDescription>
              {form.contribute
                ? "O valor será somado ao progresso. Não movimenta contas."
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
                      <select
                        id="status"
                        name="status"
                        className="field-select"
                        defaultValue={String(row?.status || "paid")}
                        disabled={isImported}
                      >
                        <option value="paid">Confirmado</option>
                        <option value="pending">Pendente</option>
                      </select>
                      {isImported && (
                        <input
                          type="hidden"
                          name="status"
                          value={String(row?.status)}
                        />
                      )}
                    </Field>
                    <Field title="Conta" name="accountId">
                      <select
                        id="accountId"
                        name="accountId"
                        className="field-select"
                        defaultValue={String(row?.accountId || "")}
                        disabled={isImported}
                      >
                        <option value="">Registro manual</option>
                        {data.accounts
                          .filter((a) => a.currency === "BRL")
                          .map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.institution} · {account.name}
                            </option>
                          ))}
                      </select>
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
                      <select
                        id="icon"
                        name="icon"
                        className="field-select"
                        defaultValue={String(row?.icon || "layers")}
                      >
                        {[
                          ["house", "Casa"],
                          ["coffee", "Estilo de vida"],
                          ["sprout", "Futuro"],
                          ["briefcase", "Trabalho"],
                          ["plane", "Viagem"],
                          ["heart", "Saúde"],
                          ["car", "Transporte"],
                          ["layers", "Outros"],
                        ].map(([v, l]) => (
                          <option value={v} key={v}>
                            {l}
                          </option>
                        ))}
                      </select>
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
                      <select
                        id="icon"
                        name="icon"
                        className="field-select"
                        defaultValue={String(row?.icon || "target")}
                      >
                        {[
                          ["target", "Objetivo"],
                          ["shield", "Reserva"],
                          ["plane", "Viagem"],
                          ["house", "Casa"],
                          ["car", "Carro"],
                        ].map(([v, l]) => (
                          <option value={v} key={v}>
                            {l}
                          </option>
                        ))}
                      </select>
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
                      <select
                        id="type"
                        name="type"
                        className="field-select"
                        defaultValue={String(row?.type || "FIXED_INCOME")}
                        disabled={isImported}
                      >
                        {[
                          ["FIXED_INCOME", "Renda fixa"],
                          ["EQUITY", "Ações"],
                          ["ETF", "ETFs"],
                          ["MUTUAL_FUND", "Fundos"],
                          ["SECURITY", "Previdência"],
                          ["COE", "COE"],
                          ["OTHER", "Outros"],
                        ].map(([v, l]) => (
                          <option value={v} key={v}>
                            {l}
                          </option>
                        ))}
                      </select>
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
                    {isImported ? (
                      <div className="form-field">
                        <span className="muted text-xs">
                          O custo de aquisição não é informado pela integração.
                        </span>
                        <input type="hidden" name="invested" value="0" />
                      </div>
                    ) : (
                      <Field title="Valor aplicado (R$)" name="invested">
                        <Input
                          id="invested"
                          name="invested"
                          inputMode="decimal"
                          defaultValue={moneyValue(row?.invested) || "0,00"}
                          required
                        />
                      </Field>
                    )}
                  </div>
                  {groupField}
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
              {row && !isImported && !form.contribute && (
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
