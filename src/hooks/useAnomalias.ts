import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type NotaFiscal } from "@/lib/db";
import { useGlobalFilters } from "@/store/useGlobalFilters";

export interface AnomalyAlert {
  cnpj: string;
  empresa: string;
  mes: string; // YYYY-MM
  faturamentoAtual: number;
  mediaHistorica: number;
  desvioPadrao: number;
  diferencaPercentual: number;
  tipo: "queda" | "pico";
  description: string;
}

export function useAnomalias() {
  const { empresaFiltro, mesFiltro, anoFiltro } = useGlobalFilters();

  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], [] as NotaFiscal[]);

  const result = useMemo(() => {
    if (!todasNotas || todasNotas.length === 0) {
      return { anomalies: [], activeCompanyAnomaly: null };
    }

    // 1. Filter valid notes (status "válida")
    const notasValidas = todasNotas.filter(n => n.status === "válida");

    // 2. Identify target month (selected or latest)
    let targetMonth = ""; // YYYY-MM
    if (mesFiltro !== "__all__" && anoFiltro !== "__all__") {
      targetMonth = `${anoFiltro}-${mesFiltro}`;
    } else {
      // Find latest month
      let maxDate = "";
      notasValidas.forEach(n => {
        const d = n.dhEmi || n.dCompet || "";
        if (d && d > maxDate) maxDate = d;
      });
      if (maxDate) {
        targetMonth = maxDate.slice(0, 7);
      } else {
        return { anomalies: [], activeCompanyAnomaly: null };
      }
    }

    // Helper to generate list of 12 months preceding targetMonth
    const getPrecedingMonths = (startMonthStr: string, count = 12): string[] => {
      const parts = startMonthStr.split("-");
      let year = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10);

      const months: string[] = [];
      for (let i = 0; i < count; i++) {
        month--;
        if (month === 0) {
          month = 12;
          year--;
        }
        months.push(`${year}-${String(month).padStart(2, "0")}`);
      }
      return months.reverse(); // Chronological order
    };

    const historicalMonths = getPrecedingMonths(targetMonth, 12);

    // 3. Group valid notes by company (CNPJ) and month (YYYY-MM)
    const companyNames = new Map<string, string>();
    const companyMonthBilling = new Map<string, Map<string, number>>();

    notasValidas.forEach(n => {
      const cnpj = n.cnpjPrestador;
      companyNames.set(cnpj, n.nomePrestador || cnpj);

      const d = (n.dhEmi || n.dCompet || "").slice(0, 7);
      if (!d) return;

      if (!companyMonthBilling.has(cnpj)) {
        companyMonthBilling.set(cnpj, new Map<string, number>());
      }
      const mB = companyMonthBilling.get(cnpj)!;
      mB.set(d, (mB.get(d) || 0) + n.valor);
    });

    const anomaliesList: AnomalyAlert[] = [];

    // 4. Calculate stats for each company
    for (const [cnpj, monthMap] of companyMonthBilling.entries()) {
      const nome = companyNames.get(cnpj) || cnpj;

      // Current month faturamento
      const faturamentoAtual = monthMap.get(targetMonth) || 0;

      // Historical 12 months billing list
      const histValues = historicalMonths.map(m => monthMap.get(m) || 0);

      // Average (mean)
      const sum = histValues.reduce((a, b) => a + b, 0);
      const mediaHistorica = sum / 12;

      // Standard Deviation
      const sqDiffSum = histValues.reduce((a, b) => a + Math.pow(b - mediaHistorica, 2), 0);
      const desvioPadrao = Math.sqrt(sqDiffSum / 12);

      // Check for anomaly (more than 2 standard deviations from historical mean)
      // Only check if there's enough history (some non-zero billing in the last 12 months)
      if (sum > 0 && desvioPadrao > 0) {
        const diff = faturamentoAtual - mediaHistorica;
        if (Math.abs(diff) > 2 * desvioPadrao) {
          const diferencaPercentual = mediaHistorica > 0 ? Math.round((Math.abs(diff) / mediaHistorica) * 100) : 0;
          const tipo = diff < 0 ? "queda" : "pico";

          // Format month name for display
          const monthParts = targetMonth.split("-");
          const monthNamesPt = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
          ];
          const mesNome = `${monthNamesPt[parseInt(monthParts[1], 10) - 1]}/${monthParts[0]}`;

          const description = tipo === "queda"
            ? `Faturamento de ${nome} em ${mesNome} está ${diferencaPercentual}% abaixo da média dos últimos 12 meses.`
            : `Faturamento de ${nome} em ${mesNome} está ${diferencaPercentual}% acima da média dos últimos 12 meses.`;

          anomaliesList.push({
            cnpj,
            empresa: nome,
            mes: targetMonth,
            faturamentoAtual,
            mediaHistorica,
            desvioPadrao,
            diferencaPercentual,
            tipo,
            description
          });
        }
      }
    }

    // 5. Determine active company anomaly
    let activeCompanyAnomaly: AnomalyAlert | null = null;
    if (empresaFiltro !== "__all__") {
      activeCompanyAnomaly = anomaliesList.find(a => a.cnpj === empresaFiltro) || null;
    } else if (anomaliesList.length > 0) {
      activeCompanyAnomaly = anomaliesList[0]; // pick first if viewing group dashboard
    }

    return { anomalies: anomaliesList, activeCompanyAnomaly };
  }, [todasNotas, empresaFiltro, mesFiltro, anoFiltro]);

  return result;
}
