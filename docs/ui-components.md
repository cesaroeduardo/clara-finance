# Componentes de interface

## Implementação

O Clara usa UI SDK `0.1.0-beta.1` para os controles e adapta componentes da TuffUI ao tema neutro existente. Os imports da aplicação passam por `src/components/ui`. Não há importação do CSS padrão do SDK nem inclusão de Radix. Base UI foi removido após a migração de todos os consumidores.

| Área                                         | Implementação atual                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Botões, campos, rótulos e descrição de metas | UI SDK, preservando variantes e classes do Clara                                                                         |
| Seletores de formulário e filtros            | Select do SDK; opções com ícones e imagens; valor vazio convertido na fronteira de FormData                              |
| Diálogos, popovers, menus e tooltips         | UI SDK; camada superior nativa, foco e Escape gerenciados pelo SDK                                                       |
| Controles segmentados e abas                 | SDK; seleção exclusiva exposta como rádio e abas como tab/panel                                                          |
| Seleção de meses                             | Popover e ToggleGroup do SDK sobre a grade mensal existente; contratos AppPeriod preservados                             |
| Prazo de metas                               | DatePicker/Calendar do SDK, locale pt-BR, datas civis ISO e atalhos existentes                                           |
| Cores                                        | Área e matiz do ColorPicker SDK; hexadecimal de seis dígitos, em maiúsculas, na aplicação                                |
| Dia do mês, parcelas e prioridade            | NumberInput SDK com limites existentes; campos monetários continuam em centavos no domínio                               |
| Superfícies, estados e números               | Surface, Status Pill, Empty State, Loader, Loading Skeleton, Progress Bar, Rolling Number e Key Hint adaptados da TuffUI |
| Tabelas e gráficos                           | Tabelas financeiras próprias; Chart Card da TuffUI em SVG/Motion para todos os gráficos                                  |
| Notificações                                 | Sonner e seu tema existente                                                                                              |

A tabela da TuffUI não substitui a tabela financeira: ordenação, menus, modelo de transações e apresentação móvel continuam no Clara. Logos, imagens de categorias e cartões bancários também permanecem específicos do domínio.

## Camada visual

A primeira entrega preservava as classes antigas e trouxe pouca mudança visível. A camada visual foi corrigida para usar a composição da TuffUI nas telas:

- `FinanceSurface` combina `Shell`, `ShellHeader`, `IconTile` e `Panel`: moldura neutra sem borda, cabeçalho com ícone e conteúdo em uma superfície interna.
- O primeiro cartão da visão geral mantém o título sem ícone e os botões dentro do gráfico, com a moldura TuffUI. O ritmo de gastos aparece em uma faixa visível acima das contas a pagar; o info explica o limite e a comparação de gastos fica no info da distribuição. Os infos usam a apresentação Tooltip Hint da TuffUI com abertura por teclado, hover e toque, Escape e posicionamento do SDK. O carrossel de insights foi removido.
- Dashboard, tabelas, contas e investimentos usam essa composição. `StatCard`, adaptado do Stat Grid, organiza rótulo, ícone e valor nos resumos.
- Botões usam Action Button e IconButton da TuffUI, adaptados ao comportamento do SDK e mantendo a primária preta/branca. Formulários têm campos preenchidos e seletores de fundo neutro.
- `src/app/tuffui.css` contém a apresentação desses componentes depois dos estilos antigos; os seletores são limitados às superfícies e controles adotados. A grade e as regras financeiras permanecem as mesmas.
- A correção visual também passou pelos 5 testes de componentes no build de produção, incluindo a verificação das superfícies e dos campos.
- O teste visual verifica as superfícies computadas no navegador, a presença dos cabeçalhos e o preenchimento dos campos, para detectar a volta dos estilos antigos.

## Gráficos e resumo de gastos

- `ChartCard` incorpora o código MIT da TuffUI, com SVG e Motion. O Recharts foi removido após a troca de todos os consumidores. Não foi adicionada outra biblioteca de gráficos.
- O medidor semicircular usa a proporção disponível/limite, limitada entre 0 e 100% somente no desenho; valores financeiros e limites excedidos continuam sendo exibidos. Os dias restantes e o disponível diário vêm de `spendingPace`. Contas a pagar ficam na parte inferior do mesmo cartão, mantendo a ação de abrir os lançamentos de saída.
- O resultado tem curvas compactas de entradas e saídas confirmadas no período selecionado. Os últimos pontos correspondem aos totais de receita e gasto exibidos; transferências e pendências não entram nessas curvas.
- Distribuição por categoria, patrimônio, projeção de faturas, recorrências, cotações e detalhes do mercado usam o mesmo renderer. As cores de categorias permanecem definidas pelo usuário; entradas/saídas usam cores financeiras e as outras séries usam tokens neutros.
- Adaptações: modo embutido e sparkline, tamanhos responsivos, suporte a séries negativas/zeradas, `m` compatível com LazyMotion strict e movimento reduzido. Setas/Home/End consultam pontos; Escape limpa a consulta; Enter ativa categoria/fatura quando aplicável.
- Privacidade desfoca os valores no lugar (sem trocar o texto nem mudar o tamanho), anima o blur e mascara tabelas/anúncios acessíveis dos gráficos. Cotações públicas de mercado continuam visíveis. Os gráficos decorativos de cotação não acrescentam controles dentro dos botões.

