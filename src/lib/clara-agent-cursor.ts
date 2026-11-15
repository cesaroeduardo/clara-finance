"use client";

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ClaraAgentCursor } from "@/components/clara-agent-cursor";

type Point = { x: number; y: number };

type CursorFrame = {
  x: number;
  y: number;
  scale: number;
  pressing: boolean;
  visible: boolean;
  moveMs: number;
};

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let frame: CursorFrame = {
  x: 0,
  y: 0,
  scale: 1,
  pressing: false,
  visible: false,
  moveMs: 0,
};

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function ensureRoot() {
  if (typeof document === "undefined") return null;
  if (!host) {
    host = document.createElement("div");
    host.className = "clara-agent-cursor-host";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  return root;
}

function paint(next: Partial<CursorFrame>) {
  frame = { ...frame, ...next };
  const r = ensureRoot();
  if (!r) return;
  r.render(
    createElement(ClaraAgentCursor, {
      x: frame.x,
      y: frame.y,
      scale: frame.scale,
      pressing: frame.pressing,
      visible: frame.visible,
      moveMs: frame.moveMs,
    }),
  );
}

function clear() {
  frame = {
    x: 0,
    y: 0,
    scale: 1,
    pressing: false,
    visible: false,
    moveMs: 0,
  };
  root?.render(null);
}

function pointFromRect(rect: DOMRect): Point {
  return {
    x: rect.left + Math.min(rect.width * 0.55, rect.width - 12),
    y: rect.top + rect.height / 2,
  };
}

function startPoint(): Point {
  const agent =
    document.querySelector<HTMLElement>(".clara-agent-float") ??
    document.querySelector<HTMLElement>(".clara-agent-launcher");
  if (agent) {
    const rect = agent.getBoundingClientRect();
    return { x: rect.left + 36, y: rect.top + 40 };
  }
  return {
    x: Math.max(48, window.innerWidth - 88),
    y: Math.max(48, window.innerHeight - 120),
  };
}

/** Glide the Clara cursor onto a control, show a press, then return release cleanup. */
export async function playAgentCursorPress(target: HTMLElement) {
  if (typeof document === "undefined") return;

  target.scrollIntoView({ block: "nearest", inline: "nearest" });
  await wait(40);

  const reduced = prefersReducedMotion();
  const from = startPoint();
  const to = pointFromRect(target.getBoundingClientRect());
  const moveMs = reduced ? 0 : 560;

  // Park at the start without easing, then glide.
  paint({
    x: from.x,
    y: from.y,
    scale: 1,
    pressing: false,
    visible: true,
    moveMs: 0,
  });
  await wait(32);

  if (reduced) {
    paint({ x: to.x, y: to.y, moveMs: 0 });
    await wait(70);
  } else {
    paint({ x: to.x, y: to.y, moveMs });
    await wait(moveMs);
  }

  paint({
    x: to.x,
    y: to.y,
    scale: 0.92,
    pressing: true,
    moveMs: reduced ? 0 : 120,
  });
  target.setAttribute("data-agent-press", "");
  await wait(reduced ? 70 : 200);

  return async () => {
    paint({
      x: to.x,
      y: to.y,
      scale: 1,
      pressing: false,
      moveMs: reduced ? 0 : 120,
    });
    await wait(reduced ? 40 : 120);
    target.removeAttribute("data-agent-press");
    paint({ visible: false, moveMs: 0 });
    await wait(reduced ? 40 : 160);
    clear();
  };
}
