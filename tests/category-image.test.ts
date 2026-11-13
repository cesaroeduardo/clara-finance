import test from "node:test";
import assert from "node:assert/strict";
import { categorySchema } from "../src/lib/validation";
import {
  categoryImageSource,
  MAX_CATEGORY_IMAGE_LENGTH,
} from "../src/lib/category-image";
import { colorForCategory, imageForCategory } from "../src/lib/categorize";
import type { Category } from "../src/lib/types";

const category = { name: "Teste", color: "#123ABC" };
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBzUAAAAASUVORK5CYII=";

test("lançamentos usam a aparência salva da categoria e respeitam a remoção da imagem", () => {
  const categories: Category[] = [
    {
      id: "test",
      name: "Alimentação",
      color: "#123ABC",
      imageSlug: png,
      sortOrder: 0,
    },
  ];
  assert.equal(imageForCategory("Alimentação", categories), png);
  assert.equal(colorForCategory("Alimentação", 0, categories), "#123ABC");
  categories[0].imageSlug = null;
  assert.equal(imageForCategory("Alimentação", categories), null);
  categories[0].name = "Categoria personalizada";
  categories[0].imageSlug = png;
  assert.equal(imageForCategory("Categoria personalizada", categories), png);
  assert.equal(imageForCategory("Alimentação", categories), "compras-mercado");
});

test("ilustrações aceitam os slugs existentes e imagens raster incorporadas", () => {
  assert.equal(
    categorySchema.parse({ ...category, imageSlug: "educacao" }).imageSlug,
    "educacao",
  );
  assert.equal(
    categorySchema.parse({ ...category, imageSlug: "" }).imageSlug,
    null,
  );
  assert.equal(
    categorySchema.parse({ ...category, imageSlug: png }).imageSlug,
    png,
  );
  assert.equal(categoryImageSource(png), png);
  assert.equal(
    categoryImageSource("educacao"),
    "/illustrations/categories/educacao.webp",
  );
});

test("ilustrações recusam SVG, URLs externas, caminhos e imagens acima do limite", () => {
  for (const imageSlug of [
    "data:image/svg+xml;base64,PHN2Zy8+",
    "https://example.com/image.png",
    "../image",
    "data:image/png;base64,invalid!",
    `data:image/png;base64,${"A".repeat(MAX_CATEGORY_IMAGE_LENGTH)}`,
  ]) {
    assert.equal(
      categorySchema.safeParse({ ...category, imageSlug }).success,
      false,
    );
  }
});