## Contratos e manutenção

- Preservar `FieldSelect`, `Button`, `buttonVariants`, `Amount`, `PeriodPicker` e `GoalDeadlinePicker` como fronteiras da aplicação. Os tipos de domínio e os endpoints não mudaram.
- Não empilhar gerenciadores de foco. O SDK posiciona popups sem Positioner; menus em tabelas usam um container no documento para preservar o HTML das linhas.
- As partes do SDK mantêm seus próprios `data-slot`: menus usam `menu-content`, e controles segmentados usam `radiogroup`/`radio` com `aria-checked`.
- Declarar a camada `ui-sdk` antes do Tailwind. As cores TuffUI `brand`, `positive`, `negative`, `warning` e as superfícies apontam para os tokens do Clara. Manter Geist e a primária preta/branca.
- As animações respeitam movimento reduzido. Rolling Number recebe o texto já formatado pelo Clara; com privacidade o valor permanece no layout e só recebe blur, com rótulo acessível “Valor oculto”. Os valores auxiliares usam `PrivateValue`.
- Formulário e paleta são carregados sob demanda. A paleta permanece montada após o primeiro uso para preservar o fechamento animado.
- Antes de atualizar o SDK, ler a documentação que acompanha a versão instalada e repetir os testes de foco, datas e FormData. A versão está em beta e permanece fixada no lockfile.

## Origem e licenças

- TuffUI: [repositório](https://github.com/yurigdesigner/tuffui), licença MIT. A referência upstream consultada é `589cbb03ee1b06deaf02b78dde5395db99832397`. Os arquivos incorporados preservam o copyright.
- `tuffui-sources.json` registra os endpoints e SHA-256 dos fontes recebidos em 14/11/2026. As adaptações locais não são sobrescritas automaticamente pelo shadcn.
- O texto integral da licença está em `licenses/tuffui-MIT.txt`.
- UI SDK: [vercel-labs/ui](https://github.com/vercel-labs/ui), licença Apache-2.0, pacotes React e core `0.1.0-beta.1`. O texto integral da licença do SDK está em `licenses/ui-sdk-Apache-2.0.txt`. Testing Library e jsdom são dependências apenas de desenvolvimento para verificar as APIs de interação e o envio dos valores.

## Validação

- `npm test`: 64 testes, incluindo interação por APIs SDK e FormData de seletor, inteiro e cor.
- `npm run test:e2e`: 30 cenários em Chrome; teclado, Escape, menus de contexto, privacidade, datas, imagens, persistência, temas e celular.
- A adoção dos gráficos também valida a suíte completa no build de produção (`E2E_PRODUCTION=true`, `NEXT_BUILD_DIR=work/next-charts-release`).
- `npm run typecheck`, `npm run lint` e `npm run build` passaram. O lint mantém avisos existentes de hooks e símbolos não usados, sem erros.
- Os testes de desenvolvimento usam `work/next-e2e` e SQLite separado, preservando o servidor de desenvolvimento aberto. `NEXT_BUILD_DIR` permite validar outro build; em produção, o padrão continua sendo `.next`.
- Os testes de nomes/ações do SDK executam uma ponte somente dentro do teste; nenhuma ponte de agentes ou ferramenta remota é exposta pela aplicação.

## JavaScript em produção

Esta é a medição da primeira entrega técnica, anterior à correção visual descrita acima. Serve como referência histórica; não mede o código visual atual.

Comparação entre o commit anterior `d9018efaf83e50dcef274ff00ee6be908dc52651` e esta implementação, no mesmo Chrome, viewport de 1440 × 1000 e sem cache. Percurso: visão geral → Contas → dados fictícios → visão geral, sem abrir formulário ou paleta. Soma dos corpos JavaScript solicitados em `/_next/static`, com gzip calculado por recurso; não inclui HTML, CSS ou dados.

| Medida                   |           Antes |          Depois |
| ------------------------ | --------------: | --------------: |
| JavaScript descompactado | 2.085.285 bytes | 2.115.219 bytes |
| JavaScript com gzip      |   619.121 bytes |   638.464 bytes |

Diferença: **19.343 bytes com gzip (+3,12%)**. Os recursos do formulário e da paleta chegam quando essas interfaces são abertas. O relatório com método, navegador e contagem de recursos está em `ui-bundle-comparison.json`; esta medição não representa latência nem o custo de todas as interações possíveis.
