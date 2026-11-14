import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

test("SDK permite localizar e alterar seletores, cor e inteiros pelas APIs de interação", async () => {
  const dom = new JSDOM(
    "<!doctype html><html lang='pt-BR'><head></head><body></body></html>",
    { url: "http://localhost", pretendToBeVisual: true },
  );
  const view = dom.window;
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLFieldSetElement",
    "HTMLFormElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
    "HTMLLabelElement",
    "HTMLButtonElement",
    "Element",
    "Node",
    "Document",
    "ShadowRoot",
    "MutationObserver",
    "Event",
    "CustomEvent",
    "MouseEvent",
    "KeyboardEvent",
    "DOMRect",
    "getComputedStyle",
  ] as const) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: view[key],
    });
  }
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: view.requestAnimationFrame.bind(view),
    cancelAnimationFrame: view.cancelAnimationFrame.bind(view),
  });
  view.HTMLElement.prototype.showPopover = () => {};
  view.HTMLElement.prototype.hidePopover = () => {};
  view.Element.prototype.getAnimations = () => [];
  view.Element.prototype.scrollIntoView = () => {};
  view.Element.prototype.checkVisibility = () => true;
  view.Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  view.document.elementFromPoint = () => null;
  view.document.elementsFromPoint = () => [];
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  view.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  });
  view.document.head.append(
    Object.assign(view.document.createElement("style"), {
      textContent: "[popover] { display: block !important }",
    }),
  );

  const React = await import("react");
  const { render, cleanup, act } = await import("@testing-library/react");
  const { createAgent } = createRequire(`${process.cwd()}/package.json`)(
    "@ui-sdk/react/agent",
  ) as typeof import("@ui-sdk/react/agent");
  const { FieldSelect } = await import("../src/components/ui/field-select");
  const { NumberInput } = await import("../src/components/ui/number-input");
  const { ColorPicker } = await import("../src/components/ui/color-picker");
  const agent = createAgent();
  try {
    const form = render(
      React.createElement(
        "form",
        {},
        React.createElement(FieldSelect, {
          "aria-label": "Conta do lançamento",
          name: "account",
          defaultValue: "",
          options: [
            { value: "", label: "Sem conta" },
            { value: "checking", label: "Conta de teste" },
          ],
        }),
        React.createElement(NumberInput, {
          "aria-label": "Dia da recorrência",
          name: "day",
          defaultValue: 15,
          min: 1,
          max: 31,
        }),
        React.createElement(
          "label",
          { htmlFor: "test-color" },
          "Cor da categoria",
        ),
        React.createElement(ColorPicker, {
          id: "test-color",
          name: "color",
          defaultValue: "#737373",
        }),
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const entries = agent
      .snapshot()
      .filter((entry) => !entry.offPage && entry.component !== "more");
    for (const entry of entries)
      assert.ok(entry.label, `${entry.component} sem nome`);
    for (const label of [
      "Conta do lançamento",
      "Dia da recorrência",
      "Seletor de cor",
    ])
      assert.ok(
        entries.some((entry) => entry.label === label),
        `${label} ausente: ${JSON.stringify(agent.snapshot())}`,
      );
    await act(async () => {
      const result = await agent.act({
        steps: [
          {
            ref: "Conta do lançamento",
            action: "setValue",
            args: ["Conta de teste"],
          },
          { ref: "Dia da recorrência", action: "setValue", args: [21] },
          { ref: "Seletor de cor", action: "setValue", args: ["#123456"] },
        ],
      });
      assert.equal(result.ok, true, result.error?.message);
    });
    const values = new view.FormData(form.container.querySelector("form")!);
    assert.equal(values.get("account"), "checking");
    assert.equal(values.get("day"), "21");
    assert.equal(values.get("color"), "#123456");
  } catch (error) {
    if (error instanceof AggregateError)
      throw new Error(
        error.errors.map((item) => String(item.stack ?? item)).join("\n"),
      );
    throw error;
  } finally {
    cleanup();
    dom.window.close();
  }
});
