import type { FiscalDocument } from "@/lib/db";
import type { ExportContext } from "./exportCsv";

/* ─── Types ─────────────────────────────────────────────────────── */
interface PdfKpis {
  bruto: number;
  liquido: number;
  retido: number;
  intercompany: number;
  qtd: number;
  ticketMedio: number;
}

/* ─── Formatters ────────────────────────────────────────────────── */
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

/* ─── PDF Export ────────────────────────────────────────────────── */
export async function exportToPdf(
  ctx: ExportContext,
  kpis: PdfKpis
): Promise<void> {
  // Dynamic import to avoid breaking build if not installed yet
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const { docs, cnpjGrupoSet, filters } = ctx;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  /* ── Color palette ── */
  const BLUE: [number, number, number] = [37, 99, 235];
  const SLATE: [number, number, number] = [15, 23, 42];
  const MUTED: [number, number, number] = [100, 116, 139];
  const LIGHT: [number, number, number] = [241, 245, 249];
  const WHITE: [number, number, number] = [255, 255, 255];
  const GREEN: [number, number, number] = [22, 163, 74];
  const AMBER: [number, number, number] = [245, 158, 11];
  const RED: [number, number, number] = [239, 68, 68];
  const PURPLE: [number, number, number] = [124, 58, 237];

  /* ─────────────────────────────────────────────────────────────────
     PAGE 1 — Header + Filters + KPIs
  ───────────────────────────────────────────────────────────────── */

  /* ── Header band ── */
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 22, "F");

  // Logo circle
  doc.setFillColor(255, 255, 255, 0.15);
  doc.circle(14, 11, 7, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("SFD", 14, 13, { align: "center" });

  // Title
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Smart Fiscal Desk — Cockpit Fiscal Executivo", 25, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    25,
    16
  );

  // Right side info
  doc.setFontSize(8);
  doc.text(`${docs.length} notas no recorte`, W - 10, 13, { align: "right" });

  /* ── Filters block ── */
  let y = 28;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(10, y, W - 20, 18, 3, 3, "F");

  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("FILTROS APLICADOS", 15, y + 5);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);

  const filterItems = [
    ["Período", filters.periodo],
    ["Empresa", filters.empresa],
    ["Status", filters.status],
    ["Operação", filters.operacao],
  ];

  let fx = 15;
  filterItems.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), fx, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);
    doc.setFontSize(8.5);
    doc.text(value || "Todos", fx, y + 15);
    fx += (W - 30) / 4;
  });

  /* ── KPI Cards ── */
  y = 52;
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("INDICADORES EXECUTIVOS", 10, y);
  y += 4;

  const kpiDefs = [
    {
      label: "Fat. Bruto",
      value: fmtBRL(kpis.bruto),
      color: BLUE,
    },
    {
      label: "Fat. Líquido",
      value: fmtBRL(kpis.liquido),
      color: [20, 184, 166] as [number, number, number],
    },
    {
      label: "Retenções",
      value: fmtBRL(kpis.retido),
      color: AMBER,
    },
    {
      label: "Intercompany",
      value: fmtBRL(kpis.intercompany),
      color: RED,
    },
    {
      label: "Qtd. Notas",
      value: kpis.qtd.toLocaleString("pt-BR"),
      color: PURPLE,
    },
    {
      label: "Ticket Médio",
      value: fmtBRL(kpis.ticketMedio),
      color: GREEN,
    },
  ];

  const cardW = (W - 20) / 6 - 2;
  kpiDefs.forEach((kpi, i) => {
    const cx = 10 + i * (cardW + 2);
    doc.setFillColor(...WHITE);
    doc.roundedRect(cx, y, cardW, 24, 2, 2, "F");
    doc.setDrawColor(230, 235, 245);
    doc.roundedRect(cx, y, cardW, 24, 2, 2, "S");

    // Accent top bar
    doc.setFillColor(...kpi.color);
    doc.rect(cx, y, cardW, 2, "F");

    doc.setTextColor(...MUTED);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.label.toUpperCase(), cx + cardW / 2, y + 7, {
      align: "center",
    });

    doc.setTextColor(...SLATE);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, cx + cardW / 2, y + 17, { align: "center" });
  });

  // Derived indicators
  y += 30;
  const retencaoPct = kpis.bruto > 0 ? ((kpis.retido / kpis.bruto) * 100).toFixed(2) : "0.00";
  const icPct = kpis.bruto > 0 ? ((kpis.intercompany / kpis.bruto) * 100).toFixed(2) : "0.00";
  const extPct = kpis.bruto > 0 ? (100 - Number(icPct)).toFixed(2) : "100.00";

  doc.setFillColor(...LIGHT);
  doc.roundedRect(10, y, W - 20, 10, 2, 2, "F");
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Retenção Média: ${retencaoPct}%   ·   Intercompany: ${icPct}%   ·   Externo: ${extPct}%   ·   Notas no recorte: ${docs.length.toLocaleString("pt-BR")}`,
    W / 2,
    y + 6.5,
    { align: "center" }
  );

  /* ─────────────────────────────────────────────────────────────────
     PAGE 2 — Notes Table
  ───────────────────────────────────────────────────────────────── */
  doc.addPage();

  // Page header
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 12, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Detalhamento das Notas Fiscais de Serviço", W / 2, 8, {
    align: "center",
  });

  const tableRows = docs.slice(0, 2000).map((d) => {
    const isIC =
      cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador);
    return [
      fmtDate(d.data_competencia),
      d.id_nota,
      (d.nome_prestador || fmtCnpj(d.cnpj_prestador)).slice(0, 28),
      (d.nome_tomador || fmtCnpj(d.cnpj_tomador)).slice(0, 28),
      fmtBRL(d.valor_bruto),
      fmtBRL(d.valor_retido),
      fmtBRL(d.valor_liquido),
      d.status_manual || "Ativo",
      isIC ? "IC" : "Ext",
    ];
  });

  autoTable(doc, {
    startY: 16,
    head: [["Competência", "Nº Nota", "Prestador", "Tomador", "Bruto", "Retido", "Líquido", "Status", "Op."]],
    body: tableRows,
    styles: {
      fontSize: 6.5,
      cellPadding: 1.5,
      textColor: [...SLATE] as [number, number, number],
    },
    headStyles: {
      fillColor: [...BLUE] as [number, number, number],
      textColor: [...WHITE] as [number, number, number],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [...LIGHT] as [number, number, number],
    },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 20 },
      2: { cellWidth: 48 },
      3: { cellWidth: 48 },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 25, halign: "right" },
      6: { cellWidth: 28, halign: "right" },
      7: { cellWidth: 16, halign: "center" },
      8: { cellWidth: 12, halign: "center" },
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageNum = data.pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(
        `Smart Fiscal Desk  ·  Página ${pageNum} de ${pageCount}  ·  ${new Date().toLocaleDateString("pt-BR")}`,
        W / 2,
        doc.internal.pageSize.getHeight() - 5,
        { align: "center" }
      );
    },
  });

  /* ── Download ── */
  doc.save(`fiscal-cockpit-${new Date().toISOString().slice(0, 10)}.pdf`);
}
