# Tema visual

A interface usa Geist Sans em ambos os temas, com números tabulares nos valores financeiros. A fonte é distribuída sob a SIL Open Font License 1.1 e servida pelo aplicativo via `next/font`, sem requisições ao Google no navegador.

Os tokens estão centralizados em `src/app/globals.css`. Componentes e gráficos usam essas variáveis para acompanhar a troca de tema.

| Token                | Claro     | Escuro    |
| -------------------- | --------- | --------- |
| Fundo                | `#fafafa` | `#08090a` |
| Superfície           | `#ffffff` | `#0f1011` |
| Texto                | `#171717` | `#f7f8f8` |
| Primária             | `#000000` | `#ffffff` |
| Texto sobre primária | `#ffffff` | `#08090a` |
| Texto secundário     | `#666666` | `#8a8f98` |
| Borda                | `#e5e5e5` | `#23252a` |

Botões, links, seleção e foco usam tons neutros. Cores de categorias e metas continuam editáveis; verde, âmbar e vermelho identificam estados financeiros. Inputs nativos seguem o tema por `color-scheme`.

Referências oficiais consultadas em 10/11/2026:

- [Vercel — Geist Colors](https://vercel.com/geist/colors): hierarquia de fundos, bordas e contraste.
- [Vercel — Geist Font](https://vercel.com/font) e [licença OFL](https://github.com/vercel/geist-font/blob/main/OFL.txt).
- [Linear](https://linear.app): tokens de fundo, superfície, texto e bordas extraídos do CSS público.
- [Linear — A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh): hierarquia visual e redução de ruído.
