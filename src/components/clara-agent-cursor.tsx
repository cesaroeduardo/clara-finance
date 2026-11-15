"use client";

import { HandPointing } from "@/components/icons";
import { ClaraMark } from "@/components/clara-mark";
import { ClaraType } from "@/components/clara-type";

/** Tip of the Phosphor HandPointing glyph in a 28×28 box. */
export const CLARA_CURSOR_HOTSPOT = { x: 10, y: 4 };

export function ClaraAgentCursor({
  x,
  y,
  scale = 1,
  pressing = false,
  visible = true,
  moveMs = 0,
}: {
  x: number;
  y: number;
  scale?: number;
  pressing?: boolean;
  visible?: boolean;
  moveMs?: number;
}) {
  return (
    <div
      className="clara-agent-cursor"
      data-pressing={pressing || undefined}
      data-visible={visible ? "true" : "false"}
      aria-hidden="true"
      style={{
        transform: `translate3d(${x - CLARA_CURSOR_HOTSPOT.x}px, ${y - CLARA_CURSOR_HOTSPOT.y}px, 0) scale(${scale})`,
        transition: [
          moveMs > 0
            ? `transform ${moveMs}ms var(--motion-ease-out, cubic-bezier(0.22, 1, 0.36, 1))`
            : "transform 120ms var(--motion-ease-out, cubic-bezier(0.22, 1, 0.36, 1))",
          "opacity 160ms ease-out",
        ].join(", "),
      }}
    >
      <div className="clara-agent-cursor-stack">
        <HandPointing
          className="clara-agent-cursor-pointer"
          size={28}
          weight="fill"
          aria-hidden="true"
        />
        <div className="clara-agent-cursor-label">
          <ClaraMark className="clara-agent-cursor-mark brand-mark" />
          <ClaraType className="clara-agent-cursor-type brand-type" />
        </div>
      </div>
    </div>
  );
}
