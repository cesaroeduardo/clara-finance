"use client";
import { NumberInput } from "@/components/ui/number-input";

import { useEffect, useState } from "react";
import { PencilSimple, Plus, Trash } from "@/components/icons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FieldSelect } from "./ui/field-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ScrollFade } from "./ui/scroll-fade";
import type { CategoryRule, FinanceData } from "@/lib/types";
import type { Mutate } from "./finance-form";
import { CategoryMark } from "./category-mark";
import { normalizeText } from "@/lib/categorize";

export type CategoryViewState = {
  view: "categories" | "configuration";
  categoryId: string;
};

export function CategoryRulesTable({
  categoryId,
  data,
  mutate,
  onCategoryChange,
  embedded = false,
  createRuleKey = 0,
}: {
  categoryId: string;
  data: FinanceData;
  mutate: Mutate;
  onCategoryChange: (categoryId: string) => void;
  embedded?: boolean;
  createRuleKey?: number;
}) {
  const [editing, setEditing] = useState<CategoryRule | "new" | null>(null);
  const [query, setQuery] = useState("");
  const rules = data.categoryRules.filter(
    (rule) =>
      (categoryId === "all" || rule.categoryId === categoryId) &&
      normalizeText(`${rule.match} ${rule.category}`).includes(
        normalizeText(query.trim()),
      ),
  );
  useEffect(() => {
    if (createRuleKey > 0) setEditing("new");
  }, [createRuleKey]);
  const addRule = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!data.categories.length}
      onClick={() => setEditing("new")}
    >
      <Plus size={14} />
      Adicionar regra
    </Button>
  );
  return (
    <>
      {!embedded && (
        <div className="section-top category-view-toolbar">{addRule}</div>
      )}
      <div
        className={
          embedded ? "category-rules-card" : "finance-card category-rules-card"
        }
        aria-label="Configuração de categorias"
      >
        <div className="category-rules-filters">
          <FieldSelect
            aria-label="Filtrar regras por categoria"
            value={categoryId}
            onValueChange={onCategoryChange}
            options={[
              {
                value: "all",
                label: "Todas as categorias",
                leading: <CategoryMark name="all" />,
              },
              ...data.categories.map((category) => ({
                value: category.id,
                label: category.name,
                leading: (
                  <CategoryMark
                    name={category.name}
                    color={category.color}
                    imageSlug={category.imageSlug}
                  />
                ),
              })),
            ]}
          />
          <Input
            aria-label="Buscar regra"
            placeholder="Buscar regra"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className="category-rules-help category-rules-table-help">
          Aplicadas na importação a novos lançamentos e aos que estão sem
          categoria. Classificações anteriores são mantidas.
        </p>
        {rules.length ? (
          <div className="table-scroll">
            <table
              className="transactions-table category-rules-table"
              aria-label="Regras de classificação"
            >
              <thead>
                <tr>
                  <th>Condição</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Prioridade</th>
                  <th>Situação</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      {rule.operator === "equals" ? "É igual a" : "Contém"}
                    </td>
                    <td className="category-rule-match">{rule.match}</td>
                    <td>
                      <span className="category-rule-category">
                        <CategoryMark
                          name={rule.category}
                          color={
                            data.categories.find(
                              (category) => category.id === rule.categoryId,
                            )?.color
                          }
                          imageSlug={
                            data.categories.find(
                              (category) => category.id === rule.categoryId,
                            )?.imageSlug
                          }
                        />
                        <span>{rule.category}</span>
                      </span>
                    </td>
                    <td>{rule.priority}</td>
                    <td>
                      <span
                        className={`category-rule-status${rule.active ? " is-active" : ""}`}
                      >
                        {rule.active ? "Ativa" : "Pausada"}
                      </span>
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar regra ${rule.match}`}
                        onClick={() => setEditing(rule)}
                      >
                        <PencilSimple size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="category-rules-help category-rules-empty" role="status">
            {query.trim()
              ? "Nenhuma regra encontrada."
              : categoryId === "all"
                ? "Nenhuma regra cadastrada."
                : "Nenhuma regra para esta categoria."}
          </p>
        )}
      </div>
      {editing && (
        <RuleDialog
          key={editing === "new" ? "new" : editing.id}
          rule={editing === "new" ? undefined : editing}
          categoryId={
            categoryId === "all" ? data.categories[0]?.id || "" : categoryId
          }
          data={data}
          mutate={mutate}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function RuleDialog({
  rule,
  categoryId,
  data,
  mutate,
  onClose,
}: {
  rule?: CategoryRule;
  categoryId: string;
  data: FinanceData;
  mutate: Mutate;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      await mutate(
        "category-rules",
        {
          ...(rule ? { id: rule.id } : {}),
          categoryId: fields.categoryId,
          match: fields.match,
          operator: fields.operator,
          priority: Number(fields.priority),
          active: fields.active === "yes",
        },
        rule ? "PATCH" : "POST",
      );
      setOpen(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a regra.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!rule) return;
    setBusy(true);
    setError("");
    try {
      await mutate("category-rules", { id: rule.id }, "DELETE");
      setOpen(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a regra.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!busy) setOpen(open);
      }}
      onOpenChangeComplete={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="finance-dialog dialog-fixed-actions sm:max-w-[440px] p-7">
        <form className="finance-form" onSubmit={save}>
          <ScrollFade
            className="dialog-scroll-fade"
            contentClassName="dialog-scroll-body"
            color="var(--popover)"
          >
            <DialogHeader>
              <DialogTitle>{rule ? "Editar regra" : "Nova regra"}</DialogTitle>
              <DialogDescription>
                Se mais de uma regra corresponder, a de menor número de
                prioridade será aplicada. Empates seguem a ordem de criação.
              </DialogDescription>
            </DialogHeader>
            <div className="form-field">
              <Label htmlFor="rule-operator">Condição</Label>
              <FieldSelect
                id="rule-operator"
                name="operator"
                defaultValue={rule?.operator || "contains"}
                options={[
                  { value: "contains", label: "Descrição contém" },
                  { value: "equals", label: "Descrição é igual a" },
                ]}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="rule-match">Texto da descrição</Label>
              <Input
                id="rule-match"
                name="match"
                defaultValue={rule?.match || ""}
                maxLength={160}
                required
                autoFocus
                placeholder="Ex.: nome do estabelecimento"
              />
            </div>
            <div className="form-field">
              <Label htmlFor="rule-category">Categoria</Label>
              <FieldSelect
                id="rule-category"
                name="categoryId"
                defaultValue={rule?.categoryId || categoryId}
                options={data.categories.map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
              />
            </div>
            <div className="form-row">
              <div className="form-field">
                <Label htmlFor="rule-priority">Prioridade</Label>
                <NumberInput
                  id="rule-priority"
                  name="priority"
                  min={0}
                  max={9999}
                  step={1}
                  required
                  defaultValue={rule?.priority ?? 0}
                />
              </div>
              <div className="form-field">
                <Label htmlFor="rule-active">Situação</Label>
                <FieldSelect
                  id="rule-active"
                  name="active"
                  defaultValue={rule?.active === false ? "no" : "yes"}
                  options={[
                    { value: "yes", label: "Ativa" },
                    { value: "no", label: "Pausada" },
                  ]}
                />
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </ScrollFade>
          <div className="form-actions">
            {rule && (
              <Button
                type="button"
                className="delete-btn"
                variant="ghost"
                disabled={busy}
                aria-label="Excluir regra"
                onClick={() => void remove()}
              >
                <Trash size={16} />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar regra"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
