"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ScrollFadeProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Solid color that fades out; defaults to --card. */
  color?: string;
};

export function ScrollFade({
  children,
  className,
  contentClassName,
  color,
}: ScrollFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const overflow = max > 2;
    setEdges({
      top: overflow && el.scrollTop > 2,
      bottom: overflow && el.scrollTop < max - 2,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [update, children]);

  return (
    <div
      className={cn("scroll-fade", className)}
      data-top={edges.top ? "" : undefined}
      data-bottom={edges.bottom ? "" : undefined}
      style={
        color
          ? ({ "--scroll-fade-color": color } as React.CSSProperties)
          : undefined
      }
    >
      <div ref={ref} className={cn("scroll-fade-viewport", contentClassName)}>
        {children}
      </div>
      <div className="scroll-fade-mask scroll-fade-mask-top" aria-hidden="true" />
      <div
        className="scroll-fade-mask scroll-fade-mask-bottom"
        aria-hidden="true"
      />
    </div>
  );
}
