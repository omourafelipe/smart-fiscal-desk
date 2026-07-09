import type { FiscalDocument, Empresa, Cliente } from "../../shared/types";

export interface Insight {
  id: string;
  categoria: "Faturamento" | "Tributário" | "Fiscal" | "Concentração" | "Financeiro";
  prioridade: "Alta" | "Média" | "Baixa";
  impacto: "Alto" | "Médio" | "Baixo";
  titulo: string;
  descricao: string;
  recomendacao: string;
}

export function generateInsights(
  docs: FiscalDocument[],
  empresas: Empresa[],
  clientes: Cliente[]
): Insight[] {
  const insights: Insight[] = [];
  const validDocs = docs.filter((d) => d.status_manual === "Ativo");
  
  if (validDocs.length === 0) return insights;

  // 1. Fiscal Inconsistencies Check
  const inconsistentCount = validDocs.filter((d) => d.validacao_status === "inconsistente").length;
  if (inconsistentCount > 0) {
    insights.push({
      id: "insight-fiscal-inconsistencias",
      categoria: "Fiscal",
      prioridade: "Alta",
      impacto: "Alto",
      titulo: `${inconsistentCount} notas com inconsistências fiscais encontradas`,
      descricao: "Identificamos divergências matemáticas entre valor bruto, líquido e retenções, ou alíquotas de ISS incomuns em notas emitidas.",
      recomendacao: "Acesse a aba Auditoria Fiscal para revisar as notas sinalizadas e realizar retificações fiscais junto à prefeitura se necessário."
    });
  }

  // 2. Client Concentration Check
  const totalRevenue = validDocs.reduce((acc, d) => acc + (d.valor_bruto || 0), 0);
  if (totalRevenue > 0 && clientes.length > 0) {
    const sortedClients = [...clientes].sort((a, b) => b.valor_total - a.valor_total);
    let cumulative = 0;
    let count = 0;
    for (const c of sortedClients) {
      cumulative += c.valor_total;
      count++;
      const ratio = cumulative / totalRevenue;
      if (ratio >= 0.70) {
        break;
      }
    }
    const percentConcentration = ((cumulative / totalRevenue) * 100).toFixed(0);
    if (count <= 3 && totalRevenue > 10000) {
      insights.push({
        id: "insight-financeiro-concentracao",
        categoria: "Concentração",
        prioridade: "Média",
        impacto: "Alto",
        titulo: "Elevada concentração de receita em poucos clientes",
        descricao: `${count} clientes representam ${percentConcentration}% de todo o faturamento da empresa.`,
        recomendacao: "Recomendamos diversificar a carteira de clientes ou estruturar contratos de longo prazo com esses clientes estratégicos para reduzir riscos de faturamento."
      });
    }
  }

  // 3. Tax Burden check
  const totalIss = validDocs.reduce((acc, d) => acc + (d.vlr_iss || 0), 0);
  const totalRetido = validDocs.reduce((acc, d) => acc + (d.valor_retido || 0), 0);
  if (totalRevenue > 0) {
    const taxBurden = ((totalRetido / totalRevenue) * 100);
    if (taxBurden > 15) {
      insights.push({
        id: "insight-tributario-carga",
        categoria: "Tributário",
        prioridade: "Média",
        impacto: "Médio",
        titulo: "Carga tributária com alta retenção na fonte",
        descricao: `A taxa média de tributação retida nas notas está em ${taxBurden.toFixed(1)}% do faturamento bruto.`,
        recomendacao: "Avalie o enquadramento tributário (Simples Nacional vs. Lucro Presumido) das empresas do grupo e a compatibilidade dos códigos de serviços (LC 116) declarados."
      });
    }
  }

  // 4. General revenue growth trend (mock / simple comparison if dates are available)
  insights.push({
    id: "insight-faturamento-crescimento",
    categoria: "Faturamento",
    prioridade: "Baixa",
    impacto: "Médio",
    titulo: "Faturamento totalizado e Ticket Médio estruturado",
    descricao: `O faturamento consolidado acumulado é de R$ ${totalRevenue.toLocaleString("pt-BR")}.`,
    recomendacao: "Utilize o gráfico de Pareto e a Curva ABC para identificar os serviços de maior rentabilidade e margem líquida."
  });

  return insights;
}
