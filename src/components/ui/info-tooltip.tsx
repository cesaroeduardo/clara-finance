"use client";
import { type ReactNode } from "react";
import { Info } from "@phosphor-icons/react";
import { IconButton } from "./button";
import { Tooltip } from "./tooltip-hint";
export function InfoTooltip({
  label,
  content,
}: {
  label: string;
  content: ReactNode;
}) {
  return (
    <Tooltip toggleable content={content} align="end">
      <IconButton icon={Info} iconWeight="bold" label={label} size="icon-sm" />
    </Tooltip>
  );
}
