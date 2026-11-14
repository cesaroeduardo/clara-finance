"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  CircleNotch,
  DotsThree,
  Eye,
  PencilSimple,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { prepareGoalCelebration } from "@/lib/goal-celebration";
import type { Goal } from "@/lib/types";
import type { FormState, Mutate } from "./finance-form";

export function GoalContextMenu({
  goal,
  openForm,
  mutate,
  children,
  onView,
  row = false,
}: {
  goal: Goal;
  openForm: (form: FormState) => void;
  mutate: Mutate;
  children: (menu: ReactNode) => ReactNode;
  onView: () => void;
  row?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggleCompleted() {
    if (busy) return;
    setBusy(true);
    const celebrate = !goal.completed ? prepareGoalCelebration() : undefined;
    try {
      await mutate("goals", { ...goal, completed: !goal.completed }, "PATCH");
      celebrate?.(true);
    } catch (error) {
      celebrate?.(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a meta.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await mutate("goals", { id: goal.id }, "DELETE");
      setConfirmDelete(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a meta.",
      );
    } finally {
      setBusy(false);
    }
  }

  function menuItems(kind: "context" | "dropdown") {
    const Item = kind === "context" ? ContextMenuItem : DropdownMenuItem;
    const Separator =
      kind === "context" ? ContextMenuSeparator : DropdownMenuSeparator;
    return (
      <>
        <Item disabled={busy} onSelect={onView}>
          <Eye /> Visualizar
        </Item>
        <Item
          disabled={busy}
          onSelect={() => openForm({ resource: "goals", record: { ...goal } })}
        >
          <PencilSimple /> Editar
        </Item>
        <Item
          disabled={busy || goal.completed}
          onSelect={() =>
            openForm({
              resource: "goals",
              record: { ...goal },
              contribute: true,
            })
          }
        >
          <Plus /> Registrar progresso
        </Item>
        <Item disabled={busy} onSelect={() => void toggleCompleted()}>
          {goal.completed ? <X /> : <Check />}
          {goal.completed ? "Marcar como não concluída" : "Concluir"}
        </Item>
        <Separator />
        <Item
          variant="destructive"
          disabled={busy}
          onSelect={() => {
            setError("");
            setConfirmDelete(true);
          }}
        >
          <Trash /> Excluir
        </Item>
      </>
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={row ? <tr /> : <div />}
          className={row ? "completed-goal-row" : "goal-context-trigger"}
          onClick={
            row
              ? (event) => {
                  if (
                    !(event.target as HTMLElement).closest(
                      "button, a, input, [role=menuitem]",
                    )
                  )
                    onView();
                }
              : undefined
          }
          onKeyDown={
            row
              ? (event) => {
                  if (
                    event.target === event.currentTarget &&
                    event.key === "Enter"
                  )
                    onView();
                }
              : undefined
          }
          tabIndex={0}
          aria-label={`Opções de ${goal.name}`}
        >
          {children(
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Opções da meta ${goal.name}`}
                  />
                }
              >
                <DotsThree size={18} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                {menuItems("dropdown")}
              </DropdownMenuContent>
            </DropdownMenu>,
          )}
        </ContextMenuTrigger>
        <ContextMenuContent>{menuItems("context")}</ContextMenuContent>
      </ContextMenu>
      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!busy) setConfirmDelete(open);
        }}
      >
        <DialogContent
          role="alertdialog"
          className="finance-dialog dialog-fixed-actions goal-delete-dialog sm:max-w-[420px] p-6"
          showCloseButton={false}
        >
          <div className="dialog-scroll-body">
            <DialogHeader>
              <DialogTitle>Excluir meta?</DialogTitle>
              <DialogDescription>
                A meta “{goal.name}” será excluída. Esta ação não pode ser
                desfeita.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </div>
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
              autoFocus
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy && <CircleNotch className="animate-spin" />}
              {busy ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
