"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  Info,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function useDocumentTheme(): NonNullable<ToasterProps["theme"]> {
  const [theme, setTheme] = useState<NonNullable<ToasterProps["theme"]>>("light");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

export function Toaster({ ...props }: ToasterProps) {
  const theme = useDocumentTheme();

  return (
    <Sonner
      theme={theme}
      className="clara-toaster"
      position="bottom-right"
      expand={false}
      visibleToasts={4}
      gap={12}
      offset={16}
      closeButton
      icons={{
        success: <CheckCircle weight="fill" className="clara-toast-icon success" />,
        info: <Info weight="fill" className="clara-toast-icon info" />,
        warning: <WarningCircle weight="fill" className="clara-toast-icon warning" />,
        error: <XCircle weight="fill" className="clara-toast-icon error" />,
      }}
      toastOptions={{
        classNames: {
          toast: "clara-toast",
          title: "clara-toast-title",
          description: "clara-toast-description",
          content: "clara-toast-content",
          icon: "clara-toast-icon-wrap",
          closeButton: "clara-toast-close",
          actionButton: "clara-toast-action",
          cancelButton: "clara-toast-cancel",
        },
      }}
      {...props}
    />
  );
}
