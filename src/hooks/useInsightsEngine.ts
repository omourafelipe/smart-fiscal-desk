import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertCircle, Star, Award, BarChart3 } from "lucide-react";

interface InsightsProps {
  faturamento: number;
  prevFaturamento: number;
  ticketMedio: number;
  prevNotasCount: number;
  notasAtivasCount: number;
  pieData: { name: string; value: number }[];
  lineChartData: { label: string; "Período Atual": number; "Período Anterior": number }[];
}

export interface Insight {
  id: string;
  type: "positive" | "negative" | "neutral" | "warning" | "achievement";
  title: string;
  description: string;
  icon: any; // Lucide Icon component
}

export function useInsightsEngine({
  faturamento,
  prevFaturamento,
  ticketMedio,
  notasAtivasCount,
  prevNotasCount,
  pieData,
  lineChartData,
}: InsightsProps) {
  const insights = useMemo(() => {
    const generated: Insight[] = [];

    // Regra 1: Faturamento Cresceu/Caiu
    if (prevFaturamento > 0) {
      const variacao = ((faturamento - prevFaturamento) / prevFaturamento) * 100;
      if (variacao > 0) {
        generated.push({
          id: "fat-up",
          type: "positive",
          title: "Crescimento de Receita",
          description: `O faturamento cresceu ${variacao.toFixed(1)}% em relação ao período anterior.`,
          icon: TrendingUp,
        });
      } else if (variacao < 0) {
        generated.push({
          id: "fat-down",
          type: "negative",
          title: "Queda na Receita",
          description: `Atenção: O faturamento caiu ${Math.abs(variacao).toFixed(1)}% em relação ao período anterior.`,
          icon: TrendingDown,
        });
      }
    }

    // Regra 2: Concentração de Receita (Pareto)
    if (pieData.length > 0 && faturamento > 0) {
      const topCategory = pieData[0];
      const concentracao = (topCategory.value / faturamento) * 100;
      if (concentracao >= 50) {
        generated.push({
          id: "concentracao",
          type: "warning",
          title: "Alta Concentração",
          description: `Uma única categoria (${topCategory.name}) representa ${concentracao.toFixed(1)}% de toda a receita.`,
          icon: AlertCircle,
        });
      }
    }

    // Regra 3: Ticket Médio
    if (notasAtivasCount > 0 && prevNotasCount > 0) {
      const prevTicketMedio = prevFaturamento / prevNotasCount;
      if (prevTicketMedio > 0) {
        const varTicket = ((ticketMedio - prevTicketMedio) / prevTicketMedio) * 100;
        if (varTicket > 5) {
          generated.push({
            id: "ticket-up",
            type: "positive",
            title: "Aumento no Ticket Médio",
            description: `O ticket médio subiu ${varTicket.toFixed(1)}%, indicando vendas de maior valor.`,
            icon: BarChart3,
          });
        } else if (varTicket < -5) {
          generated.push({
            id: "ticket-down",
            type: "negative",
            title: "Queda no Ticket Médio",
            description: `O ticket médio caiu ${Math.abs(varTicket).toFixed(1)}%.`,
            icon: TrendingDown,
          });
        }
      }
    }

    // Regra 4: Recorde Histórico (Melhor Mês do Ano)
    if (lineChartData.length > 0 && faturamento > 0) {
      const maxFaturamento = Math.max(...lineChartData.map(d => d["Período Atual"] || 0));
      // Se o faturamento atual for pelo menos 95% do maior faturamento registrado no array
      if (faturamento >= maxFaturamento && faturamento > 0 && lineChartData.filter(d => d["Período Atual"] > 0).length > 2) {
        generated.push({
          id: "record",
          type: "achievement",
          title: "Novo Recorde!",
          description: "Este período registra um dos melhores volumes de faturamento analisados.",
          icon: Award,
        });
      }
    }

    return generated;
  }, [faturamento, prevFaturamento, ticketMedio, notasAtivasCount, prevNotasCount, pieData, lineChartData]);

  return insights;
}
