import * as XLSX from "xlsx";
import type { FiscalDocument } from "@/lib/db";
import type { ExportContext } from "./exportCsv";

/* ─── Formatters ────────────────────────────────────────────────── */
const fmtDate = (iso: string | undefined) => {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${m}/${y}`;
};

const fmtCnpj = (v: string) => {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14)
    return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v || "—";
};

/* ─── Helpers ───────────────────────────────────────────────────── */
function autoFitColumns(ws: XLSX.WorkSheet, data: (string | number)[][]) {
  const colWidths = data[0].map((_, ci) =>
    Math.min(
      40,
      Math.max(
        10,
        ...data.map((row) => String(row[ci] ?? "").length)
      )
    )
  );
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
}

function styleHeader(ws: XLSX.WorkSheet, range: XLSX.Range) {
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "2563EB" } },
      alignment: { horizontal: "center" },
    };
  }
}

/* ─── Excel Export ──────────────────────────────────────────────── */
export function exportToExcel(
  ctx: ExportContext,
  kpis: {
    bruto: number;
    liquido: number;
    retido: number;
    intercompany: number;
    qtd: number;
    ticketMedio: number;
  }
): void {
  const { docs, cnpjGrupoSet, filters } = ctx;

  /* ── Sheet 1: Notas ── */
  const notasHeaders = [
    "Competência",
    "Nº Nota",
    "Prestador",
    "CNPJ Prestador",
    "Tomador",
    "CNPJ Tomador",
    "Valor Bruto",
    "Valor Líquido",
    "Valor Retido",
    "Status",
    "Operação",
  ];

  const notasRows = docs.map((d) => {
    const isIC =
      cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador);
    return [
      fmtDate(d.data_competencia),
      d.numero_nota || d.chave_nfse || d.id,
      d.nome_prestador || "",
      fmtCnpj(d.cnpj_prestador),
      d.nome_tomador || "",
      fmtCnpj(d.cnpj_tomador),
      d.valor_bruto,
      d.valor_liquido,
      d.valor_retido,
      d.status_manual || "Ativo",
      isIC ? "Intercompany" : "Externa",
    ];
  });

  const notasData = [notasHeaders, ...notasRows];
  const wsNotas = XLSX.utils.aoa_to_sheet(notasData);
  autoFitColumns(wsNotas, notasData as (string | number)[][]);

  // Format currency columns (G, H, I = indices 6,7,8)
  for (let R = 1; R < notasData.length; R++) {
    for (const C of [6, 7, 8]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (wsNotas[addr]) {
        wsNotas[addr].t = "n";
        wsNotas[addr].z = '"R$"#,##0.00';
      }
    }
  }

  const notasRange = XLSX.utils.decode_range(wsNotas["!ref"] || "A1");
  styleHeader(wsNotas, notasRange);

  /* ── Sheet 2: KPIs ── */
  const fmtBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const kpisData = [
    ["Smart Fiscal Desk — Resumo Executivo", ""],
    ["", ""],
    ["Filtros Aplicados", ""],
    ["Período", filters.periodo],
    ["Empresa", filters.empresa],
    ["Status", filters.status],
    ["Operação", filters.operacao],
    ["Data Exportação", new Date().toLocaleString("pt-BR")],
    ["", ""],
    ["Indicador", "Valor"],
    ["Faturamento Bruto", fmtBRL(kpis.bruto)],
    ["Faturamento Líquido", fmtBRL(kpis.liquido)],
    ["Retenções", fmtBRL(kpis.retido)],
    ["Intercompany", fmtBRL(kpis.intercompany)],
    ["Qtd. de Notas", kpis.qtd],
    ["Ticket Médio", fmtBRL(kpis.ticketMedio)],
    ["Retenção Média %", `${kpis.bruto > 0 ? ((kpis.retido / kpis.bruto) * 100).toFixed(2) : "0.00"}%`],
    ["Intercompany %", `${kpis.bruto > 0 ? ((kpis.intercompany / kpis.bruto) * 100).toFixed(2) : "0.00"}%`],
  ];

  const wsKpis = XLSX.utils.aoa_to_sheet(kpisData);
  wsKpis["!cols"] = [{ wch: 30 }, { wch: 24 }];

  /* ── Workbook ── */
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsNotas, "Notas");
  XLSX.utils.book_append_sheet(wb, wsKpis, "KPIs");

  XLSX.writeFile(
    wb,
    `fiscal-cockpit-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
