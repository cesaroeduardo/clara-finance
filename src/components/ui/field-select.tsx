"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY = "__empty__";

export type FieldSelectOption = {
  value: string;
  label: string;
  leading?: ReactNode;
};

type FieldSelectProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: FieldSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-label"?: string;
};

function toInternal(value: string) {
  return value === "" ? EMPTY : value;
}

function fromInternal(value: string) {
  return value === EMPTY ? "" : value;
}

export function FieldSelect({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  disabled,
  required,
  className,
  triggerClassName,
  contentClassName,
  "aria-label": ariaLabel,
}: FieldSelectProps) {
  const controlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(
    toInternal(defaultValue ?? options[0]?.value ?? ""),
  );
  const current = controlled ? toInternal(value) : uncontrolled;

  const setValue = (next: string) => {
    const external = fromInternal(next);
    if (!controlled) setUncontrolled(next);
    onValueChange?.(external);
  };

  const byValue = Object.fromEntries(
    options.map((option) => [toInternal(option.value), option]),
  );

  return (
    <Select
      id={id}
      value={current}
      onValueChange={(next) => {
        if (next == null) return;
        setValue(String(next));
      }}
      disabled={disabled}
      required={required}
      modal={false}
      items={options.map((option) => ({
        value: toInternal(option.value),
        label: option.label,
      }))}
    >
      {name ? (
        <input type="hidden" name={name} value={fromInternal(current)} />
      ) : null}
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn("field-select-trigger", triggerClassName, className)}
      >
        <SelectValue placeholder={placeholder}>
          {(selected) => {
            if (selected == null) return placeholder;
            const option = byValue[String(selected)];
            if (!option) return String(selected);
            return (
              <span className="field-select-option">
                {option.leading}
                <span className="field-select-option-label">{option.label}</span>
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        className={contentClassName}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value || EMPTY}
            value={toInternal(option.value)}
          >
            <span className="field-select-option">
              {option.leading}
              <span className="field-select-option-label">{option.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
