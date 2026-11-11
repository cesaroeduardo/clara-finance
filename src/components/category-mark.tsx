import { SquaresFour } from "@phosphor-icons/react";
import { CategoryImage } from "./finance-icons";
import { colorForCategory, imageForCategory } from "@/lib/categorize";

export function CategoryMark({
  name,
  size = 22,
}: {
  name: string;
  size?: number;
}) {
  if (name === "all") {
    return (
      <span className="category-mark is-all" aria-hidden="true">
        <SquaresFour size={Math.round(size * 0.55)} />
      </span>
    );
  }
  const color = colorForCategory(name);
  const image = imageForCategory(name);
  return (
    <span
      className={`category-mark${image ? " has-image" : ""}`}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 22%, var(--card))`,
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      {image ? (
        <CategoryImage name={image} size={Math.round(size * 0.82)} />
      ) : (
        <span className="category-mark-dot" style={{ background: color }} />
      )}
    </span>
  );
}

export function categoryFieldOptions(
  names: string[],
  { includeAll = true }: { includeAll?: boolean } = {},
) {
  return [
    ...(includeAll
      ? [
          {
            value: "all",
            label: "Todas as categorias",
            leading: <CategoryMark name="all" />,
          },
        ]
      : []),
    ...names.map((name) => ({
      value: name,
      label: name,
      leading: <CategoryMark name={name} />,
    })),
  ];
}
