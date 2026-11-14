// TUFFUI (https://tuffui.com) · MIT License · Copyright (c) 2026 TUFFUI contributors
"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const spinnerSizes = { sm: "size-3.5", md: "size-4", lg: "size-6" } as const;

export type SpinnerProps = {
  size?: keyof typeof spinnerSizes;
  label?: string;
  showLabel?: boolean;
  className?: string;
};

export function Spinner({
  size = "md",
  label = "Carregando",
  showLabel = false,
  className,
}: SpinnerProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-2 text-muted-foreground",
        className,
      )}
    >
      <CircleNotch
        weight="bold"
        aria-hidden="true"
        className={cn(
          "shrink-0 animate-spin [animation-duration:700ms] motion-reduce:animate-none",
          spinnerSizes[size],
        )}
      />
      {showLabel ? (
        <span className="text-[0.8125rem]">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  );
}
