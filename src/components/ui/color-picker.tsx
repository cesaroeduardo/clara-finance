"use client";
import { useState } from "react";
import {
  ColorPicker as Picker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerSlider,
  ColorPickerSliderThumb,
} from "@ui-sdk/react/color-picker";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from "./popover";
import { Field } from "./field";
import { Input } from "./input";

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
  const valid = /^#[0-9a-f]{6}$/i.test(hex);
  const [color, setColor] = useState(defaultValue);
  function edit(value: string) {
    setHex(value.toUpperCase());
    if (/^#[0-9a-f]{6}$/i.test(value)) setColor(value);
  }
  return (
    <Picker
      value={color}
      onValueChange={edit}
      space="hsv"
      format="hex"
      aria-label="Seletor de cor"
      className="color-picker-field"
    >
      <Popover>
        <PopoverTrigger
          type="button"
          className="color-picker-trigger"
          aria-label="Abrir seletor de cor"
        >
          <span style={{ background: color }} />
        </PopoverTrigger>
        <PopoverContent
          sideOffset={8}
          align="start"
          className="color-picker-popup"
        >
          <PopoverTitle className="color-picker-title">Cor</PopoverTitle>
          <ColorPickerArea className="sdk-color-area">
            <ColorPickerAreaThumb
              className="sdk-color-thumb"
              aria-label="Saturação e brilho"
            />
          </ColorPickerArea>
          <ColorPickerSlider channel="hue" className="sdk-color-hue">
            <ColorPickerSliderThumb
              className="sdk-hue-thumb"
              aria-label="Matiz"
            />
          </ColorPickerSlider>
          <Field className="color-picker-hex">
            <span>HEX</span>
            <Input
              aria-label="Cor hexadecimal"
              value={hex}
              onChange={(event) => edit(event.target.value)}
              pattern="#[0-9a-fA-F]{6}"
              maxLength={7}
              required
              spellCheck={false}
            />
          </Field>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        name={name}
        value={hex}
        onChange={(event) => edit(event.target.value)}
        pattern="#[0-9a-fA-F]{6}"
        maxLength={7}
        required
        spellCheck={false}
        aria-invalid={!valid || undefined}
        title="Use o formato hexadecimal, como #737373."
        placeholder="#737373"
      />
    </Picker>
  );
}
