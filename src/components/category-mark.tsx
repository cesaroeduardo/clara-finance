import { SquaresFour } from "@/components/icons";
import { CategoryImage } from "./finance-icons";
import { colorForCategory, imageForCategory } from "@/lib/categorize";
import type { Category } from "@/lib/types";

export function CategoryMark({
  name,
  size = 22,
  color: colorProp,
  imageSlug: imageProp,
}: {
  name: string;
  size?: number;
  color?: string;
  imageSlug?: string | null;
}) {
  if (name === "all") {
    return (
      <span className="category-mark is-all" aria-hidden="true">
        <SquaresFour size={Math.round(size * 0.55)} />
      </span>
    );
  }
  const color = colorProp || colorForCategory(name);
  const image =
    imageProp === undefined ? imageForCategory(name) : imageProp || null;
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

export function categoryLookup(
  name: string,
  categories?: Category[],
): Pick<Category, "color" | "imageSlug"> | undefined {
  return categories?.find((category) => category.name === name);
}

export function categoryFieldOptions(
  names: string[],
  {
    includeAll = true,
    categories,
  }: { includeAll?: boolean; categories?: Category[] } = {},
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
    ...names.map((name) => {
      const meta = categoryLookup(name, categories);
      return {
        value: name,
        label: name,
        leading: (
          <CategoryMark
            name={name}
            color={meta?.color}
            imageSlug={meta?.imageSlug}
          />
        ),
      };
    }),
  ];
}
