"use client";
import { createContext, useContext, type ComponentProps } from "react";
export const PrivacyContext = createContext(false);
export function PrivateValue({
  children,
  as: Tag = "span",
  ...props
}: ComponentProps<"span"> & { as?: "span" | "small" | "strong" }) {
  const hidden = useContext(PrivacyContext);
  return <Tag {...props}>{hidden ? "••••••" : children}</Tag>;
}
