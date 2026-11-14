"use client";
import * as React from "react";
import * as Primitive from "@ui-sdk/react/tooltip";
import { cn } from "@/lib/utils";
const DelayContext = React.createContext(0);
export function TooltipProvider({
  delay = 0,
  children,
}: {
  delay?: number;
  children?: React.ReactNode;
}) {
  return <DelayContext value={delay}>{children}</DelayContext>;
}
export function Tooltip(props: React.ComponentProps<typeof Primitive.Tooltip>) {
  const delay = React.useContext(DelayContext);
  return <Primitive.Tooltip delay={delay} {...props} />;
}
export const TooltipTrigger = Primitive.TooltipTrigger;
export function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof Primitive.TooltipContent>) {
  return (
    <Primitive.TooltipContent
      side={side}
      sideOffset={sideOffset}
      className={cn(
        "z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background outline-none",
        className,
      )}
      {...props}
    />
  );
}
