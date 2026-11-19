import { displayInstitution } from "@/lib/accounts";
import {
  buildHelpCard,
  helpReply,
  wantsHelp,
} from "@/lib/clara-agent-help";
import {
  accountCardReply,
  accountInsight,
  balancesInsight,
  balancesReply,
  biggestExpenseInsight,
  biggestExpenseReply,
  categorySpendInsight,
  categorySpendReply,
  emptyBalancesReply,
  emptyBiggestExpenseReply,
  goalsInsight,
  goalsReply,
  netWorthCardReply,
  netWorthInsight,
  paceInsight,
  paceReply,
  pendingBillsInsight,
  pendingBillsReply,
  periodSummaryInsight,
  periodSummaryReply,
  recurringsInsight,
  recurringsReply,
  resolveCategoryFromMessage,
  resolveMonthFromMessage,
  resolvePeriodFromMessage,
  wantsBiggestExpense,
  completeGoalAlreadyReply,
  completeGoalMissingReply,
  completeGoalReply,
  resolveGoalFromMessage,
  wantsCategorySpend,
  wantsCompleteGoal,
  wantsGoals,
  wantsPace,
  wantsPendingBills,
  wantsPeriodSummary,
  wantsRecurrings,
  type ClaraAgentCard,
} from "@/lib/clara-agent-insights";
import type { Account, Connection, FinanceData } from "@/lib/types";
import type { AgentStep } from "@ui-sdk/react/agent";

/**
 * Mock only. Swap later for an LLM that calls agentTools + a read-accounts tool.
 * Persona lives in replies, not in chrome copy.
 */
export const CLARA_PERSONA = `Você é a Clara, personagem do logo do app de finanças.
Fale como uma vó carinhosa: tom afetuoso, indica o certo com calma, sem sermão longo.
Use português do Brasil. Números claros em reais. Nunca invente contas.
Nunca use travessão (—) nas respostas. Prefira ponto, vírgula ou dois-pontos.
Quando o maior gasto ou o destaque for Alimentação, inclua: "Mas é isso aí, a gente tem que comer bem."
Quando for Compras, inclua: "O importante é a gente ter nossas coisinhas."`;

export type ClaraView =
  | "dashboard"
  | "transactions"
  | "recurring"
  | "investments"
  | "goals"
  | "categories"
  | "accounts"
  | "clara";

export type ClaraSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

export type ClaraUndoEntry = {
  type: "complete-goal";
  goalId: string;
  label: string;
};

export type ClaraAgentAction =
  | {
      type: "complete-goal";
      goalId: string;
    }
  | {
      type: "undo";
    };

export type ClaraMockResult = {
  reply: string;
  view?: ClaraView;
  steps?: AgentStep[];
  suggestions?: ClaraSuggestion[];
  card?: ClaraAgentCard;
  action?: ClaraAgentAction;
};

const SUGGEST_OPEN_ACCOUNTS: ClaraSuggestion = {
  id: "open-accounts",
  label: "Abrir Contas",
  prompt: "Abre Contas",
};
const SUGGEST_BALANCES: ClaraSuggestion = {
  id: "balances",
  label: "Ver saldos",
  prompt: "Quanto tenho nas contas?",
};
const SUGGEST_WORTH: ClaraSuggestion = {
  id: "worth",
  label: "Patrimônio",
  prompt: "Qual meu patrimônio?",
};
const SUGGEST_DASHBOARD: ClaraSuggestion = {
  id: "dashboard",
  label: "Visão geral",
  prompt: "Abre Visão geral",
};
const SUGGEST_BIGGEST: ClaraSuggestion = {
  id: "biggest",
  label: "Maior gasto",
  prompt: "Qual foi o meu maior gasto este mês?",
};
const SUGGEST_HELP: ClaraSuggestion = {
  id: "help",
  label: "/help",
  prompt: "/help",
};
const SUGGEST_PACE: ClaraSuggestion = {
  id: "pace",
  label: "Ritmo do mês",
  prompt: "Posso gastar quanto hoje?",
};
const SUGGEST_SUMMARY: ClaraSuggestion = {
  id: "summary",
  label: "Resumo do mês",
  prompt: "Como foi o mês?",
};
const SUGGEST_PENDING: ClaraSuggestion = {
  id: "pending",
  label: "A pagar",
  prompt: "O que vence?",
};
const SUGGEST_RECURRING: ClaraSuggestion = {
  id: "recurring",
  label: "Recorrentes",
  prompt: "Quanto sai fixo este mês?",
};
const SUGGEST_CATEGORY: ClaraSuggestion = {
  id: "category",
  label: "Por categoria",
  prompt: "Onde gastei mais?",
};
const SUGGEST_GOALS: ClaraSuggestion = {
  id: "goals",
  label: "Metas",
  prompt: "Como vão as metas?",
};

