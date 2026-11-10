# Microinterações

A marca é somente o texto **clara.**, sem símbolo ou assinatura. O favicon também usa texto.

As interações usam **Motion for React** (`motion/react`) para indicadores compartilhados e troca de textos. Os menus e modais mantêm o comportamento acessível do Base UI e usam transições CSS. As receitas gratuitas do [Transitions.dev](https://transitions.dev/library.html) fornecem os tempos e as curvas; o estilo visual continua sendo o do Clara.

| Receita original                                                                                                            | Aplicação                                 | Movimento                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [Menu dropdown](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/05-menu-dropdown.md)       | Menu Adicionar                            | Escala 0,97 → 1 em 250 ms; saída para 0,99 em 150 ms; origem na posição do botão.                                 |
| [Modal open/close](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/06-modal.md)            | Formulários                               | Escala 0,96 → 1 e opacidade em 250 ms; fechamento em 150 ms. O formulário permanece montado até concluir a saída. |
| [Tabs sliding](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/16-tabs-sliding.md)         | Tipo do lançamento e seleção na navegação | Indicador compartilhado em 250 ms, `cubic-bezier(0.22, 1, 0.36, 1)`.                                              |
| [Icon swap](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/09-icon-swap.md)               | Tema e privacidade                        | Opacidade, escala 0,25 → 1 e desfoque 2 → 0 px em 250 ms, ease-in-out.                                            |
| [Text states swap](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/04-text-states-swap.md) | Mês, sincronização e botão Salvar         | Saída para cima, entrada de baixo; 4 px, desfoque de 2 px, 150 ms por fase.                                       |
| [Learn more hover](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/24-learn-more-hover.md) | Links Ver todos e semelhantes             | Chevron avança 2 px e abre os braços em 8°, em 350 ms.                                                            |

As animações são decorativas. Foco, teclado e textos acessíveis continuam sob controle dos componentes originais. A preferência `prefers-reduced-motion` desativa as transições CSS e os movimentos do Motion. A ocultação de valores substitui o texto imediatamente; os números financeiros não ficam na tela esperando uma animação de saída.

As receitas foram adaptadas da edição gratuita, com permissão de uso e modificação em produtos próprios: [licença Transitions.dev](https://github.com/Jakubantalik/transitions.dev/blob/main/skills/transitions-dev/LICENSE.txt), Copyright 2026 Jakub Antalik / Transitions.dev. Este projeto não distribui uma coleção de receitas nem depende de plano Pro. [Documentação do Motion](https://motion.dev/docs/react).

As capturas de comparação e medições ficam em `.reanimate/transitions-dev/`, ignorado pelo Git. Os testes de navegador verificam os tempos CSS, fechamento completo, preservação dos campos, privacidade e movimento reduzido.
