"use client";
import { createContext, useContext, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const PrivacyContext = createContext(false);

export function PrivateValue({
  children,
  as: Tag = "span",
  className,
  ...props
}: ComponentProps<"span"> & { as?: "span" | "small" | "strong" }) {
  const hidden = useContext(PrivacyContext);
  return (
    <Tag className={cn("amount", className)} {...props}>
      {hidden ? <span className="sr-only">Valor oculto</span> : null}
      <span aria-hidden={hidden || undefined}>{children}</span>
    </Tag>
  );
}
