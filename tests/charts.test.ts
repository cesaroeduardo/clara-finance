import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartCard } from "../src/components/ui/chart-card";
import { PrivacyContext } from "../src/components/finance-privacy";

test("gráficos aceitam séries vazias, zeradas e negativas sem coordenadas inválidas", () => {
  for (const values of [
    [],
    [0, 0],
    [-200, -100],
    [-100, 0, 100],
    [5.66, 5.67],
  ]) {
    for (const type of ["area", "line", "bar", "donut"] as const) {
      const markup = renderToStaticMarkup(
        createElement(ChartCard, {
          embedded: true,
          sparkline: true,
          type,
          title: "Teste",
          data: {
            labels: values.map((_, i) => String(i)),
            series: [{ id: "test", label: "Valores", values }],
          },
        }),
      );
      assert.doesNotMatch(markup, /NaN|Infinity/);
    }
  }
});

test("privacidade mascara resumo, tabela e total dos gráficos", () => {
  const markup = renderToStaticMarkup(
    createElement(
      PrivacyContext,
      { value: true },
      createElement(ChartCard, {
        title: "Gastos",
        type: "donut",
        total: "R$ 123,45",
        format: (value) => `R$ ${value}`,
        data: {
          labels: ["Novembro"],
          series: [{ id: "expenses", label: "Saídas", values: [12345] }],
        },
      }),
    ),
  );
  assert.doesNotMatch(markup, /R\$/);
  assert.match(markup, /••••••/);
});
