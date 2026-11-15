"use client";

import { useId, useRef, useState } from "react";
import { ImageSquare } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FieldSelect } from "@/components/ui/field-select";
import { CategoryImage } from "./finance-icons";
import { categoryImages } from "@/lib/categorize";
import {
  isCategoryImageData,
  MAX_CATEGORY_IMAGE_LENGTH,
} from "@/lib/category-image";

const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

async function readImage(file: Blob): Promise<string> {
  if (!imageTypes.includes(file.type))
    throw new Error("Use uma imagem PNG, JPG, WebP ou GIF.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("A imagem deve ter até 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("Não foi possível ler a imagem. Escolha outro arquivo.");
    }
    const scale = Math.min(1, 256 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/webp", 0.9);
    if (data.length > MAX_CATEGORY_IMAGE_LENGTH)
      throw new Error("A imagem é muito grande. Use uma imagem menor.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CategoryImagePicker({
  defaultValue,
  subject = "categoria",
  uploadOnly = false,
  onBusyChange,
  disabled,
}: {
  defaultValue: string;
  subject?: "categoria" | "meta";
  uploadOnly?: boolean;
  onBusyChange: (busy: boolean) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const instructionsId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const reading = useRef(false);
  const dragDepth = useRef(0);
  const unavailable = busy || disabled;
  const custom = isCategoryImageData(value);
  const options = [...new Set(["", ...Object.values(categoryImages)])].map(
    (slug) => ({ value: slug, label: slug || "Sem ilustração" }),
  );
  if (custom) options.push({ value, label: "Imagem enviada" });

  async function loadImage(file: Blob) {
    if (reading.current || disabled) return;
    reading.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      setValue(await readImage(file));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível ler a imagem.",
      );
    } finally {
      reading.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function pasteImage() {
    setError("");
    try {
      if (!navigator.clipboard?.read) {
        setError("Clique nesta área e use Ctrl+V para colar a imagem.");
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((type) => imageTypes.includes(type));
        if (type) {
          await loadImage(await item.getType(type));
          return;
        }
      }
      setError("Copie uma imagem antes de colar.");
    } catch {
      setError(
        "Não foi possível acessar o clipboard. Clique nesta área e use Ctrl+V.",
      );
    }
  }

  return (
    <div className="category-image-picker">
      {uploadOnly ? (
        <input type="hidden" name="imageSlug" value={value} />
      ) : (
        <FieldSelect
          id="imageSlug"
          name="imageSlug"
          value={value}
          onValueChange={(value) => {
            setValue(value);
            setError("");
          }}
          options={options}
          disabled={busy || disabled}
        />
      )}
      <div
        className="category-image-upload"
        role="group"
        aria-label={`Imagem da ${subject}`}
        aria-describedby={`${instructionsId} ${hintId}`}
        aria-disabled={unavailable}
        aria-busy={busy}
        tabIndex={unavailable ? -1 : 0}
        data-dragging={dragging && !unavailable ? "true" : undefined}
        onClick={(event) => {
          if (
            unavailable ||
            (event.target as HTMLElement).closest("button, input, a")
          )
            return;
          event.currentTarget.focus();
        }}
        onPaste={(event) => {
          const file = Array.from(event.clipboardData.items)
            .find(
              (item) => item.kind === "file" && item.type.startsWith("image/"),
            )
            ?.getAsFile();
          if (file) {
            event.preventDefault();
            void loadImage(file);
          }
        }}
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          dragDepth.current += 1;
          if (!unavailable) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = unavailable ? "none" : "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          if (unavailable) return;
          const files = Array.from(event.dataTransfer.files);
          const file =
            files.find((file) => file.type.startsWith("image/")) || files[0];
          if (file) void loadImage(file);
          else setError("Arraste um arquivo de imagem.");
        }}
      >
        {value ? (
          <CategoryImage name={value} size={56} />
        ) : (
          <ImageSquare
            size={32}
            className="category-image-upload-icon"
            aria-hidden="true"
          />
        )}
        <p
          id={instructionsId}
          className="category-image-upload-instructions"
          aria-live="polite"
        >
          {busy
            ? "Preparando imagem…"
            : dragging
              ? "Solte a imagem aqui"
              : "Arraste uma imagem ou clique nesta área e cole com Ctrl+V."}
        </p>
        <div className="category-image-upload-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || disabled}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? "Preparando…" : "Enviar imagem"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || disabled}
            onClick={() => void pasteImage()}
          >
            Colar imagem
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || disabled}
              onClick={() => {
                setValue("");
                setError("");
              }}
            >
              Remover
            </Button>
          )}
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={imageTypes.join(",")}
        aria-label={`Enviar ilustração da ${subject}`}
        hidden
        disabled={busy || disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void loadImage(file);
        }}
      />
      <p id={hintId} className="category-image-hint">
        PNG, JPG, WebP ou GIF, até 10 MB. Encontre ilustrações no{" "}
        <a
          href="https://www.thiings.co/things"
          target="_blank"
          rel="noopener noreferrer"
        >
          Thiings
        </a>
        .
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
