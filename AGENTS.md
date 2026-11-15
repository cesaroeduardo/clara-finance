<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Texto da interface

Use português direto, títulos funcionais e rótulos curtos. Não use slogans, frases motivacionais, linguagem emocional ou subtítulos decorativos. Inclua explicações apenas quando necessárias para operar o sistema ou interpretar os dados.

## Textos da Clara (agente)

Respostas do chat da Clara seguem a persona em `src/lib/clara-mock-agent.ts` (`CLARA_PERSONA`). Não use travessão (—) em nenhuma mensagem da Clara: prefira ponto, vírgula ou dois-pontos.

## Tema e tipografia

Use a paleta neutra de `src/app/globals.css`, baseada em Vercel e Linear. A cor primária é preta no tema claro e branca no escuro. Use Geist Sans, gratuita e servida localmente por `next/font`. Controles, links, foco e gráficos gerais devem usar os tokens do tema; reserve cores para estados financeiros e categorias definidas pelo usuário. Não adicione azul como cor primária.

## UI SDK e TuffUI

Antes de alterar componentes UI SDK, leia `node_modules/@ui-sdk/react/docs/llms.txt` e a skill em `node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md`, seguindo a documenta��o da vers�o instalada. Para primitivas novas, consulte tamb�m `docs/core.md` por se��o e `docs/rendering.md`. Preserve as APIs p�blicas em `src/components/ui`, os tokens do Clara e os avisos de licen�a dos componentes derivados da TuffUI.
