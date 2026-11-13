"use client";

import { useState, type PointerEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import { Input } from "./input";

function fromHex(hex: string) {
  const [r, g, b] = [1, 3, 5].map(
    (offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
}

function toHex(h: number, s: number, v: number) {
  const channel = (offset: number) => {
    const k = (offset + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`.toUpperCase();
}

export function ColorPicker({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue: string;
}) {
  const [hex, setHex] = useState(defaultValue.toUpperCase());
  const [hsv, setHsv] = useState(() => fromHex(defaultValue));
  const valid = /^#[0-9a-f]{6}$/i.test(hex);
  const color = valid ? hex : toHex(hsv.h, hsv.s, hsv.v);

  function update(next: typeof hsv) {
    setHsv(next);
    setHex(toHex(next.h, next.s, next.v));
  }
  function editHex(value: string) {
    setHex(value);
    if (/^#[0-9a-f]{6}$/i.test(value)) setHsv(fromHex(value));
  }
  function pick(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    update({
      ...hsv,
      s: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      v: 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    });
  }
  const hexProps = {
    value: hex,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      editHex(event.target.value),
    onBlur: () => {
      if (valid) setHex(hex.toUpperCase());
    },
    pattern: "#[0-9a-fA-F]{6}",
    maxLength: 7,
    required: true,
    spellCheck: false,
    title: "Use o formato hexadecimal, como #737373.",
    placeholder: "#737373",
  };

  return (
    <div className="color-picker-field">
      <Popover.Root>
        <Popover.Trigger
          type="button"
          className="color-picker-trigger"
          aria-label="Abrir seletor de cor"
        >
          <span style={{ background: color }} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            sideOffset={8}
            align="start"
            className="color-picker-positioner"
          >
            <Popover.Popup className="color-picker-popup">
              <Popover.Title className="color-picker-title">Cor</Popover.Title>
              <div
                className="color-picker-plane"
                style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
                role="slider"
                tabIndex={0}
                aria-label="Saturação e brilho"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(hsv.s * 100)}
                aria-valuetext={`Saturação ${Math.round(hsv.s * 100)}%, brilho ${Math.round(hsv.v * 100)}%`}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  pick(event);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    pick(event);
                }}
                onKeyDown={(event) => {
                  if (
                    ![
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(event.key)
                  )
                    return;
                  event.preventDefault();
                  const step = event.shiftKey ? 0.1 : 0.01;
                  update({
                    ...hsv,
                    s: Math.max(
                      0,
                      Math.min(
                        1,
                        hsv.s +
                          (event.key === "ArrowRight"
                            ? step
                            : event.key === "ArrowLeft"
                              ? -step
                              : 0),
                      ),
                    ),
                    v: Math.max(
                      0,
                      Math.min(
                        1,
                        hsv.v +
                          (event.key === "ArrowUp"
                            ? step
                            : event.key === "ArrowDown"
                              ? -step
                              : 0),
                      ),
                    ),
                  });
                }}
              >
                <span
                  className="color-picker-cursor"
                  style={{
                    left: `${hsv.s * 100}%`,
                    top: `${(1 - hsv.v) * 100}%`,
                    background: color,
                  }}
                />
              </div>
              <input
                className="color-picker-hue"
                type="range"
                min="0"
                max="360"
                value={hsv.h}
                aria-label="Matiz"
                onChange={(event) =>
                  update({ ...hsv, h: Number(event.target.value) })
                }
              />
              <label className="color-picker-hex">
                <span>HEX</span>
                <Input aria-label="Cor hexadecimal" {...hexProps} />
              </label>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <Input id={id} name={name} {...hexProps} />
    </div>
  );
}
