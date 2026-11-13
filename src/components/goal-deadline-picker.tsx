"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { inputClassName } from "@/components/ui/input";
import { localDate } from "@/lib/format";

function futureDate(days: number, months = 0) {
  const date = new Date();
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  date.setDate(Math.min(day, lastDay));
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export function GoalDeadlinePicker({
  defaultValue,
  disabled,
}: {
  defaultValue: string;
  disabled: boolean;
}) {
  const [value, setValue] = useState(defaultValue || futureDate(30));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() =>
    (defaultValue || futureDate(30)).slice(0, 7),
  );
  const [year, month] = view.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const selected = new Date(value + "T12:00:00");
  const label = new Intl.DateTimeFormat("pt-BR").format(selected);
  function apply(next: string) {
    setValue(next);
    setView(next.slice(0, 7));
    setOpen(false);
  }
  function shift(delta: number) {
    setView(localDate(new Date(year, month - 1 + delta, 1)).slice(0, 7));
  }
  return (
    <>
      <input type="hidden" name="deadline" value={value} />
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setView(value.slice(0, 7));
        }}
      >
        <Popover.Trigger
          id="deadline"
          type="button"
          className={`${inputClassName} goal-deadline-trigger`}
          disabled={disabled}
          aria-label={`Escolher prazo: ${label}`}
        >
          Para {label}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            side="bottom"
            align="start"
            sideOffset={8}
            className="goal-deadline-positioner"
          >
            <Popover.Popup className="period-picker-panel t-dropdown goal-deadline-panel">
              <div className="period-picker-presets">
                <button
                  type="button"
                  className="period-preset"
                  onClick={() => apply(futureDate(30))}
                >
                  Para 30 dias
                </button>
                <button
                  type="button"
                  className="period-preset"
                  onClick={() => apply(futureDate(0, 3))}
                >
                  Para 3 meses
                </button>
                <button
                  type="button"
                  className="period-preset"
                  onClick={() => apply(futureDate(0, 12))}
                >
                  Para 1 ano
                </button>
              </div>
              <div className="period-picker-divider" aria-hidden="true" />
              <div className="period-picker-calendar">
                <div className="period-picker-year">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Mês anterior"
                    onClick={() => shift(-1)}
                  >
                    <CaretLeft size={15} />
                  </button>
                  <strong>
                    {new Intl.DateTimeFormat("pt-BR", {
                      month: "long",
                      year: "numeric",
                    }).format(new Date(year, month - 1, 1))}
                  </strong>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Próximo mês"
                    onClick={() => shift(1)}
                  >
                    <CaretRight size={15} />
                  </button>
                </div>
                <div
                  className="goal-deadline-days"
                  role="group"
                  aria-label="Dia do prazo"
                >
                  {["D", "S", "T", "Q", "Q", "S", "S"].map((day, i) => (
                    <span key={i} aria-hidden="true">
                      {day}
                    </span>
                  ))}
                  {Array.from({ length: firstDay }, (_, i) => (
                    <span key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: days }, (_, i) => {
                    const date = `${view}-${String(i + 1).padStart(2, "0")}`;
                    return (
                      <button
                        type="button"
                        key={date}
                        className={`period-month${date === value ? " is-single" : ""}`}
                        aria-label={new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "long",
                        }).format(new Date(date + "T12:00:00"))}
                        aria-pressed={date === value}
                        onClick={() => apply(date)}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
