import { type NotaFiscal, type NotaFiscalTomada } from "./db";

// Interface representing a single calculated tax obligation
export interface TributoObrigacao {
  id: string; // Unique key for listing/keys
  tipo: "ISS" | "PIS/COFINS" | "CSLL/IRRF" | "INSS";
  descricao: string; // Friendly label: e.g. "PIS/COFINS (Competência 05/2026)"
  competencia: string; // MM/YYYY
  empresaCnpj: string;
  empresaNome: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  status: "a_vencer" | "vence_hoje" | "vencido";
  diasParaVencer: number;
  municipio?: string; // For ISS: municipality name/code
}

// Fixed Brazilian national holidays (fixed dates)
const eFeriadoNacional = (date: Date): boolean => {
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1; // 1-indexed

  if (month === 1 && day === 1) return true;   // Confraternização Universal
  if (month === 4 && day === 21) return true;  // Tiradentes
  if (month === 5 && day === 1) return true;   // Dia do Trabalho
  if (month === 9 && day === 7) return true;   // Independência do Brasil
  if (month === 10 && day === 12) return true; // Nossa Senhora Aparecida
  if (month === 11 && day === 2) return true;  // Finados
  if (month === 11 && day === 15) return true; // Proclamação da República
  if (month === 11 && day === 20) return true; // Dia da Consciência Negra
  if (month === 12 && day === 25) return true; // Natal

  return false;
};

// Gets the previous business day if the date falls on a weekend or holiday
export function obterDiaUtilAnterior(date: Date): Date {
  const cur = new Date(date.getTime());
  while (true) {
    const dayOfWeek = cur.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0) {
      cur.setUTCDate(cur.getUTCDate() - 2); // Go to Friday
    } else if (dayOfWeek === 6) {
      cur.setUTCDate(cur.getUTCDate() - 1); // Go to Friday
    } else if (eFeriadoNacional(cur)) {
      cur.setUTCDate(cur.getUTCDate() - 1); // Go back one day
    } else {
      break;
    }
  }
  return cur;
}

// Config manager for ISS Municipality deadlines stored in localStorage
export interface IssDeadlineConfig {
  codigo: string;
  nome: string;
  diaVencimento: number; // e.g., 10 or 15
}

export function obterConfigsIss(): Record<string, IssDeadlineConfig> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem("issDeadlinesConfigs");
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function salvarConfigsIss(configs: Record<string, IssDeadlineConfig>) {
  if (typeof window !== "undefined") {
    localStorage.setItem("issDeadlinesConfigs", JSON.stringify(configs));
  }
}

// Helper to determine the due date for ISS Municipal
function calcularVencimentoIss(
  mesEvent: number, // 1-12
  anoEvent: number,
  municipalCode: string,
  configs: Record<string, IssDeadlineConfig>
): string {
  // Determine next month
  let nextMonth = mesEvent + 1;
  let nextYear = anoEvent;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear += 1;
  }

  // Get due day (default to 10 if not configured)
  const config = configs[municipalCode];
  const dueDay = config?.diaVencimento ?? 10;

  // Create date and adjust to business day
  const dueBase = new Date(Date.UTC(nextYear, nextMonth - 1, dueDay));
  const dueFinal = obterDiaUtilAnterior(dueBase);

  return dueFinal.toISOString().split("T")[0];
}

// Helper to determine due date for PIS/COFINS (25th of next month)
function calcularVencimentoPisCofins(mesEvent: number, anoEvent: number): string {
  let nextMonth = mesEvent + 1;
  let nextYear = anoEvent;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear += 1;
  }

  const dueBase = new Date(Date.UTC(nextYear, nextMonth - 1, 25));
  const dueFinal = obterDiaUtilAnterior(dueBase);

  return dueFinal.toISOString().split("T")[0];
}

