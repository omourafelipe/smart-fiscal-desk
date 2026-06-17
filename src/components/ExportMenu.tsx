import { useState, useCallback } from "react";
import {
  Download, FileSpreadsheet, FileText, FileDown,
  Loader2, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ExportContext } from "@/lib/export/exportCsv";

import type { FiscalDocument } from "@/lib/db";

interface ExportMenuProps {
  docs: FiscalDocument[];
  cnpjGrupoSet: Set<string>;
  filterLabels: {
    periodo: string;
    empresa: string;
    status: string;
    operacao: string;
  };
  kpis: {
    bruto: number;
    liquido: number;
    retido: number;
    intercompany: number;
    qtd: number;
    ticketMedio: number;
  };
}

type ExportType = "csv" | "excel" | "pdf" | null;

export function ExportMenu({
  docs,
  cnpjGrupoSet,
  filterLabels,
  kpis,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportType>(null);

  const ctx: ExportContext = {
    docs,
    cnpjGrupoSet,
    filters: filterLabels,
  };

  const run = useCallback(
    async (type: ExportType) => {
      if (!type) return;
      setLoading(type);
      setOpen(false);
      try {
        if (type === "csv") {
          const { exportToCsv } = await import("@/lib/export/exportCsv");
          exportToCsv(ctx);
          toast.success(`CSV exportado — ${docs.length} notas`);
        } else if (type === "excel") {
          const { exportToExcel } = await import("@/lib/export/exportExcel");
          exportToExcel(ctx, kpis);
          toast.success(`Excel exportado — ${docs.length} notas`);
        } else if (type === "pdf") {
          const { exportToPdf } = await import("@/lib/export/exportPdf");
          await exportToPdf(ctx, kpis);
          toast.success("PDF executivo gerado com sucesso");
        }
      } catch (e: any) {
        toast.error(`Erro ao exportar: ${e?.message ?? "desconhecido"}`);
      } finally {
        setLoading(null);
      }
    },
    [docs, cnpjGrupoSet, filterLabels, kpis]
  );

  const options = [
    {
      id: "csv" as ExportType,
      label: "Exportar CSV",
      sub: "Compatível com Excel, separado por vírgula",
      Icon: FileDown,
      color: "#16a34a",
    },
    {
      id: "excel" as ExportType,
      label: "Exportar Excel (.xlsx)",
      sub: "2 abas: Notas completa + KPIs",
      Icon: FileSpreadsheet,
      color: "#2563EB",
    },
    {
      id: "pdf" as ExportType,
      label: "Exportar PDF Executivo",
      sub: "Filtros + KPIs + tabela de notas",
      Icon: FileText,
      color: "#dc2626",
    },
  ];

  return (
    <div className="export-menu-wrapper">
      <Button
        id="export-menu-btn"
        variant="outline"
        className="gap-2 h-9 font-medium"
        onClick={() => setOpen((v) => !v)}
        disabled={loading !== null || docs.length === 0}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Exportar
        <ChevronDown
          className="h-3.5 w-3.5 opacity-50 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="export-menu-dropdown">
            <div className="export-menu-header">
              <Download className="h-3.5 w-3.5" />
              Exportar {docs.length.toLocaleString("pt-BR")} notas
            </div>
            {options.map((opt) => (
              <button
                key={opt.id}
                id={`export-${opt.id}-btn`}
                className="export-menu-item"
                onClick={() => run(opt.id)}
                disabled={loading !== null}
              >
                <div
                  className="export-menu-icon"
                  style={{ background: `${opt.color}15`, color: opt.color }}
                >
                  {loading === opt.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <opt.Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="export-menu-text">
                  <span className="export-menu-label">{opt.label}</span>
                  <span className="export-menu-sub">{opt.sub}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
