const PRESS_HOLD_MS = 220;
const PRESS_RELEASE_MS = 140;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function findSidebarNavItem(ref: string) {
  if (typeof document === "undefined") return null;
  const items = document.querySelectorAll<HTMLElement>(
    ".sidebar-nav .nav-item[aria-label]",
  );
  for (const item of items) {
    if (item.getAttribute("aria-label") === ref) return item;
  }
  return null;
}

/** Brief press look on a sidebar nav control before the UI SDK click. */
export async function previewSidebarAgentPress(ref: string) {
  const item = findSidebarNavItem(ref);
  if (!item) return;

  item.scrollIntoView({ block: "nearest", inline: "nearest" });
  item.setAttribute("data-agent-press", "");

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  await wait(reduced ? 80 : PRESS_HOLD_MS);

  return async () => {
    await wait(reduced ? 40 : PRESS_RELEASE_MS);
    item.removeAttribute("data-agent-press");
  };
}
