"use client";
import { MagnifyingGlass } from "@/components/icons";
import { Kbd, useIsMac } from "@/components/ui/key-hint";
export type ShortcutPart =
  { type: "key"; value: string } | { type: "text"; value: string };

export function Keynodes({ parts }: { parts: ShortcutPart[] }) {
  return (
    <span className="keynodes" aria-hidden="true">
      {parts.map((part, index) =>
        part.type === "key" ? (
          <Kbd key={`${part.value}-${index}`} className="keynode">
            {part.value}
          </Kbd>
        ) : (
          <span key={`${part.value}-${index}`} className="keynode-sep">
            {part.value}
          </span>
        ),
      )}
    </span>
  );
}

export function CommandTrigger({ onOpen }: { onOpen: () => void }) {
  const isMac = useIsMac();
  return (
    <button
      type="button"
      className="sidebar-search command-trigger"
      onClick={onOpen}
      aria-label="Abrir paleta de comandos"
    >
      <MagnifyingGlass size={15} aria-hidden="true" />
      <span>Buscar</span>
      <Keynodes
        parts={[
          { type: "key", value: isMac ? "⌘" : "Ctrl" },
          { type: "key", value: "K" },
        ]}
      />
    </button>
  );
}
