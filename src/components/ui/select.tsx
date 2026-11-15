"use client";

import * as React from "react";
import * as SelectPrimitive from "@ui-sdk/react/select";
import { cn } from "@/lib/utils";
import {
  CaretDown as ChevronDownIcon,
  Check as CheckIcon,
} from "@/components/icons";

const Select = SelectPrimitive.Select;

function SelectGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  );
}

function SelectValue({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.SelectValue>) {
  return (
    <SelectPrimitive.SelectValue
      data-slot="select-value"
      className={cn("flex flex-1 truncate text-left", className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof SelectPrimitive.SelectTrigger>,
  "children"
> & { children?: React.ReactNode; size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.SelectTrigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-full items-center justify-between gap-1.5 rounded-[7px] border border-input bg-card py-0 pr-2 pl-2.5 text-[11px] text-foreground whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-7 data-popup-open:border-ring [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon
        weight="bold"
        className="pointer-events-none size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
    </SelectPrimitive.SelectTrigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.SelectContent>) {
  return (
    <SelectPrimitive.SelectContent
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      alignItemWithTrigger={alignItemWithTrigger}
      className={cn(
        "t-dropdown clara-select-content relative isolate z-50 max-h-(--available-height) w-max min-w-[max(12rem,var(--anchor-width))] max-w-[min(22rem,var(--available-width,100vw))] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-[10px] bg-popover p-1 text-popover-foreground outline-none",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.SelectList className="clara-select-list">
        {children}
      </SelectPrimitive.SelectList>
    </SelectPrimitive.SelectContent>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn(
        "px-2 py-1.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SelectPrimitive.SelectItem>, "children"> & {
  children?: React.ReactNode;
}) {
  return (
    <SelectPrimitive.SelectItem
      data-slot="select-item"
      className={cn(
        "clara-select-item relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-[12px] text-foreground outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <span className="flex flex-1 gap-2 whitespace-nowrap">{children}</span>
      <SelectPrimitive.SelectItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-foreground" />
        }
      >
        <CheckIcon weight="bold" className="size-3.5" />
      </SelectPrimitive.SelectItemIndicator>
    </SelectPrimitive.SelectItem>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.SelectSeparator>) {
  return (
    <SelectPrimitive.SelectSeparator
      data-slot="select-separator"
      className={cn("divider pointer-events-none my-1", className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