/** Verbos de navegação em PT-BR (inclui “pra”, “quero ir”, “me leva”). */
const GO_TO =
  "(?:abre|abra|abrir|mostra|mostre|exibe|exibir|acessa|acessar|" +
  "quero\\s+(?:ir|ver|abrir|acessar)|" +
  "(?:me\\s+)?(?:leva|levar|leve)|" +
  "(?:ir|vai|v[aá]|vamos|navega|navegar)\\s+(?:pra|para|pro|a|ao)|" +
  "(?:ir|vai|v[aá])\\s+em)";

const VIEW_INTENTS: {
  view: ClaraView;
  patterns: RegExp[];
  opened: string;
}[] = [
  {
    view: "accounts",
    patterns: [
      new RegExp(`\\b(?:${GO_TO})\\b.*\\bcontas?\\b`, "i"),
      /\bcontas?\b.*\b(abre|abra|abrir|mostra|mostre|quero\s+ir)\b/i,
    ],
    opened: "Pronto, meu bem: abri Contas pra você olhar com calma.",
  },
  {
    view: "dashboard",
    patterns: [
      new RegExp(
        `\\b(?:${GO_TO})\\b.*\\b(vis[aã]o\\s+geral|in[ií]cio|dashboard)\\b`,
        "i",
      ),
      /\b(vis[aã]o\s+geral|dashboard)\b.*\b(abre|abra|abrir|mostra|mostre|quero\s+ir)\b/i,
    ],
    opened: "Vamos lá: deixei a Visão geral aberta pra você.",
  },
  {
    view: "transactions",
    patterns: [
      new RegExp(
        `\\b(?:${GO_TO})\\b.*\\b(lan[cç]amentos?|extrato|transa[cç][oõ]es)\\b`,
        "i",
      ),
      /\b(lan[cç]amentos?|extrato|transa[cç][oõ]es)\b.*\b(abre|abra|abrir|mostra|mostre|quero\s+ir)\b/i,
    ],
    opened: "Abri os Lançamentos. Olha com carinho o que entrou e saiu.",
  },
  {
    view: "recurring",
    patterns: [
      new RegExp(`\\b(?:${GO_TO})\\b.*\\brecorrentes?\\b`, "i"),
      /\brecorrentes?\b.*\b(abre|abra|abrir|mostra|mostre|quero\s+ir)\b/i,
    ],
    opened: "Pronto: Recorrentes está aberta.",
  },
  {
    view: "investments",
    patterns: [
      new RegExp(`\\b(?:${GO_TO})\\b.*\\binvestimentos?\\b`, "i"),
      /\binvestimentos?\b.*\b(abre|abra|abrir|mostra|mostre|quero\s+ir)\b/i,
    ],
    opened: "Abri Investimentos pra você.",
  },
  {
    view: "goals",
    patterns: [
      new RegExp(`\\b(?:${GO_TO})\\b.*\\bmetas?\\b`, "i"),
      /\bmetas?\b.*\b(abre|abra|abrir|mostra|mostre|quero\s+ir)\b/i,
    ],
    opened: "Metas aberta. Com jeitinho a gente chega lá.",
  },
  {
    view: "categories",
    patterns: [
      new RegExp(`\\b(?:${GO_TO})\\b.*\\bcategorias?\\b`, "i"),
      /\bcategorias?\b.*\b(abre|abra|abrir|mostra|mostre|quero\s+ir)\b/i,
    ],
    opened: "Abri Categorias pra você organizar.",
  },
  {
    view: "clara",
    patterns: [
      new RegExp(`\\b(?:${GO_TO}|volta|voltar)\\b.*\\b(clara|agente)\\b`, "i"),
      /\b(clara|agente)\b.*\b(abre|abra|abrir|volta|voltar|quero\s+ir)\b/i,
    ],
    opened: "Estou bem aqui, meu bem. Pode perguntar.",
  },
];

