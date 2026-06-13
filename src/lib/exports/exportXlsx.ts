import * as XLSX from "xlsx";
import { db, type NotaFiscal, type NotaFiscalTomada } from "@/lib/db";
import { classificarServicoLocal } from "@/lib/category-utils";
import { CategoryLabelService } from "@/lib/services/CategoryLabelService";

// Helper formats for formatting cells
const formatarData = (dataStr: string) => {
  if (!dataStr) return "—";
  try {
    const clean = dataStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dataStr;
  } catch {
    return dataStr;
  }
};

const formatarCompetencia = (competenciaStr: string) => {
  if (!competenciaStr) return "—";
  try {
    const clean = competenciaStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length >= 2) {
      return `${parts[1]}/${parts[0]}`;
    }
    return competenciaStr;
  } catch {
    return competenciaStr;
  }
};

const formatarCnpjCpf = (val: string) => {
  const clean = String(val ?? "").replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return val;
};

// Helper wrappers for SheetJS Cell Objects
function makeStringCell(val: string) {
  return { v: val || "", t: "s" };
}

function makeNumberCell(val: number) {
  return { v: val || 0, t: "n" };
}

function makeCurrencyCell(val: number) {
  return { v: val || 0, t: "n", z: "R$#,##0.00;[Red](R$#,##0.00);\"-\"" };
}

function makePercentCell(val: number) {
  return { v: val || 0, t: "n", z: "0.0%" };
}

