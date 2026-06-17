import type { FiscalDocument } from "@/lib/db";

/* ─── Formatters ────────────────────────────────────────────────── */
const fmtDate = (iso: string | undefined) => {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${m}/${y}`;
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCnpj = (v: string) => {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14)
    return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (c.length === 11)
    return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v || "—";
};

/* ─── Types ─────────────────────────────────────────────────────── */
export interface ExportContext {
  docs: FiscalDocument[];
  cnpjGrupoSet: Set<string>;
  filters: {
    periodo: string;
    empresa: string;
    status: string;
    operacao: string;
  };
}

/* ─── CSV Export ────────────────────────────────────────────────── */
export function exportToCsv(ctx: ExportContext): void {
  const { docs, cnpjGrupoSet } = ctx;

  const HEADERS = [
    "Competência",
    "Nº Nota",
    "Prestador",
    "CNPJ Prestador",
    "Tomador",
    "CNPJ Tomador",
    "Valor Bruto (R$)",
    "Valor Líquido (R$)",
    "Valor Retido (R$)",
    "Status",
    "Operação",
  ];

  const escape = (v: string | number) => {
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = docs.map((d) => {
    const isIC =
      cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador);
    return [
      fmtDate(d.data_competencia),
      d.numero_nota || d.chave_nfse || d.id,
      d.nome_prestador || "",
      fmtCnpj(d.cnpj_prestador),
      d.nome_tomador || "",
      fmtCnpj(d.cnpj_tomador),
      fmtBRL(d.valor_bruto),
      fmtBRL(d.valor_liquido),
      fmtBRL(d.valor_retido),
      d.status_manual || "Ativo",
      isIC ? "Intercompany" : "Externa",
    ]
      .map(escape)
      .join(",");
  });

  // BOM + header + rows
  const bom = "\uFEFF";
  const csv = bom + [HEADERS.map(escape).join(","), ...rows].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fiscal-cockpit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
