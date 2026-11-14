"use client";

import { useState } from "react";
import {
  DatePicker,
  DatePickerTrigger,
  DatePickerContent,
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarNext,
  CalendarPrevious,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
} from "@/components/ui/date-picker";
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
  const [view, setView] = useState(value.slice(0, 7));
  const label = new Intl.DateTimeFormat("pt-BR").format(
    new Date(value + "T12:00:00"),
  );
  function apply(next: string) {
    setValue(next);
    setView(next.slice(0, 7));
    setOpen(false);
  }
  return (
    <DatePicker
      locale="pt-BR"
      weekStartsOn={0}
      value={value}
      month={view}
      onMonthChange={setView}
      onValueChange={(next) => {
        if (typeof next === "string" && next) apply(next);
      }}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setView(value.slice(0, 7));
      }}
      disabled={disabled}
      name="deadline"
      required
      showOutsideDays={false}
    >
      <DatePickerTrigger
        id="deadline"
        className={`${inputClassName} goal-deadline-trigger`}
        aria-label={`Escolher prazo: ${label}`}
      >
        Para {label}
      </DatePickerTrigger>
      <DatePickerContent
        align="start"
        sideOffset={8}
        className="period-picker-panel t-dropdown goal-deadline-panel"
      >
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
            <CalendarPrevious className="icon-button" aria-label="Mês anterior">
              <CaretLeft size={15} />
            </CalendarPrevious>
            <CalendarHeading render={<strong />} />
            <CalendarNext className="icon-button" aria-label="Próximo mês">
              <CaretRight size={15} />
            </CalendarNext>
          </div>
          <CalendarGrid className="sdk-calendar-grid" aria-label="Dia do prazo">
            <CalendarWeekdays className="sdk-calendar-weekdays">
              {(index) => <CalendarWeekday index={index} />}
            </CalendarWeekdays>
            <CalendarWeeks>
              {(cell) => (
                <CalendarDay value={cell.date} className="period-month" />
              )}
            </CalendarWeeks>
          </CalendarGrid>
        </div>
      </DatePickerContent>
    </DatePicker>
  );
}
