"use client";
import * as React from "react";
import {
  NumberInput as Primitive,
  NumberInputControl,
  NumberInputGroup,
} from "@ui-sdk/react/number-input";
import { cn } from "@/lib/utils";
import { inputClassName } from "./input";
type Props = Pick<
  React.ComponentProps<"input">,
  "id" | "name" | "required" | "disabled" | "className" | "aria-label"
> & {
  defaultValue?: string | number;
  min?: number;
  max?: number;
  step?: number;
};
export function NumberInput({
  defaultValue,
  min,
  max,
  step = 1,
  name,
  required,
  disabled,
  className,
  ...props
}: Props) {
  return (
    <Primitive
      name={name}
      defaultValue={defaultValue === undefined ? null : Number(defaultValue)}
      min={min}
      max={max}
      step={step}
      required={required}
      disabled={disabled}
      locale="pt-BR"
      format={{ useGrouping: false }}
    >
      <NumberInputGroup>
        <NumberInputControl
          className={cn(inputClassName, className)}
          {...props}
        />
      </NumberInputGroup>
    </Primitive>
  );
}