function viewLabel(view: ClaraView) {
  switch (view) {
    case "dashboard":
      return "Visão geral";
    case "transactions":
      return "Lançamentos";
    case "recurring":
      return "Recorrentes";
    case "investments":
      return "Investimentos";
    case "goals":
      return "Metas";
    case "categories":
      return "Categorias";
    case "accounts":
      return "Contas";
    case "clara":
      return "Agente";
  }
}

/** UI SDK: press the sidebar control registered as `Abrir {tela}`. */
function openViewSteps(view: ClaraView): AgentStep[] | undefined {
  if (view === "clara") return undefined;
  return [{ ref: `Abrir ${viewLabel(view)}`, action: "press" }];
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function findAccount(
  message: string,
  accounts: Account[],
  connections: Pick<Connection, "id" | "name">[],
) {
  const needle = normalize(message);
  const scored = accounts
    .map((account) => {
      const institution = normalize(displayInstitution(account, connections));
      const name = normalize(account.name);
      const hay = `${name} ${institution}`;
      let score = 0;
      if (needle.includes(name) && name.length > 2) score += 3;
      if (needle.includes(institution) && institution.length > 2) score += 2;
      for (const part of hay.split(/\s+/).filter((part) => part.length > 3)) {
        const pattern = new RegExp(
          `(?:^|\\s)${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`,
        );
        if (pattern.test(needle)) score += 1;
      }
      return { account, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.account ?? null;
}


function matchOpenView(message: string) {
  for (const intent of VIEW_INTENTS) {
    if (intent.patterns.some((pattern) => pattern.test(message))) {
      return intent;
    }
  }
  return null;
}

function wantsBalances(message: string) {
  return (
    /\b(saldo|saldos|quanto\s+tenho|quanto\s+tem|listar\s+contas|minhas\s+contas|todas\s+as\s+contas)\b/i.test(
      message,
    ) || /\bcontas?\b.*\b(saldo|quanto|lista|listar|mostra|mostre)\b/i.test(message)
  );
}

function wantsNetWorth(message: string) {
  return /\b(patrim[oô]nio|net\s*worth|quanto\s+tenho\s+no\s+total|total\s+geral)\b/i.test(
    message,
  );
}

function wantsFocusComposer(message: string) {
  return /\b(foca|foque|focar|limpa|limpar)\b.*\b(mensagem|campo|caixa)\b/i.test(
    message,
  );
}

/** Limpa o histórico do chat (não o campo de mensagem). */
export function wantsClearChat(message: string) {
  const text = message.trim();
  if (/^\/(clear|limpar|nova)\b/i.test(text)) return true;
  if (/\b(nova\s+conversa|come[cç]ar\s+de\s+novo)\b/i.test(text)) return true;
  return /\b(limpa|limpar|apaga|apagar|zera|zerar)\b.{0,24}\b(chat|conversa|hist[oó]rico)\b/i.test(
    text,
  );
}

function destructiveRequest(message: string) {
  return /\b(exclui|excluir|apaga|apagar|deleta|deletar|sincroniza|sincronizar|sync)\b/i.test(
    message,
  );
}

export type ClaraMockInput = {
  message: string;
  data: FinanceData;
  currentView: ClaraView;
  lastUndo?: ClaraUndoEntry | null;
};

export function wantsUndo(message: string) {
  return (
    /\b(desfazer|desfa[cç]a|desfaz|undo|voltar\s+atr[aá]s|reverter)\b/i.test(
      message,
    ) || /^\/undo\b/i.test(message.trim())
  );
}

/** Classifies the user message and returns a persona reply plus optional nav/UI steps. */
export function planClaraReply(input: ClaraMockInput): ClaraMockResult {
  const text = input.message.trim();
  if (!text) {
    return {
      reply:
        "Pode falar, meu bem. Pergunte de uma conta ou peça pra eu abrir uma tela.",
      suggestions: [
        SUGGEST_BALANCES,
        SUGGEST_PACE,
        SUGGEST_BIGGEST,
        SUGGEST_WORTH,
      ],
    };
  }

  if (destructiveRequest(text)) {
    return {
      reply:
        "Isso eu não faço sozinha, meu bem: excluir ou sincronizar pede a sua confirmação na tela. Melhor você clicar com calma.",
      suggestions: [SUGGEST_BALANCES, SUGGEST_DASHBOARD],
    };
  }

  if (wantsHelp(text)) {
    return {
      reply: helpReply(),
      card: buildHelpCard(),
      suggestions: [SUGGEST_BIGGEST, SUGGEST_BALANCES, SUGGEST_HELP],
    };
  }

  if (wantsUndo(text)) {
    const last = input.lastUndo ?? null;
    if (!last) {
      return {
        reply:
          "Não tem nada pra desfazer agora, meu bem. Eu só desfaço a última ação que eu mesma fiz.",
        suggestions: [SUGGEST_HELP, SUGGEST_GOALS],
      };
    }
    if (last.type === "complete-goal") {
      return {
        reply: `Beleza: vou desfazer a conclusão da meta “${last.label}”.`,
        view: "goals",
        steps: openViewSteps("goals"),
        action: { type: "undo" },
        suggestions: [SUGGEST_GOALS, SUGGEST_HELP],
      };
    }
    return {
      reply: "Essa última ação eu ainda não sei desfazer, meu bem.",
      suggestions: [SUGGEST_HELP],
    };
  }

  const open = matchOpenView(text);
  const account = findAccount(text, input.data.accounts, input.data.connections);
  const askBalances = wantsBalances(text);
  const askWorth = wantsNetWorth(text);

  if (open && (askBalances || account || askWorth)) {
    const card = account
      ? accountInsight(account, input.data.connections)
      : askWorth
        ? netWorthInsight(input.data)
        : balancesInsight(input.data);
    const detail = !card
      ? emptyBalancesReply()
      : card.type === "account"
        ? accountCardReply(card)
        : card.type === "net-worth"
          ? netWorthCardReply(card)
          : balancesReply(card);
    return {
      reply: `${open.opened}\n\n${detail}`,
      card: card ?? undefined,
      view: open.view,
      steps: openViewSteps(open.view),
      suggestions: [SUGGEST_WORTH, SUGGEST_DASHBOARD],
    };
  }

  if (open) {
    return {
      reply: open.opened,
      view: open.view,
      steps: openViewSteps(open.view),
      suggestions: [SUGGEST_BALANCES, SUGGEST_WORTH],
    };
  }

  if (wantsCompleteGoal(text)) {
    const goal = resolveGoalFromMessage(text, input.data);
    if (!goal) {
      return {
        reply: completeGoalMissingReply(),
        suggestions: [SUGGEST_GOALS, SUGGEST_HELP],
      };
    }
    const goalsSteps =
      input.currentView === "goals" ? undefined : openViewSteps("goals");
    if (goal.completed) {
      return {
        reply: completeGoalAlreadyReply(goal),
        suggestions: [SUGGEST_GOALS, SUGGEST_WORTH],
        view: "goals",
        steps: goalsSteps,
      };
    }
    return {
      reply: completeGoalReply(goal),
      view: "goals",
      steps: goalsSteps,
      action: { type: "complete-goal", goalId: goal.id },
      suggestions: [SUGGEST_GOALS, SUGGEST_WORTH],
    };
  }

  if (wantsPace(text)) {
    const month = resolveMonthFromMessage(text);
    const card = paceInsight(input.data, month);
    return {
      reply: paceReply(card),
      card: card.empty ? undefined : card,
      suggestions: [SUGGEST_SUMMARY, SUGGEST_PENDING, SUGGEST_DASHBOARD],
    };
  }

  if (wantsPeriodSummary(text)) {
    const period = resolvePeriodFromMessage(text);
    const card = periodSummaryInsight(input.data, period);
    return {
      reply: periodSummaryReply(card),
      card,
      suggestions: [SUGGEST_PACE, SUGGEST_CATEGORY, SUGGEST_BIGGEST],
    };
  }

  if (wantsPendingBills(text)) {
    const period = resolvePeriodFromMessage(text);
    const card = pendingBillsInsight(input.data, period);
    return {
      reply: pendingBillsReply(card),
      card: card.count > 0 ? card : undefined,
      suggestions: [SUGGEST_RECURRING, SUGGEST_PACE, SUGGEST_DASHBOARD],
    };
  }

  if (wantsRecurrings(text)) {
    const month = resolveMonthFromMessage(text);
    const card = recurringsInsight(input.data, month);
    return {
      reply: recurringsReply(card),
      card: card.total > 0 || card.topItems.length > 0 ? card : undefined,
      suggestions: [SUGGEST_PENDING, SUGGEST_SUMMARY],
    };
  }

  if (wantsCategorySpend(text)) {
    const month = resolveMonthFromMessage(text);
    const focus = resolveCategoryFromMessage(text, input.data);
    const card = categorySpendInsight(input.data, month, focus);
    return {
      reply: categorySpendReply(card),
      card:
        card.categories.length > 0 || (card.focusCategory && card.focusAmount)
          ? card
          : undefined,
      suggestions: [SUGGEST_BIGGEST, SUGGEST_SUMMARY, SUGGEST_PACE],
    };
  }

  if (wantsGoals(text)) {
    const card = goalsInsight(input.data);
    return {
      reply: goalsReply(card),
      card: card.goals.length > 0 ? card : undefined,
      suggestions: [SUGGEST_GOALS, SUGGEST_WORTH, SUGGEST_PACE],
    };
  }

  if (wantsBiggestExpense(text)) {
    const month = resolveMonthFromMessage(text);
    const card = biggestExpenseInsight(input.data, month);
    if (!card) {
      return {
        reply: emptyBiggestExpenseReply(month),
        suggestions: [SUGGEST_BALANCES, SUGGEST_BIGGEST],
      };
    }
    return {
      reply: biggestExpenseReply(card),
      card,
      suggestions: [SUGGEST_CATEGORY, SUGGEST_BALANCES, SUGGEST_DASHBOARD],
    };
  }

  if (askWorth) {
    const card = netWorthInsight(input.data);
    return {
      reply: netWorthCardReply(card),
      card: card.empty ? undefined : card,
      suggestions: [SUGGEST_BALANCES, SUGGEST_BIGGEST, SUGGEST_OPEN_ACCOUNTS],
    };
  }

  if (
    account &&
    (askBalances || /\b(saldo|limite|detalhe|dessa\s+conta)\b/i.test(text))
  ) {
    const card = accountInsight(account, input.data.connections);
    return {
      reply: accountCardReply(card),
      card,
      view: "accounts",
      steps: openViewSteps("accounts"),
      suggestions: [SUGGEST_BALANCES, SUGGEST_DASHBOARD],
    };
  }

  if (askBalances || /\bcontas?\b/i.test(text)) {
    const card = balancesInsight(input.data);
    const goAccounts = /\b(abre|abra|abrir|mostra|mostre|quero\s+ir|ir\s+(?:pra|para))\b/i.test(
      text,
    );
    return {
      reply: card ? balancesReply(card) : emptyBalancesReply(),
      card: card ?? undefined,
      view: goAccounts ? "accounts" : undefined,
      steps: goAccounts ? openViewSteps("accounts") : undefined,
      suggestions: [SUGGEST_OPEN_ACCOUNTS, SUGGEST_WORTH],
    };
  }

  if (wantsFocusComposer(text)) {
    return {
      reply: "Deixei o campo da mensagem prontinho pra você escrever de novo.",
      view: "clara",
      steps: [{ ref: "Mensagem para a Clara", action: "clear" }],
      suggestions: [SUGGEST_BALANCES],
    };
  }

  if (account) {
    const card = accountInsight(account, input.data.connections);
    return {
      reply: accountCardReply(card),
      card,
      suggestions: [SUGGEST_OPEN_ACCOUNTS, SUGGEST_BALANCES],
    };
  }

  return {
    reply:
      "Não entendi bem, meu bem. Digite /help pra ver o que eu já sei responder, ou pergunte ritmo do mês, resumo, metas, saldo ou patrimônio.",
    suggestions: [SUGGEST_HELP, SUGGEST_PACE, SUGGEST_SUMMARY],
  };
}

export async function runClaraMock(
  input: ClaraMockInput,
): Promise<ClaraMockResult> {
  await sleep(400 + Math.floor(Math.random() * 400));
  return planClaraReply(input);
}
