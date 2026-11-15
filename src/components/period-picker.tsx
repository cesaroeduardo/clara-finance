"use client";

import { useMemo, useState } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { CaretLeft, CaretRight } from "@/components/icons";
import { Toggle, ToggleGroup } from "@/components/ui/toggle";
import { AnimatedLabel } from "@/components/finance-motion";
import {
  type AppPeriod,
  currentAppPeriod,
  periodLabel,
  periodMonthBounds,
} from "@/lib/analytics";
import { monthKey } from "@/lib/format";

const MONTH_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

function monthInYear(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function rangeRole(
  key: string,
  fromMonth: string,
  toMonth: string,
): "single" | "start" | "end" | "middle" | null {
  if (key < fromMonth || key > toMonth) return null;
  if (fromMonth === toMonth) return "single";
  if (key === fromMonth) return "start";
  if (key === toMonth) return "end";
  return "middle";
}

export function PeriodPicker({
  period,
  direction,
  onPeriodChange,
  onShift,
}: {
  period: AppPeriod;
  direction: 1 | -1;
  onPeriodChange: (next: AppPeriod, direction: 1 | -1) => void;
  onShift: (delta: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const { fromMonth, toMonth } = periodMonthBounds(period);
  const [viewYear, setViewYear] = useState(() => Number(toMonth.slice(0, 4)));
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const label = useMemo(() => periodLabel(period), [period]);
  const todayMonth = monthKey();

  function apply(next: AppPeriod) {
    const nextLabel = periodLabel(next);
    const dir: 1 | -1 = nextLabel > label ? 1 : -1;
    onPeriodChange(next, dir);
    setDraftStart(null);
    setOpen(false);
  }

  function selectMonth(key: string) {
    if (!draftStart) {
      setDraftStart(key);
      onPeriodChange({ mode: "month", month: key }, key > toMonth ? 1 : -1);
      return;
    }
    if (draftStart === key) {
      apply({ mode: "month", month: key });
      return;
    }
    const from = draftStart < key ? draftStart : key;
    const to = draftStart < key ? key : draftStart;
    apply({ mode: "range", from, to });
  }

  const highlightFrom = draftStart || fromMonth;
  const highlightTo = draftStart || toMonth;

  return (
    <div className="period-picker">
      <button
        type="button"
        className="icon-button"
        disabled={period.mode === "all"}
        aria-label="Período anterior"
        onClick={() => onShift(-1)}
      >
        <CaretLeft size={17} />
      </button>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setViewYear(Number(toMonth.slice(0, 4)));
            setDraftStart(null);
          }
        }}
      >
        <PopoverTrigger
          type="button"
          className="period-label period-label-trigger"
          data-mode={period.mode}
          aria-label="Escolher período"
        >
          <AnimatedLabel value={label} direction={direction} />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="period-picker-panel t-dropdown"
        >
          <div className="period-picker-presets">
            <button
              type="button"
              className={`period-preset${period.mode === "month" && period.month === todayMonth ? " is-active" : ""}`}
              onClick={() => apply(currentAppPeriod())}
            >
              Este mês
            </button>
            <button
              type="button"
              className={`period-preset${period.mode === "last3" ? " is-active" : ""}`}
              onClick={() => apply({ mode: "last3", end: todayMonth })}
            >
              Últimos 3 meses
            </button>
            <button
              type="button"
              className={`period-preset${period.mode === "year" && period.year === Number(todayMonth.slice(0, 4)) ? " is-active" : ""}`}
              onClick={() =>
                apply({
                  mode: "year",
                  year: Number(todayMonth.slice(0, 4)),
                })
              }
            >
              Este ano
            </button>
            <button
              type="button"
              className={`period-preset${period.mode === "all" ? " is-active" : ""}`}
              onClick={() => apply({ mode: "all" })}
            >
              Todo o período
            </button>
          </div>

          <div className="period-picker-divider" aria-hidden="true" />

          <div className="period-picker-calendar">
            <div className="period-picker-year">
              <button
                type="button"
                className="icon-button"
                aria-label="Ano anterior"
                onClick={() => setViewYear((year) => year - 1)}
              >
                <CaretLeft size={15} />
              </button>
              <strong>{viewYear}</strong>
              <button
                type="button"
                className="icon-button"
                aria-label="Próximo ano"
                onClick={() => setViewYear((year) => year + 1)}
              >
                <CaretRight size={15} />
              </button>
            </div>

            <ToggleGroup
              multiple
              className="period-picker-grid"
              aria-label="Meses"
              value={MONTH_SHORT.flatMap((_, i) => {
                const key = monthInYear(viewYear, i);
                return period.mode !== "all" &&
                  rangeRole(key, highlightFrom, highlightTo)
                  ? [key]
                  : [];
              })}
              onValueChange={(next, details) => {
                if (details.reason !== "item-press") return;
                const previous = MONTH_SHORT.map((_, i) =>
                  monthInYear(viewYear, i),
                ).filter(
                  (key) =>
                    period.mode !== "all" &&
                    rangeRole(key, highlightFrom, highlightTo),
                );
                const changed =
                  next.find((key) => !previous.includes(key)) ??
                  previous.find((key) => !next.includes(key));
                if (changed) selectMonth(changed);
              }}
            >
              {MONTH_SHORT.map((name, index) => {
                const key = monthInYear(viewYear, index);
                const role =
                  period.mode === "all" && !draftStart
                    ? null
                    : rangeRole(key, highlightFrom, highlightTo);
                const isDraft = draftStart === key;
                return (
                  <Toggle
                    value={key}
                    key={key}
                    className={`period-month${role ? ` is-${role}` : ""}${isDraft && !role ? " is-draft" : ""}`}
                  >
                    {name}
                  </Toggle>
                );
              })}
            </ToggleGroup>

            <div className="period-picker-actions">
              <button
                type="button"
                className="period-picker-action"
                onClick={() => apply(currentAppPeriod())}
              >
                Limpar
              </button>
              <button
                type="button"
                className="period-picker-action"
                onClick={() => apply(currentAppPeriod())}
              >
                Este mês
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        className="icon-button"
        disabled={period.mode === "all"}
        aria-label="Próximo período"
        onClick={() => onShift(1)}
      >
        <CaretRight size={17} />
      </button>
    </div>
  );
}
