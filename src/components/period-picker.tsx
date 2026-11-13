"use client";

import { useEffect, useMemo, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
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

  useEffect(() => {
    if (!open) return;
    setViewYear(Number(toMonth.slice(0, 4)));
    setDraftStart(null);
  }, [open]);

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
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          type="button"
          className="period-label period-label-trigger"
          data-mode={period.mode}
          aria-label="Escolher período"
        >
          <AnimatedLabel value={label} direction={direction} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={8}>
            <Popover.Popup className="period-picker-panel t-dropdown">
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

                <div
                  className="period-picker-grid"
                  role="grid"
                  aria-label="Meses"
                >
                  {MONTH_SHORT.map((name, index) => {
                    const key = monthInYear(viewYear, index);
                    const role =
                      period.mode === "all" && !draftStart
                        ? null
                        : rangeRole(key, highlightFrom, highlightTo);
                    const isDraft = draftStart === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="gridcell"
                        className={`period-month${role ? ` is-${role}` : ""}${isDraft && !role ? " is-draft" : ""}`}
                        aria-pressed={!!role}
                        onClick={() => selectMonth(key)}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>

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
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
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
