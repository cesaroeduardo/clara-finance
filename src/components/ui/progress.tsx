"use client";

import * as ProgressPrimitive from "@ui-sdk/react/progress";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Progress({
  className,
  children,
  value,
  ...props
}: Omit<React.ComponentProps<typeof ProgressPrimitive.Progress>, "children"> & {
  children?: React.ReactNode;
}) {
  return (
    <ProgressPrimitive.Progress
      value={value}
      data-slot="progress"
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Progress>
  );
}

function ProgressTrack({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.ProgressTrack>) {
  return (
    <ProgressPrimitive.ProgressTrack
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className,
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

function ProgressIndicator({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.ProgressIndicator>) {
  return (
    <ProgressPrimitive.ProgressIndicator
      data-slot="progress-indicator"
      className={cn("h-full bg-primary transition-all", className)}
      {...props}
    />
  );
}

function ProgressLabel({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.ProgressLabel>) {
  return (
    <ProgressPrimitive.ProgressLabel
      className={cn("text-sm font-medium", className)}
      data-slot="progress-label"
      {...props}
    />
  );
}

function ProgressValue({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.ProgressValue>) {
  return (
    <ProgressPrimitive.ProgressValue
      className={cn(
        "ml-auto text-sm text-muted-foreground tabular-nums",
        className,
      )}
      data-slot="progress-value"
      {...props}
    />
  );
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
};
