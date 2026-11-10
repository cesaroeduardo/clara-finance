# Clara · Finanças pessoais

Aplicativo pessoal de controle financeiro com **Next.js 16, React, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts e SQLite local**. Interface em português, valores em reais e datas no fuso America/Sao_Paulo.

## Começar

Requer Node.js 22.13+ e npm. O banco é criado automaticamente na primeira leitura.

```powershell
cd personal-finances
npm ci
npm run dev
```

Abra http://127.0.0.1:3000. Para outra porta, use `npm run dev -- --port 3013`.

A primeira abertura usa **dados de demonstração**, identificados no topo. Clique em **Usar meus dados** para acessar o espaço pessoal vazio. A escolha é lembrada no navegador. Os dados de demonstração e pessoais ficam isolados no banco.

Para usar a versão compilada:

```powershell
npm run build
npm start
```

O aplicativo inicia apenas na interface local (127.0.0.1). Ele foi feito para uma pessoa, em seu computador; não inclui login nem hospedagem pública.

## O que funciona

- Dashboard com resultado mensal previsto, entradas, saídas, grupos, contas pendentes, fluxo acumulado, investimentos e metas.
- Lançamentos: criar, editar, excluir, pesquisar, filtrar por mês/grupo/tipo/situação e exportar CSV.
- Grupos: cor, ícone e orçamento mensal; vínculos com lançamentos, investimentos e metas.
- Investimentos: posições manuais ou importadas, com instituição, classe e grupo.
- Metas: valor desejado, prazo, valor reservado e registro incremental de progresso.
- Contas: saldos e cartões importados, conexões e erros/estado da última sincronização.
- Tema claro/escuro, ocultação de valores e navegação responsiva.
- SQLite com WAL, migrações versionadas, chaves estrangeiras e valores inteiros em centavos.

## Conectar o Meu Pluggy (uso pessoal)

O caminho de uso pessoal é **Meu Pluggy + conector MeuPluggy**, conforme o [guia oficial](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use). Não use o conector bancário direto como substituto desse fluxo.

1. Entre em [meu.pluggy.ai](https://meu.pluggy.ai/) e autorize seus bancos.
2. Entre no [Dashboard Pluggy](https://dashboard.pluggy.ai/) com a mesma conta e crie/abra uma aplicação.
3. Na demonstração da aplicação, escolha **MeuPluggy** e autorize o acesso. Habilite o conector no grupo Pessoal se necessário.
4. Copie o **itemId de cada instituição** e as credenciais **Client ID** e **Client Secret**.
5. Copie `.env.example` para `.env.local` e preencha as credenciais:

```dotenv
PLUGGY_CLIENT_ID=seu_client_id
PLUGGY_CLIENT_SECRET=seu_client_secret
```

6. Reinicie o aplicativo. Em **Usar meus dados → Contas & conexões**, clique em **Adicionar conexão**, informe o nome e o itemId e depois clique em **Sincronizar**.

As credenciais e a API key ficam no servidor; o navegador recebe apenas o indicador de configuração. `.env.local`, banco, backups e arquivos de teste não são enviados ao Git.

A integração usa `/auth`, `/items/{id}`, `/accounts`, `/transactions` e `/investments`. Ela não depende de listar todos os itens, recurso indisponível no uso pessoal. O fluxo de autorização permanece nos sites oficiais; não solicitamos a senha do banco dentro deste aplicativo.

### Comportamento da sincronização

- O botão lê os dados já disponíveis na Pluggy. Ele **não força uma atualização no banco**; o Meu Pluggy atualiza suas conexões a cada 24 horas.
- Importa todas as páginas e grava cada instituição de forma atômica. Erros não apagam os dados locais existentes.
- Reimportações atualizam pelo ID da Pluggy, sem duplicar transações. Grupo, categoria e tipo ajustados pelo usuário são preservados.
- Categorias são locais e manuais; a aplicação não depende da categorização paga da Pluggy.
- Pagamentos com `operationType=PAGAMENTO_FATURA` são classificados automaticamente como transferência. Confira transferências e pagamentos de fatura sem esse identificador para evitar dupla contagem.
- Se investimentos não estiverem autorizados, a sincronização avisa e preserva as posições anteriores.
- A autorização pessoal expira após um ano. Renove no Dashboard/Meu Pluggy e confira os novos itemIds.
- O aplicativo limita o cadastro a cinco conexões pessoais, conforme o fluxo oficial.

## Como os números são calculados

**Resultado previsto do mês = entradas − saídas**, incluindo registros pendentes. Transferências entre suas próprias contas não compõem esse resultado. Ele não equivale ao saldo bancário, que vem da instituição e aparece em Contas & conexões.

Os totais do dashboard e os gráficos consolidam BRL. Valores em outras moedas são mantidos e mostrados em sua moeda, sem conversão inventada. Investimentos representam posições atuais, não um histórico de rentabilidade. O campo `amount` da Pluggy é saldo bruto e não é tratado como custo de aquisição.

Os orçamentos são mensais. Metas representam o valor que você registrou como reservado: atualizar uma meta não transfere dinheiro, não cria um lançamento e não altera o saldo da instituição. Lançamentos manuais também não substituem o saldo importado.

## Banco e backup

O banco fica em `data/finances.sqlite`. Para mudar o local, defina `DATABASE_PATH` com um caminho absoluto em `.env.local`.

```powershell
npm run db:backup
```

O backup consistente é salvo em `data/backups/`. Para restaurar, feche o aplicativo, preserve o banco atual e seus arquivos auxiliares, e use o backup como o novo `finances.sqlite`. Não copie um banco em uso ignorando os arquivos WAL; use o comando de backup.

## Verificações

```powershell
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

Os testes cobrem persistência, validação, isolamento dos modos, centavos, moedas, transferências, metas, proteção de origem, importação paginada, reimportação, preservação de categorias e erros da Pluggy. Os testes de navegador usam Google Chrome instalado e um banco temporário em `work/`. Feche outro servidor `next dev` deste projeto antes de rodá-los.

A integração foi validada com respostas simuladas. A validação bancária real requer suas credenciais e itemIds.

## Referências visuais

O layout foi extraído visualmente da imagem fornecida: navegação lateral, fundo cinza claro, cartões brancos com cantos arredondados, azul nos controles, tipografia compacta e ilustrações 3D.

A coleção privada [Clara · Finanças pessoais no Mobbin](https://mobbin.com/collections/337bcdaf-33bd-49a7-81bb-73852b2b1b0a/mobile/screens) contém oito referências web selecionadas pelo MCP oficial. Ela é visível ao usuário e aos colegas com acesso no Mobbin. Consulte `docs/design-references.md` para os links e a função de cada referência.

Ilustrações locais da biblioteca [Thiings](https://www.thiings.co/things), convertidas para WebP e reduzidas para 320px (cerca de 210 KB no total). Os controles usam [shadcn/ui](https://ui.shadcn.com/) com Base UI e ícones Lucide.
