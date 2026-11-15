export type ClaraHelpPrompt = {
  id: string;
  label: string;
  prompt: string;
  detail: string;
};

export type ClaraHelpCard = {
  type: "help";
  prompts: ClaraHelpPrompt[];
};

/** Catálogo fixo do que o mock sabe responder hoje. */
export const CLARA_HELP_PROMPTS: ClaraHelpPrompt[] = [
  {
    id: "balances",
    label: "Saldos das contas",
    prompt: "Quanto tenho nas contas?",
    detail: "Lista saldos por conta e o total em real.",
  },
  {
    id: "worth",
    label: "Patrimônio",
    prompt: "Qual meu patrimônio?",
    detail: "Soma contas e investimentos em real.",
  },
  {
    id: "pace",
    label: "Ritmo do mês",
    prompt: "Posso gastar quanto hoje?",
    detail: "Limite diário, quanto já usou e o que resta no mês.",
  },
  {
    id: "summary",
    label: "Resumo do período",
    prompt: "Como foi o mês?",
    detail: "Também aceita “últimos 3 meses” ou “mês passado”.",
  },
  {
    id: "pending",
    label: "Contas a pagar",
    prompt: "O que vence?",
    detail: "Despesas manuais pendentes do período.",
  },
  {
    id: "recurring",
    label: "Recorrentes",
    prompt: "Quanto sai fixo este mês?",
    detail: "Fixos, parcelas e o que ainda falta no ciclo.",
  },
  {
    id: "category",
    label: "Gasto por categoria",
    prompt: "Onde gastei mais?",
    detail: "Também aceita “quanto gastei em Alimentação”.",
  },
  {
    id: "goals",
    label: "Metas",
    prompt: "Como vão as metas?",
    detail: "Progresso, valor atual e o que falta.",
  },
  {
    id: "complete-goal",
    label: "Concluir meta",
    prompt: "Conclui a meta Reserva",
    detail: "Abre Metas, conclui pelo nome e comemora com você.",
  },
  {
    id: "undo",
    label: "Desfazer",
    prompt: "Desfazer",
    detail: "Desfaz a última ação que a Clara fez.",
  },
  {
    id: "clear-chat",
    label: "Limpar conversa",
    prompt: "Limpar o chat",
    detail: "Apaga o histórico. Também dá pra clicar no logo.",
  },
  {
    id: "biggest",
    label: "Maior gasto do mês",
    prompt: "Qual foi o meu maior gasto este mês?",
    detail: "Também aceita “mês passado” ou “novembro de 2026”.",
  },
  {
    id: "account-detail",
    label: "Saldo de uma conta",
    prompt: "Qual o saldo do Nubank?",
    detail: "Troque o nome pela instituição ou conta que quiser.",
  },
  {
    id: "open-accounts",
    label: "Abrir Contas",
    prompt: "Abre Contas",
    detail: "Navega para a tela de Contas.",
  },
  {
    id: "open-dashboard",
    label: "Abrir Visão geral",
    prompt: "Abre Visão geral",
    detail: "Navega para o painel principal.",
  },
  {
    id: "open-transactions",
    label: "Abrir Lançamentos",
    prompt: "Abre Lançamentos",
    detail: "Navega para o extrato de entradas e saídas.",
  },
  {
    id: "help",
    label: "Ajuda",
    prompt: "/help",
    detail: "Mostra esta lista de novo.",
  },
];

export function wantsHelp(message: string) {
  const text = message.trim();
  return (
    /^\/help\b/i.test(text) ||
    /^\/ajuda\b/i.test(text) ||
    /^(help|ajuda)$/i.test(text) ||
    /\bo\s+que\s+(voc[eê]|vc)\s+(sabe|consegue|pode)\b/i.test(text) ||
    /\b(comandos|perguntas)\s+(dispon[ií]veis|que\s+aceita)\b/i.test(text)
  );
}

export function buildHelpCard(): ClaraHelpCard {
  return {
    type: "help",
    prompts: CLARA_HELP_PROMPTS.filter((item) => item.id !== "help"),
  };
}

export function helpReply() {
  return "Claro, meu bem. Estas são as perguntas e atalhos que eu já sei tratar. Toque em um botão pra eu deixar o texto pronto no campo.";
}
