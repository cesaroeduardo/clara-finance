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

/** Keep the cursor above ui-sdk menus, which live in the browser top layer. */
function promoteCursorLayer() {
  if (!host || typeof host.showPopover !== "function") return;
  try {
    if (!host.hasAttribute("popover")) {
      host.setAttribute("popover", "manual");
    }
    if (host.matches(":popover-open")) {
      host.hidePopover();
    }
    host.showPopover();
  } catch {
    // Browsers without Popover API still get the high z-index fallback.
  }
}

function hideCursorLayer() {
  if (!host || typeof host.hidePopover !== "function") return;
  try {
    if (host.matches(":popover-open")) host.hidePopover();
  } catch {
    // ignore
  }
}

function ensureRoot() {
  if (typeof document === "undefined") return null;
  if (!host) {
    host = document.createElement("div");
    host.className = "clara-agent-cursor-host";
    host.setAttribute("popover", "manual");
    document.body.appendChild(host);
    root = createRoot(host);
  }
  return root;
}

function paint(next: Partial<CursorFrame>) {
  const wasVisible = frame.visible;
  frame = { ...frame, ...next };
  const r = ensureRoot();
  if (!r) return;
  if (frame.visible && !wasVisible) promoteCursorLayer();
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
  hideCursorLayer();
  root?.render(null);
}

function pointFromRect(rect: DOMRect): Point {
  return {
    x: rect.left + Math.min(rect.width * 0.55, rect.width - 12),
    y: rect.top + rect.height / 2,
  };
}

function startPoint(): Point {
  if (frame.visible) return { x: frame.x, y: frame.y };
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

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

function pointerInit(point: Point): PointerEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: point.x,
    clientY: point.y,
    screenX: point.x,
    screenY: point.y,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    buttons: 0,
    view: window,
  };
}

/** Drive ui-sdk menu highlight (`data-highlighted`) under the agent cursor. */
function hoverAt(point: Point, prefer?: HTMLElement) {
  let node: Element | null = prefer ?? null;
  if (!node) {
    node = document.elementFromPoint(point.x, point.y);
  }
  if (!(node instanceof Element)) return;

  const item = node.closest(
    '[role="menuitem"], [data-slot="dropdown-menu-item"]',
  );
  const target =
    item instanceof HTMLElement
      ? item
      : node instanceof HTMLElement
        ? node
        : null;
  if (!target) return;

  const opts = pointerInit(point);
  target.dispatchEvent(new PointerEvent("pointerover", opts));
  target.dispatchEvent(
    new PointerEvent("pointerenter", { ...opts, bubbles: false }),
  );
  target.dispatchEvent(new PointerEvent("pointermove", opts));
  target.dispatchEvent(new MouseEvent("mouseover", opts));
  target.dispatchEvent(
    new MouseEvent("mouseenter", { ...opts, bubbles: false }),
  );
  target.dispatchEvent(new MouseEvent("mousemove", opts));
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

async function animateGlide(from: Point, to: Point, duration: number) {
  const started = performance.now();
  for (;;) {
    const t = Math.min(1, (performance.now() - started) / duration);
    const e = easeOutCubic(t);
    const point = {
      x: from.x + (to.x - from.x) * e,
      y: from.y + (to.y - from.y) * e,
    };
    paint({
      x: point.x,
      y: point.y,
      scale: 1,
      pressing: false,
      visible: true,
      moveMs: 0,
    });
    hoverAt(point);
    if (t >= 1) break;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

async function glideTo(target: HTMLElement) {
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
  await wait(40);

  const reduced = prefersReducedMotion();
  const from = startPoint();
  const to = pointFromRect(target.getBoundingClientRect());
  const moveMs = reduced ? 0 : 560;

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
    await animateGlide(from, to, moveMs);
  }

  hoverAt(to, target);
  return { to, reduced };
}

async function fadeOut(to: Point, reduced: boolean) {
  paint({
    x: to.x,
    y: to.y,
    scale: 1,
    pressing: false,
    moveMs: reduced ? 0 : 120,
  });
  await wait(reduced ? 40 : 100);
  paint({ visible: false, moveMs: 0 });
  await wait(reduced ? 40 : 160);
  clear();
}

/** Glide onto a control, show a press, then return release cleanup. */
export async function playAgentCursorPress(target: HTMLElement) {
  if (typeof document === "undefined") return;

  const { to, reduced } = await glideTo(target);

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
    target.removeAttribute("data-agent-press");
    await fadeOut(to, reduced);
  };
}

/** Glide, press visually, fire a real click, then optionally keep the cursor up. */
export async function playAgentCursorClick(
  target: HTMLElement,
  options?: { dismiss?: boolean },
) {
  if (typeof document === "undefined") return;

  const dismiss = options?.dismiss ?? true;
  const { to, reduced } = await glideTo(target);

  paint({
    x: to.x,
    y: to.y,
    scale: 0.92,
    pressing: true,
    moveMs: reduced ? 0 : 120,
  });
  target.setAttribute("data-agent-press", "");
  await wait(reduced ? 50 : 140);
  target.click();
  target.removeAttribute("data-agent-press");
  paint({
    x: to.x,
    y: to.y,
    scale: 1,
    pressing: false,
    moveMs: reduced ? 0 : 100,
  });
  await wait(reduced ? 40 : 120);

  if (dismiss) await fadeOut(to, reduced);
}

/** Glide onto a control and linger, without pressing. */
export async function playAgentCursorPoint(target: HTMLElement) {
  if (typeof document === "undefined") return;

  const { to, reduced } = await glideTo(target);
  target.setAttribute("data-agent-point", "");
  await wait(reduced ? 120 : 420);
  target.removeAttribute("data-agent-point");
  await fadeOut(to, reduced);
}

async function waitForGoalRoot(goalId: string) {
  const selector = `[data-goal-id="${cssEscape(goalId)}"]`;
  for (let i = 0; i < 24; i++) {
    const found = document.querySelector(selector);
    if (found instanceof HTMLElement) return found;
    await wait(50);
  }
  return null;
}

async function waitForMenuItem(label: string) {
  for (let i = 0; i < 40; i++) {
    const items = document.querySelectorAll<HTMLElement>(
      '[role="menuitem"], [data-slot="dropdown-menu-item"]',
    );
    for (const item of items) {
      const text = item.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!text.includes(label)) continue;
      if (item.getAttribute("aria-disabled") === "true") continue;
      if (item.hasAttribute("data-disabled")) continue;
      return item;
    }
    await wait(50);
  }
  return null;
}

/** Open the goal ⋮ menu and click Concluir via the agent cursor. */
export async function completeGoalWithAgentCursor(goal: {
  id: string;
  name: string;
}): Promise<boolean> {
  if (typeof document === "undefined") return false;

  const rootEl = await waitForGoalRoot(goal.id);
  if (!rootEl) return false;

  const optionsLabel = `Opções da meta ${goal.name}`;
  const optionsSelector = `button[aria-label="${cssEscape(optionsLabel)}"]`;
  const options =
    rootEl.querySelector<HTMLElement>(optionsSelector) ??
    document.querySelector<HTMLElement>(optionsSelector);
  if (!options) return false;

  await playAgentCursorClick(options, { dismiss: false });

  const conclude = await waitForMenuItem("Concluir");
  if (!conclude) {
    await fadeOut({ x: frame.x, y: frame.y }, prefersReducedMotion());
    return false;
  }

  // Menu just entered the top layer; restack the cursor above it.
  promoteCursorLayer();
  await playAgentCursorClick(conclude, { dismiss: true });
  // Let the menu mutate + celebration start before the chat continues.
  await wait(120);
  return true;
}
