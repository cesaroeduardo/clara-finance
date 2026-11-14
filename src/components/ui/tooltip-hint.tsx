// Adapted from TUFFUI Tooltip · MIT License · Copyright (c) 2026 TUFFUI contributors
"use client";
import {
  cloneElement,
  type ReactElement,
  type ReactNode,
  type ComponentProps,
} from "react";
import { Tooltip as Root, TooltipContent, TooltipTrigger } from "./tooltip";
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delay = 300,
  className,
  toggleable = false,
  open,
  onOpenChange,
}: {
  content: ReactNode;
  children: ReactElement<{ title?: string }>;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  delay?: number;
  className?: string;
  toggleable?: boolean;
  open?: boolean;
  onOpenChange?: ComponentProps<typeof Root>["onOpenChange"];
}) {
  return (
    <Root
      open={open}
      onOpenChange={onOpenChange}
      delay={delay}
      toggleable={toggleable}
    >
      <TooltipTrigger render={cloneElement(children, { title: undefined })} />
      <TooltipContent side={side} align={align} className={className}>
        {content}
      </TooltipContent>
    </Root>
  );
}
