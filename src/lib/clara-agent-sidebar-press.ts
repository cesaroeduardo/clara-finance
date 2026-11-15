import { playAgentCursorPress } from "@/lib/clara-agent-cursor";

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

/** Cursor glide + press look on a sidebar nav control before the UI SDK click. */
export async function previewSidebarAgentPress(ref: string) {
  const item = findSidebarNavItem(ref);
  if (!item) return;
  return playAgentCursorPress(item);
}