export async function exportToXlsx(
  filteredEmitidas: NotaFiscal[],
  filteredTomadas: NotaFiscalTomada[],
  periodType: "competencia" | "emissao" = "competencia"
) {
  // Load category classification rules & manual overrides from IndexedDB
  const classifications = await db.serviceClassifications.toArray();
  const rules = await db.categoryRules.toArray();
  const classificationsMap = new Map(classifications.map((c) => [c.codigo, c]));

  const getNotaCategory = (codTrib: string | undefined | null, servicoDesc: string | undefined | null) => {
    const code = String(codTrib || "").trim();
    if (!code) return "Outros Serviços";
    const existing = classificationsMap.get(code);
    if (existing && existing.categoriaExecutiva) {
      return existing.categoriaExecutiva;
    }
    const res = classificarServicoLocal(code, servicoDesc || "", rules);
    return res.categoriaExecutiva || "Outros Serviços";
  };

  const wb = XLSX.utils.book_new();

  // ==========================================
  // ABA 1: EMITIDAS
  // ==========================================
  const headersEmitidas = [
    "Número NFS-e",
    "Situação",
    "Data Emissão",
    "Competência",
    "CNPJ",
    "Cliente",
    "Valor Bruto",
    "ISS",
    "ISS Retido",
    "ISS a Recolher",
    "PIS",
    "COFINS",
    "CSLL",
    "IRRF",
    "INSS",
    "Valor Líquido",
    "Serviço",
    "Categoria Executiva",
  ];

  const rowsEmitidas: any[][] = [headersEmitidas.map(makeStringCell)];

  for (const n of filteredEmitidas) {
    const isRetido = n.issRetido === "Sim";
    const vlrIss = n.vlrIss ?? 0;
    const issRetido = isRetido ? (n.vlrIssRet ?? vlrIss) : 0;
    const issRecolher = !isRetido ? (n.vlrIssRecolher ?? vlrIss) : 0;

    const servicoLabel = n.codTribNacional
      ? `${n.codTribNacional} - ${CategoryLabelService.getFriendlyName(n.codTribNacional)}`
      : "—";

    const categoria = getNotaCategory(n.codTribNacional, n.servico);

    rowsEmitidas.push([
      makeStringCell(n.nNFSe),
      makeStringCell(n.status === "válida" ? "Válida" : "Cancelada"),
      makeStringCell(formatarData(n.dhEmi)),
      makeStringCell(formatarCompetencia(n.dCompet)),
      makeStringCell(formatarCnpjCpf(n.cnpjCpfCliente)),
      makeStringCell(n.cliente),
      makeCurrencyCell(n.valor),
      makeCurrencyCell(vlrIss),
      makeCurrencyCell(issRetido),
      makeCurrencyCell(issRecolher),
      makeCurrencyCell(n.vlrPis ?? 0),
      makeCurrencyCell(n.vlrCofins ?? 0),
      makeCurrencyCell(n.vlrCsll ?? 0),
      makeCurrencyCell(n.vlrIrrf ?? 0),
      makeCurrencyCell(n.vlrInss ?? 0),
      makeCurrencyCell(n.vlrLiquido ?? n.valor),
      makeStringCell(servicoLabel),
      makeStringCell(categoria),
    ]);
  }

  const wsEmitidas = XLSX.utils.aoa_to_sheet(rowsEmitidas);
  XLSX.utils.book_append_sheet(wb, wsEmitidas, "Emitidas");

  // ==========================================
  // ABA 2: TOMADAS
  // ==========================================
  const headersTomadas = [
    "Número NFS-e",
    "Situação",
    "Data Emissão",
    "Competência",
    "CNPJ Prestador",
    "Fornecedor/Prestador",
    "Valor Bruto",
    "ISS",
    "ISS Retido",
    "ISS a Recolher",
    "PIS",
    "COFINS",
    "CSLL",
    "IRRF",
    "INSS",
    "Valor Líquido",
    "Serviço",
    "Categoria Executiva",
  ];

  const rowsTomadas: any[][] = [headersTomadas.map(makeStringCell)];

  for (const n of filteredTomadas) {
    const isRetido = n.issRetido === "Sim";
    const vlrIss = n.vlrIss ?? 0;
    const issRetido = isRetido ? (n.vlrIssRet ?? vlrIss) : 0;
    const issRecolher = !isRetido ? vlrIss : 0;

    const categoria = getNotaCategory(n.codTribNacional, n.servico);

    rowsTomadas.push([
      makeStringCell(n.nNFSe),
      makeStringCell(n.status === "válida" ? "Válida" : "Cancelada"),
      makeStringCell(formatarData(n.dhEmi)),
      makeStringCell(formatarCompetencia(n.dCompet)),
      makeStringCell(formatarCnpjCpf(n.cnpjPrestador)),
      makeStringCell(n.nomePrestador),
      makeCurrencyCell(n.valor),
      makeCurrencyCell(vlrIss),
      makeCurrencyCell(issRetido),
      makeCurrencyCell(issRecolher),
      makeCurrencyCell(n.vlrPis ?? 0),
      makeCurrencyCell(n.vlrCofins ?? 0),
      makeCurrencyCell(n.vlrCsll ?? 0),
      makeCurrencyCell(n.vlrIrrf ?? 0),
      makeCurrencyCell(n.vlrInss ?? 0),
      makeCurrencyCell(n.vlrLiquido ?? n.valor),
      makeStringCell(n.servico),
      makeStringCell(categoria),
    ]);
  }

  const wsTomadas = XLSX.utils.aoa_to_sheet(rowsTomadas);
  XLSX.utils.book_append_sheet(wb, wsTomadas, "Tomadas");

  // ==========================================
  // ABA 3: RESUMO TRIBUTÁRIO
  // ==========================================
  const headersResumo = [
    "Período (Mês/Ano)",
    "CNPJ Empresa",
    "Nome da Empresa",
    "Tipo de Operação",
    "Qtd Notas",
    "Valor Bruto",
    "ISS",
    "ISS Retido",
    "ISS a Recolher",
    "PIS",
    "COFINS",
    "CSLL",
    "IRRF",
    "INSS",
    "Valor Líquido",
  ];

  const rowsResumo: any[][] = [headersResumo.map(makeStringCell)];

  // Group by Month/Year, CNPJ and Operation Type
  interface ResumoGrupo {
    periodo: string;
    cnpj: string;
    nome: string;
    tipo: string;
    count: number;
    bruto: number;
    iss: number;
    issRetido: number;
    issRecolher: number;
    pis: number;
    cofins: number;
    csll: number;
    irrf: number;
    inss: number;
    liquido: number;
  }

  const resumoMap = new Map<string, ResumoGrupo>();

  const getResumoKey = (periodo: string, cnpj: string, tipo: string) =>
    `${periodo}_${cnpj.replace(/\D/g, "")}_${tipo}`;

  // Process Emitidas
  for (const n of filteredEmitidas) {
    if (n.status !== "válida") continue;
    const dateStr = periodType === "competencia" && n.dCompet ? n.dCompet : n.dhEmi || "";
    const periodo = dateStr ? `${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}` : "Outro";
    const cnpj = n.cnpjPrestador || "—";
    const key = getResumoKey(periodo, cnpj, "Emitida (Faturamento)");

    const isRetido = n.issRetido === "Sim";
    const vlrIss = n.vlrIss ?? 0;
    const issRetido = isRetido ? (n.vlrIssRet ?? vlrIss) : 0;
    const issRecolher = !isRetido ? (n.vlrIssRecolher ?? vlrIss) : 0;

    let group = resumoMap.get(key);
    if (!group) {
      group = {
        periodo,
        cnpj,
        nome: n.nomePrestador || "Empresa do Grupo",
        tipo: "Emitida (Faturamento)",
        count: 0,
        bruto: 0,
        iss: 0,
        issRetido: 0,
        issRecolher: 0,
        pis: 0,
        cofins: 0,
        csll: 0,
        irrf: 0,
        inss: 0,
        liquido: 0,
      };
      resumoMap.set(key, group);
    }

    group.count += 1;
    group.bruto += n.valor;
    group.iss += vlrIss;
    group.issRetido += issRetido;
    group.issRecolher += issRecolher;
    group.pis += n.vlrPis ?? 0;
    group.cofins += n.vlrCofins ?? 0;
    group.csll += n.vlrCsll ?? 0;
    group.irrf += n.vlrIrrf ?? 0;
    group.inss += n.vlrInss ?? 0;
    group.liquido += n.vlrLiquido ?? n.valor;
  }

  // Process Tomadas
  for (const n of filteredTomadas) {
    if (n.status !== "válida") continue;
    const dateStr = periodType === "competencia" && n.dCompet ? n.dCompet : n.dhEmi || "";
    const periodo = dateStr ? `${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}` : "Outro";
    const cnpj = n.cnpjTomador || "—";
    const key = getResumoKey(periodo, cnpj, "Tomada (Serviço Recebido)");

    const isRetido = n.issRetido === "Sim";
    const vlrIss = n.vlrIss ?? 0;
    const issRetido = isRetido ? (n.vlrIssRet ?? vlrIss) : 0;
    const issRecolher = !isRetido ? vlrIss : 0;

    let group = resumoMap.get(key);
    if (!group) {
      group = {
        periodo,
        cnpj,
        nome: n.nomeTomador || "Empresa do Grupo",
        tipo: "Tomada (Serviço Recebido)",
        count: 0,
        bruto: 0,
        iss: 0,
        issRetido: 0,
        issRecolher: 0,
        pis: 0,
        cofins: 0,
        csll: 0,
        irrf: 0,
        inss: 0,
        liquido: 0,
      };
      resumoMap.set(key, group);
    }

    group.count += 1;
    group.bruto += n.valor;
    group.iss += vlrIss;
    group.issRetido += issRetido;
    group.issRecolher += issRecolher;
    group.pis += n.vlrPis ?? 0;
    group.cofins += n.vlrCofins ?? 0;
    group.csll += n.vlrCsll ?? 0;
    group.irrf += n.vlrIrrf ?? 0;
    group.inss += n.vlrInss ?? 0;
    group.liquido += n.vlrLiquido ?? n.valor;
  }

  // Sort groups chronologically and alphabetically
  const sortedResumo = Array.from(resumoMap.values()).sort((a, b) => {
    const parseKey = (p: string) => {
      const parts = p.split("/");
      if (parts.length === 2) return `${parts[1]}_${parts[0]}`;
      return p;
    };
    const keyA = parseKey(a.periodo);
    const keyB = parseKey(b.periodo);
    if (keyA !== keyB) return keyA.localeCompare(keyB);
    return a.cnpj.localeCompare(b.cnpj);
  });

  for (const g of sortedResumo) {
    rowsResumo.push([
      makeStringCell(g.periodo),
      makeStringCell(formatarCnpjCpf(g.cnpj)),
      makeStringCell(g.nome),
      makeStringCell(g.tipo),
      makeNumberCell(g.count),
      makeCurrencyCell(g.bruto),
      makeCurrencyCell(g.iss),
      makeCurrencyCell(g.issRetido),
      makeCurrencyCell(g.issRecolher),
      makeCurrencyCell(g.pis),
      makeCurrencyCell(g.cofins),
      makeCurrencyCell(g.csll),
      makeCurrencyCell(g.irrf),
      makeCurrencyCell(g.inss),
      makeCurrencyCell(g.liquido),
    ]);
  }

  const wsResumo = XLSX.utils.aoa_to_sheet(rowsResumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Tributário");

  // ==========================================
  // ABA 4: POR CATEGORIA
  // ==========================================
  const headersCategoria = [
    "Categoria Executiva",
    "Valor Bruto",
    "% do Faturamento Total",
  ];

  const rowsCategoria: any[][] = [headersCategoria.map(makeStringCell)];

  // Group faturamento of válidas emitidas by Categoria Executiva
  const faturamentoPorCategoriaMap = new Map<string, number>();
  let faturamentoTotal = 0;

  for (const n of filteredEmitidas) {
    if (n.status !== "válida") continue;
    const cat = getNotaCategory(n.codTribNacional, n.servico);
    faturamentoPorCategoriaMap.set(
      cat,
      (faturamentoPorCategoriaMap.get(cat) ?? 0) + n.valor
    );
    faturamentoTotal += n.valor;
  }

  const sortedCategorias = Array.from(faturamentoPorCategoriaMap.entries()).sort(
    ([, valA], [, valB]) => valB - valA
  );

  for (const [cat, value] of sortedCategorias) {
    const percent = faturamentoTotal > 0 ? value / faturamentoTotal : 0;
    rowsCategoria.push([
      makeStringCell(cat),
      makeCurrencyCell(value),
      makePercentCell(percent),
    ]);
  }

  const wsCategoria = XLSX.utils.aoa_to_sheet(rowsCategoria);
  XLSX.utils.book_append_sheet(wb, wsCategoria, "Por Categoria");

  // ==========================================
  // FILE TRIGGER WRITER
  // ==========================================
  const filename = `relatorio_fiscal_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Sanitiza o nome para abas do Excel (máximo 30 caracteres, sem caracteres inválidos)
 */
function sanitizeSheetName(name: string, index: number): string {
  let clean = name
    .replace(/[\\/?*\[\]:]/g, "")
    .trim();
  if (clean.length > 25) {
    clean = clean.slice(0, 25);
  }
  return `${index + 1}. ${clean || "Empresa"}`;
}

export async function exportConsolidadoXlsx(
  todasEmitidas: NotaFiscal[],
  todasTomadas: NotaFiscalTomada[],
  empresas: { cnpj: string; nome: string }[],
  periodType: "competencia" | "emissao"
) {
  const classifications = await db.serviceClassifications.toArray();
  const rules = await db.categoryRules.toArray();
  const classificationsMap = new Map(classifications.map((c) => [c.codigo, c]));

  const getNotaCategory = (codTrib: string | undefined | null, servicoDesc: string | undefined | null) => {
    const code = String(codTrib || "").trim();
    if (!code) return "Outros Serviços";
    const existing = classificationsMap.get(code);
    if (existing && existing.categoriaExecutiva) {
      return existing.categoriaExecutiva;
    }
    const res = classificarServicoLocal(code, servicoDesc || "", rules);
    return res.categoriaExecutiva || "Outros Serviços";
  };

  const wb = XLSX.utils.book_new();

  // ==========================================
  // 1. ABA DE CONSOLIDAÇÃO
  // ==========================================
  const headersConsolidacao = [
    "Empresa",
    "CNPJ",
    "Qtd Notas Emitidas",
    "Faturamento Bruto (Emitido)",
    "ISS Retido (Emitido)",
    "ISS a Recolher (Emitido)",
    "PIS (Emitido)",
    "COFINS (Emitido)",
    "CSLL (Emitido)",
    "IRRF (Emitido)",
    "INSS (Emitido)",
    "Faturamento Líquido",
    "Qtd Notas Tomadas",
    "Valor Tomado (Bruto)",
    "ISS Retido (Tomado)",
    "Retenções Federais (Tomadas)",
  ];

  const rowsConsolidacao: any[][] = [headersConsolidacao.map(makeStringCell)];

  // Totals for the bottom row
  let tQtdEmitidas = 0;
  let tFaturamentoBruto = 0;
  let tIssRetidoEmitido = 0;
  let tIssRecolherEmitido = 0;
  let tPisEmitido = 0;
  let tCofinsEmitido = 0;
  let tCsllEmitido = 0;
  let tIrrfEmitido = 0;
  let tInssEmitido = 0;
  let tFaturamentoLiquido = 0;
  let tQtdTomadas = 0;
  let tValorTomado = 0;
  let tIssRetidoTomado = 0;
  let tRetencoesFederaisTomadas = 0;

  for (const emp of empresas) {
    const cleanCnpj = emp.cnpj.replace(/\D/g, "");

    // Filter documents
    const emitidasEmp = todasEmitidas.filter(
      (n) => n.cnpjPrestador.replace(/\D/g, "") === cleanCnpj && n.status === "válida"
    );
    const tomadasEmp = todasTomadas.filter(
      (n) => n.cnpjTomador.replace(/\D/g, "") === cleanCnpj && n.status === "válida"
    );

    // Sum values
    const qtdEmitidas = emitidasEmp.length;
    const bruto = emitidasEmp.reduce((s, n) => s + n.valor, 0);
    const issRetidoEmitido = emitidasEmp.reduce(
      (s, n) => s + (n.issRetido === "Sim" ? (n.vlrIssRet ?? n.vlrIss ?? 0) : 0),
      0
    );
    const issRecolherEmitido = emitidasEmp.reduce(
      (s, n) => s + (n.issRetido === "Não" ? (n.vlrIssRecolher ?? n.vlrIss ?? 0) : 0),
      0
    );
    const pisEmitido = emitidasEmp.reduce((s, n) => s + (n.vlrPis ?? 0), 0);
    const cofinsEmitido = emitidasEmp.reduce((s, n) => s + (n.vlrCofins ?? 0), 0);
    const csllEmitido = emitidasEmp.reduce((s, n) => s + (n.vlrCsll ?? 0), 0);
    const irrfEmitido = emitidasEmp.reduce((s, n) => s + (n.vlrIrrf ?? 0), 0);
    const inssEmitido = emitidasEmp.reduce((s, n) => s + (n.vlrInss ?? 0), 0);

    // DRE formula: Faturamento Bruto - Deduções (ISS, PIS, COFINS)
    const totalDeducoes = emitidasEmp.reduce((s, n) => s + (n.vlrIss ?? 0) + (n.vlrPis ?? 0) + (n.vlrCofins ?? 0), 0);
    const liquido = bruto - totalDeducoes;

    const qtdTomadas = tomadasEmp.length;
    const valorTomado = tomadasEmp.reduce((s, n) => s + n.valor, 0);
    const issRetidoTomado = tomadasEmp.reduce(
      (s, n) => s + (n.issRetido === "Sim" ? (n.vlrIssRet ?? 0) : 0),
      0
    );
    const retencoesFederaisTomadas = tomadasEmp.reduce(
      (s, n) => s + (n.vlrCsll ?? 0) + (n.vlrIrrf ?? 0) + (n.vlrPis ?? 0) + (n.vlrCofins ?? 0) + (n.vlrInss ?? 0),
      0
    );

    // Add row
    rowsConsolidacao.push([
      makeStringCell(emp.nome),
      makeStringCell(formatarCnpjCpf(emp.cnpj)),
      makeNumberCell(qtdEmitidas),
      makeCurrencyCell(bruto),
      makeCurrencyCell(issRetidoEmitido),
      makeCurrencyCell(issRecolherEmitido),
      makeCurrencyCell(pisEmitido),
      makeCurrencyCell(cofinsEmitido),
      makeCurrencyCell(csllEmitido),
      makeCurrencyCell(irrfEmitido),
      makeCurrencyCell(inssEmitido),
      makeCurrencyCell(liquido),
      makeNumberCell(qtdTomadas),
      makeCurrencyCell(valorTomado),
      makeCurrencyCell(issRetidoTomado),
      makeCurrencyCell(retencoesFederaisTomadas),
    ]);

    // Aggregate totals
    tQtdEmitidas += qtdEmitidas;
    tFaturamentoBruto += bruto;
    tIssRetidoEmitido += issRetidoEmitido;
    tIssRecolherEmitido += issRecolherEmitido;
    tPisEmitido += pisEmitido;
    tCofinsEmitido += cofinsEmitido;
    tCsllEmitido += csllEmitido;
    tIrrfEmitido += irrfEmitido;
    tInssEmitido += inssEmitido;
    tFaturamentoLiquido += liquido;
    tQtdTomadas += qtdTomadas;
    tValorTomado += valorTomado;
    tIssRetidoTomado += issRetidoTomado;
    tRetencoesFederaisTomadas += retencoesFederaisTomadas;
  }

  // Add total row at the bottom
  rowsConsolidacao.push([
    makeStringCell("TOTAL CONSOLIDADO DO GRUPO"),
    makeStringCell(""),
    makeNumberCell(tQtdEmitidas),
    makeCurrencyCell(tFaturamentoBruto),
    makeCurrencyCell(tIssRetidoEmitido),
    makeCurrencyCell(tIssRecolherEmitido),
    makeCurrencyCell(tPisEmitido),
    makeCurrencyCell(tCofinsEmitido),
    makeCurrencyCell(tCsllEmitido),
    makeCurrencyCell(tIrrfEmitido),
    makeCurrencyCell(tInssEmitido),
    makeCurrencyCell(tFaturamentoLiquido),
    makeNumberCell(tQtdTomadas),
    makeCurrencyCell(tValorTomado),
    makeCurrencyCell(tIssRetidoTomado),
    makeCurrencyCell(tRetencoesFederaisTomadas),
  ]);

  const wsConsolidacao = XLSX.utils.aoa_to_sheet(rowsConsolidacao);
  XLSX.utils.book_append_sheet(wb, wsConsolidacao, "Consolidação");

  // ==========================================
  // 2. ABAS INDIVIDUAIS POR EMPRESA
  // ==========================================
  empresas.forEach((emp, index) => {
    const cleanCnpj = emp.cnpj.replace(/\D/g, "");
    const sheetName = sanitizeSheetName(emp.nome, index);

    const emitidasEmp = todasEmitidas.filter(
      (n) => n.cnpjPrestador.replace(/\D/g, "") === cleanCnpj
    );
    const tomadasEmp = todasTomadas.filter(
      (n) => n.cnpjTomador.replace(/\D/g, "") === cleanCnpj
    );

    const rows: any[][] = [];

    // Header 1: Company details
    rows.push([makeStringCell(`DETALHES FISCAIS - ${emp.nome.toUpperCase()}`)]);
    rows.push([makeStringCell(`CNPJ: ${formatarCnpjCpf(emp.cnpj)}`)]);
    rows.push([]);

    // SECTION A: RESUMO TRIBUTÁRIO MENSAL
    rows.push([makeStringCell(">>> RESUMO TRIBUTÁRIO MENSAL")]);
    const headersResumo = [
      "Período (Mês/Ano)",
      "Tipo de Operação",
      "Qtd Notas",
      "Valor Bruto",
      "ISS",
      "ISS Retido",
      "ISS a Recolher",
      "PIS",
      "COFINS",
      "CSLL",
      "IRRF",
      "INSS",
      "Valor Líquido",
    ];
    rows.push(headersResumo.map(makeStringCell));

    const resumoMap = new Map<string, any>();
    const getResumoKey = (periodo: string, tipo: string) => `${periodo}_${tipo}`;

    // Process emitidas
    emitidasEmp.forEach((n) => {
      if (n.status !== "válida") return;
      const dateStr = periodType === "competencia" && n.dCompet ? n.dCompet : n.dhEmi || "";
      const periodo = dateStr ? `${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}` : "Outro";
      const key = getResumoKey(periodo, "Emitida (Faturamento)");

      const isRetido = n.issRetido === "Sim";
      const vlrIss = n.vlrIss ?? 0;
      const issRetido = isRetido ? (n.vlrIssRet ?? vlrIss) : 0;
      const issRecolher = !isRetido ? (n.vlrIssRecolher ?? vlrIss) : 0;

      let group = resumoMap.get(key);
      if (!group) {
        group = {
          periodo,
          tipo: "Emitida (Faturamento)",
          count: 0,
          bruto: 0,
          iss: 0,
          issRetido: 0,
          issRecolher: 0,
          pis: 0,
          cofins: 0,
          csll: 0,
          irrf: 0,
          inss: 0,
          liquido: 0,
        };
        resumoMap.set(key, group);
      }

      group.count += 1;
      group.bruto += n.valor;
      group.iss += vlrIss;
      group.issRetido += issRetido;
      group.issRecolher += issRecolher;
      group.pis += n.vlrPis ?? 0;
      group.cofins += n.vlrCofins ?? 0;
      group.csll += n.vlrCsll ?? 0;
      group.irrf += n.vlrIrrf ?? 0;
      group.inss += n.vlrInss ?? 0;
      group.liquido += n.vlrLiquido ?? n.valor;
    });

    // Process tomadas
    tomadasEmp.forEach((n) => {
      if (n.status !== "válida") return;
      const dateStr = periodType === "competencia" && n.dCompet ? n.dCompet : n.dhEmi || "";
      const periodo = dateStr ? `${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}` : "Outro";
      const key = getResumoKey(periodo, "Tomada (Serviço Recebido)");

      const isRetido = n.issRetido === "Sim";
      const vlrIss = n.vlrIss ?? 0;
      const issRetido = isRetido ? (n.vlrIssRet ?? vlrIss) : 0;
      const issRecolher = !isRetido ? vlrIss : 0;

      let group = resumoMap.get(key);
      if (!group) {
        group = {
          periodo,
          tipo: "Tomada (Serviço Recebido)",
          count: 0,
          bruto: 0,
          iss: 0,
          issRetido: 0,
          issRecolher: 0,
          pis: 0,
          cofins: 0,
          csll: 0,
          irrf: 0,
          inss: 0,
          liquido: 0,
        };
        resumoMap.set(key, group);
      }

      group.count += 1;
      group.bruto += n.valor;
      group.iss += vlrIss;
      group.issRetido += issRetido;
      group.issRecolher += issRecolher;
      group.pis += n.vlrPis ?? 0;
      group.cofins += n.vlrCofins ?? 0;
      group.csll += n.vlrCsll ?? 0;
      group.irrf += n.vlrIrrf ?? 0;
      group.inss += n.vlrInss ?? 0;
      group.liquido += n.vlrLiquido ?? n.valor;
    });

    const sortedResumo = Array.from(resumoMap.values()).sort((a, b) => {
      const parseKey = (p: string) => {
        const parts = p.split("/");
        if (parts.length === 2) return `${parts[1]}_${parts[0]}`;
        return p;
      };
      return parseKey(a.periodo).localeCompare(parseKey(b.periodo));
    });

    sortedResumo.forEach((g) => {
      rows.push([
        makeStringCell(g.periodo),
        makeStringCell(g.tipo),
        makeNumberCell(g.count),
        makeCurrencyCell(g.bruto),
        makeCurrencyCell(g.iss),
        makeCurrencyCell(g.issRetido),
        makeCurrencyCell(g.issRecolher),
        makeCurrencyCell(g.pis),
        makeCurrencyCell(g.cofins),
        makeCurrencyCell(g.csll),
        makeCurrencyCell(g.irrf),
        makeCurrencyCell(g.inss),
        makeCurrencyCell(g.liquido),
      ]);
    });

    rows.push([]);

    // SECTION B: POR CATEGORIA EXECUTIVA (EMITIDAS VÁLIDAS)
    rows.push([makeStringCell(">>> FATURAMENTO POR CATEGORIA EXECUTIVA")]);
    rows.push(["Categoria Executiva", "Valor Bruto", "% do Faturamento Total"].map(makeStringCell));

    const faturamentoPorCategoriaMap = new Map<string, number>();
    let totalEmitidasValidas = 0;

    emitidasEmp.forEach((n) => {
      if (n.status !== "válida") return;
      const cat = getNotaCategory(n.codTribNacional, n.servico);
      faturamentoPorCategoriaMap.set(cat, (faturamentoPorCategoriaMap.get(cat) ?? 0) + n.valor);
      totalEmitidasValidas += n.valor;
    });

    const sortedCategorias = Array.from(faturamentoPorCategoriaMap.entries()).sort((a, b) => b[1] - a[1]);
    sortedCategorias.forEach(([cat, val]) => {
      const pct = totalEmitidasValidas > 0 ? val / totalEmitidasValidas : 0;
      rows.push([makeStringCell(cat), makeCurrencyCell(val), makePercentCell(pct)]);
    });

    rows.push([]);

    // SECTION C: NOTAS EMITIDAS DETALHADAS
    rows.push([makeStringCell(">>> LISTA DE NOTAS FISCAIS EMITIDAS")]);
    const headersEmitidasDet = [
      "Número NFS-e",
      "Situação",
      "Data Emissão",
      "Competência",
      "CNPJ Cliente",
      "Cliente",
      "Valor Bruto",
      "ISS",
      "ISS Retido",
      "PIS",
      "COFINS",
      "CSLL",
      "IRRF",
      "INSS",
      "Valor Líquido",
      "Serviço",
      "Categoria",
    ];
    rows.push(headersEmitidasDet.map(makeStringCell));

    emitidasEmp.forEach((n) => {
      const isRet = n.issRetido === "Sim";
      const cat = getNotaCategory(n.codTribNacional, n.servico);
      rows.push([
        makeStringCell(n.nNFSe),
        makeStringCell(n.status === "válida" ? "Válida" : "Cancelada"),
        makeStringCell(formatarData(n.dhEmi)),
        makeStringCell(formatarCompetencia(n.dCompet)),
        makeStringCell(formatarCnpjCpf(n.cnpjCpfCliente)),
        makeStringCell(n.cliente),
        makeCurrencyCell(n.valor),
        makeCurrencyCell(n.vlrIss ?? 0),
        makeCurrencyCell(isRet ? (n.vlrIssRet ?? n.vlrIss ?? 0) : 0),
        makeCurrencyCell(n.vlrPis ?? 0),
        makeCurrencyCell(n.vlrCofins ?? 0),
        makeCurrencyCell(n.vlrCsll ?? 0),
        makeCurrencyCell(n.vlrIrrf ?? 0),
        makeCurrencyCell(n.vlrInss ?? 0),
        makeCurrencyCell(n.vlrLiquido ?? n.valor),
        makeStringCell(n.servico),
        makeStringCell(cat),
      ]);
    });

    rows.push([]);

    // SECTION D: NOTAS TOMADAS DETALHADAS
    rows.push([makeStringCell(">>> LISTA DE NOTAS FISCAIS TOMADAS")]);
    const headersTomadasDet = [
      "Número NFS-e",
      "Situação",
      "Data Emissão",
      "Competência",
      "CNPJ Prestador",
      "Fornecedor",
      "Valor Bruto",
      "ISS",
      "ISS Retido",
      "PIS",
      "COFINS",
      "CSLL",
      "IRRF",
      "INSS",
      "Valor Líquido",
      "Serviço",
      "Categoria",
    ];
    rows.push(headersTomadasDet.map(makeStringCell));

    tomadasEmp.forEach((n) => {
      const isRet = n.issRetido === "Sim";
      const cat = getNotaCategory(n.codTribNacional, n.servico);
      rows.push([
        makeStringCell(n.nNFSe),
        makeStringCell(n.status === "válida" ? "Válida" : "Cancelada"),
        makeStringCell(formatarData(n.dhEmi)),
        makeStringCell(formatarCompetencia(n.dCompet)),
        makeStringCell(formatarCnpjCpf(n.cnpjPrestador)),
        makeStringCell(n.nomePrestador),
        makeCurrencyCell(n.valor),
        makeCurrencyCell(n.vlrIss ?? 0),
        makeCurrencyCell(isRet ? (n.vlrIssRet ?? 0) : 0),
        makeCurrencyCell(n.vlrPis ?? 0),
        makeCurrencyCell(n.vlrCofins ?? 0),
        makeCurrencyCell(n.vlrCsll ?? 0),
        makeCurrencyCell(n.vlrIrrf ?? 0),
        makeCurrencyCell(n.vlrInss ?? 0),
        makeCurrencyCell(n.vlrLiquido ?? n.valor),
        makeStringCell(n.servico),
        makeStringCell(cat),
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const filename = `relatorio_consolidado_grupo_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
