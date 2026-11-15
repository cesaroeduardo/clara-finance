import type { SkulletTheme } from "skullet";

/** Cores alinhadas ao tema neutro Clara. Raio baixo para barras de texto, não pills. */
export const claraSkulletTheme: SkulletTheme = {
  light: {
    base: "rgb(0 0 0 / 0.06)",
    highlight: "rgb(255 255 255 / 0.55)",
  },
  dark: {
    base: "rgb(255 255 255 / 0.08)",
    highlight: "rgb(255 255 255 / 0.12)",
  },
  animation: "shimmer",
  speed: "slow",
  radius: "4px",
  text: { top: "cap-height", bottom: "baseline" },
};
