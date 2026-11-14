"use client";
import * as React from "react";
import * as Primitive from "@ui-sdk/react/popover";
import { cn } from "@/lib/utils";
export const Popover = Primitive.Popover;
export const PopoverTrigger = Primitive.PopoverTrigger;
export const PopoverTitle = Primitive.PopoverTitle;
export const PopoverClose = Primitive.PopoverClose;
export function PopoverContent({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.PopoverContent>) {
  return (
    <Primitive.PopoverContent
      className={cn(
        "t-dropdown bg-popover text-popover-foreground outline-none",
        className,
      )}
      {...props}
    />
  );
}