// Helper to determine due date for CSLL/IRRF (Last business day of the fortnight)
function calcularVencimentoRetencaoFonte(dayEvent: number, mesEvent: number, anoEvent: number): string {
  let dueBase: Date;
  if (dayEvent <= 15) {
    // 1st Fortnight: paid by the last business day of the fortnight (day 15 of current month)
    dueBase = new Date(Date.UTC(anoEvent, mesEvent - 1, 15));
  } else {
    // 2nd Fortnight: paid by the last business day of the month
    // New Date(year, month, 0) returns the last day of the previous month
    dueBase = new Date(Date.UTC(anoEvent, mesEvent, 0));
  }

  const dueFinal = obterDiaUtilAnterior(dueBase);
  return dueFinal.toISOString().split("T")[0];
}

// Helper to determine due date for INSS Retido (20th of next month)
function calcularVencimentoInss(mesEvent: number, anoEvent: number): string {
  let nextMonth = mesEvent + 1;
  let nextYear = anoEvent;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear += 1;
  }

  const dueBase = new Date(Date.UTC(nextYear, nextMonth - 1, 20));
  const dueFinal = obterDiaUtilAnterior(dueBase);

  return dueFinal.toISOString().split("T")[0];
}

export function calcularProximasObrigacoes(
  emitidas: NotaFiscal[],
  tomadas: NotaFiscalTomada[],
  referenceDate: Date = new Date()
): TributoObrigacao[] {
  const configs = obterConfigsIss();
  const list: TributoObrigacao[] = [];

  // 1. Process active sales (emitidas) -> generates PIS/COFINS and ISS (if not withheld)
  emitidas.forEach((n) => {
    if (n.status !== "válida" || !n.dhEmi) return;

    const date = new Date(n.dhEmi);
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();
    const compStr = `${String(month).padStart(2, "0")}/${year}`;

    // ISS Municipal (recolhimento próprio)
    if (n.issRetido === "Não" && (n.vlrIss ?? 0) > 0) {
      const muniCode = n.codTribNacional || "DEFAULT";
      const venc = calcularVencimentoIss(month, year, muniCode, configs);
      const config = configs[muniCode];
      const muniNome = config?.nome || `Município ${muniCode}`;

      list.push({
        id: `iss_emi_${n.id}`,
        tipo: "ISS",
        descricao: `ISS Municipal - ${muniNome}`,
        competencia: compStr,
        empresaCnpj: n.cnpjPrestador,
        empresaNome: n.nomePrestador || "Empresa do Grupo",
        valor: n.vlrIss ?? 0,
        dataVencimento: venc,
        status: "a_vencer", // placeholder
        diasParaVencer: 0, // placeholder
        municipio: muniNome,
      });
    }

    // PIS/COFINS (regime cumulativo - sobre faturamento bruto)
    const pisVal = n.vlrPis ?? 0;
    const cofinsVal = n.vlrCofins ?? 0;
    const totalFed = pisVal + cofinsVal;
    if (totalFed > 0) {
      const venc = calcularVencimentoPisCofins(month, year);
      list.push({
        id: `pis_cofins_${n.id}`,
        tipo: "PIS/COFINS",
        descricao: "PIS/COFINS Cumulativo (Faturamento)",
        competencia: compStr,
        empresaCnpj: n.cnpjPrestador,
        empresaNome: n.nomePrestador || "Empresa do Grupo",
        valor: totalFed,
        dataVencimento: venc,
        status: "a_vencer",
        diasParaVencer: 0,
      });
    }
  });

  // 2. Process active purchases (tomadas) -> generates ISS Retido (if withheld) and CSLL/IRRF/INSS/PIS/COFINS Retidos
  tomadas.forEach((n) => {
    if (n.status !== "válida" || !n.dhEmi) return;

    const date = new Date(n.dhEmi);
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();
    const compStr = `${String(month).padStart(2, "0")}/${year}`;

    // ISS Retido na Fonte (tomador paga ao município)
    if (n.issRetido === "Sim" && (n.vlrIssRet ?? 0) > 0) {
      const muniCode = n.codTribNacional || "DEFAULT";
      const venc = calcularVencimentoIss(month, year, muniCode, configs);
      const config = configs[muniCode];
      const muniNome = config?.nome || `Município ${muniCode}`;

      list.push({
        id: `iss_tom_${n.id}`,
        tipo: "ISS",
        descricao: `ISS Retido na Fonte - ${muniNome}`,
        competencia: compStr,
        empresaCnpj: n.cnpjTomador,
        empresaNome: n.nomeTomador || "Empresa do Grupo",
        valor: n.vlrIssRet ?? 0,
        dataVencimento: venc,
        status: "a_vencer",
        diasParaVencer: 0,
        municipio: muniNome,
      });
    }

    // Federal source withholdings: CSLL, IRRF, PIS, COFINS
    const vlrFedRet = (n.vlrCsll ?? 0) + (n.vlrIrrf ?? 0) + (n.vlrPis ?? 0) + (n.vlrCofins ?? 0);
    if (vlrFedRet > 0) {
      const venc = calcularVencimentoRetencaoFonte(day, month, year);
      const quinzena = day <= 15 ? "1ª" : "2ª";
      list.push({
        id: `fed_ret_${n.id}`,
        tipo: "CSLL/IRRF",
        descricao: `Retenções Federais na Fonte (${quinzena} Quinzena)`,
        competencia: compStr,
        empresaCnpj: n.cnpjTomador,
        empresaNome: n.nomeTomador || "Empresa do Grupo",
        valor: vlrFedRet,
        dataVencimento: venc,
        status: "a_vencer",
        diasParaVencer: 0,
      });
    }

    // INSS Retido na Fonte
    if ((n.vlrInss ?? 0) > 0) {
      const venc = calcularVencimentoInss(month, year);
      list.push({
        id: `inss_ret_${n.id}`,
        tipo: "INSS",
        descricao: "INSS Retido na Fonte",
        competencia: compStr,
        empresaCnpj: n.cnpjTomador,
        empresaNome: n.nomeTomador || "Empresa do Grupo",
        valor: n.vlrInss ?? 0,
        dataVencimento: venc,
        status: "a_vencer",
        diasParaVencer: 0,
      });
    }
  });

  // 3. Group and consolidate identical obligations (by company, type, deadline, and municipality)
  const grouped = new Map<string, TributoObrigacao>();

  list.forEach((item) => {
    const key = `${item.empresaCnpj}_${item.tipo}_${item.dataVencimento}_${item.competencia}_${item.municipio || ""}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.valor += item.valor;
    } else {
      grouped.set(key, { ...item });
    }
  });

  // 4. Calculate statuses & days remaining relative to referenceDate
  const refDateClean = new Date(Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()));
  const refTime = refDateClean.getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const result = Array.from(grouped.values()).map((item) => {
    const [y, m, d] = item.dataVencimento.split("-").map(Number);
    const dueTime = new Date(Date.UTC(y, m - 1, d)).getTime();
    
    const diffMs = dueTime - refTime;
    const diffDays = Math.ceil(diffMs / ONE_DAY_MS);

    item.diasParaVencer = diffDays;
    if (diffDays < 0) {
      item.status = "vencido";
    } else if (diffDays === 0) {
      item.status = "vence_hoje";
    } else {
      item.status = "a_vencer";
    }

    return item;
  });

  // Sort: expired/vence hoje first, then by upcoming deadline, then by value
  return result.sort((a, b) => {
    if (a.status === "vencido" && b.status !== "vencido") return -1;
    if (b.status === "vencido" && a.status !== "vencido") return 1;
    if (a.status === "vence_hoje" && b.status === "a_vencer") return -1;
    if (b.status === "vence_hoje" && a.status === "a_vencer") return 1;

    return a.dataVencimento.localeCompare(b.dataVencimento) || b.valor - a.valor;
  });
}
