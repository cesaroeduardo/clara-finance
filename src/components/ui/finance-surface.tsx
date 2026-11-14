"use client";

import type { ReactNode } from "react";
import type { PartProps } from "@ui-sdk/react/primitive";
import { cn } from "@/lib/utils";
import { Panel, Shell } from "./surface";

export function FinanceSurface({
  header,
  children,
  className,
  ...props
}: Omit<PartProps<"div">, "children"> & {
  header?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Shell
      render={<div />}
      className={cn("finance-card tuff-finance-shell", className)}
      {...props}
    >
      {header}
      <Panel className="tuff-finance-body">{children}</Panel>
    </Shell>
  );
}
