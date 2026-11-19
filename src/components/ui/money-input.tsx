"use client";
import * as React from "react";
import { maskMoneyInput } from "@/lib/format";
import { Input } from "./input";

type Props = Omit<
  React.ComponentProps<"input">,
  "type" | "inputMode" | "value" | "defaultValue"
> & {
  defaultValue?: string | number | readonly string[];
};

export function MoneyInput({ defaultValue, onChange, ...props }: Props) {
  const [value, setValue] = React.useState(() =>
    maskMoneyInput(String(defaultValue ?? "")),
  );

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(event) => {
        const next = maskMoneyInput(event.target.value);
        setValue(next);
        if (!onChange) return;
        event.target.value = next;
        onChange(event);
      }}
    />
  );
}
