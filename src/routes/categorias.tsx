import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  categorizarServico,
  lc116SubItemCategoriasMap,
  getServicoDescricao,
  obterCategoriaMaisProxima,
} from "@/lib/category-utils";
import { Search } from "lucide-react";

const searchSchema = z.object({
  mes: z.string().optional().catch("__all__"),
  ano: z.string().optional().catch("__all__"),
  empresa: z.string().optional().catch("__all__"),
  cServ: z.string().optional().catch("__all__"),
  searchCliente: z.string().optional().catch(""),
});

export const Route = createFileRoute("/categorias")({
  validateSearch: searchSchema,
  component: CategoriasRouteComponent,
});

function CategoriasRouteComponent() {
  const [searchCat, setSearchCat] = useState("");

  // Database notes queries
  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], []);
  const todasNotasTomadas = useLiveQuery(() => db.notasTomadas.toArray(), [], []);

  // Combined categories list (Official 196)
  const todasCategorias = useMemo(() => {
    return Object.values(lc116SubItemCategoriasMap).sort();
  }, []);

  // Map service codes from all notes
  const uniqueCodes = useMemo(() => {
    const codigosMap = new Map<string, { codigo: string; descricao: string; catAuto: string; count: number }>();
    const todasCombinadas = [
      ...(todasNotas || []).map((n) => ({ code: n.codTribNacional, desc: n.servico })),
      ...(todasNotasTomadas || []).map((n) => ({ code: n.codTribNacional, desc: n.servico })),
    ];

    for (const { code, desc } of todasCombinadas) {
      if (!code) continue;
      if (!codigosMap.has(code)) {
        const officialDesc = getServicoDescricao(code);
        let catAuto = categorizarServico(desc, code, todasCategorias);
        if (catAuto === "") {
          const catOfficial = categorizarServico(officialDesc, code, todasCategorias);
          if (catOfficial !== "") {
            catAuto = catOfficial;
          } else {
            const closest = obterCategoriaMaisProxima(officialDesc, todasCategorias);
            if (closest && closest !== "") {
              catAuto = closest;
            }
          }
        }
        codigosMap.set(code, {
          codigo: code,
          descricao: officialDesc,
          catAuto,
          count: 1,
        });
      } else {
        codigosMap.get(code)!.count++;
      }
    }
    return [...codigosMap.values()].sort((a, b) => b.count - a.count);
  }, [todasNotas, todasNotasTomadas, todasCategorias]);

  // Filtered rows for code mappings table
  const linhasFiltradas = useMemo(() => {
    return uniqueCodes.filter(
      (l) =>
        !searchCat ||
        l.codigo.toLowerCase().includes(searchCat.toLowerCase()) ||
        l.descricao.toLowerCase().includes(searchCat.toLowerCase()) ||
        l.catAuto.toLowerCase().includes(searchCat.toLowerCase())
    );
  }, [uniqueCodes, searchCat]);

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
      {/* Header controls section */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-xs transition-colors duration-300">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Categorias de Serviço</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Relação dos códigos de serviço encontrados nas NFS-e e suas respectivas classificações automáticas.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filtrar..."
                  value={searchCat}
                  onChange={(e) => setSearchCat(e.target.value)}
                  className="pl-8 pr-3 h-8 text-xs rounded-xl border border-border bg-muted/40 outline-none focus:ring-2 focus:ring-indigo-500/30 w-48 text-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Códigos únicos", value: uniqueCodes.length },
          { label: "Categorias Totais", value: todasCategorias.length },
          { label: "Notas Analisadas", value: (todasNotas?.length ?? 0) + (todasNotasTomadas?.length ?? 0) },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <p className="text-2xl font-extrabold text-foreground mt-1">{k.value.toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </div>

      {/* Code Mappings Table */}
      {linhasFiltradas.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-xs">
          <p className="text-sm text-muted-foreground">
            {uniqueCodes.length === 0
              ? "Nenhuma NFS-e importada ainda. Importe arquivos XML para ver os códigos de serviço."
              : "Nenhum resultado correspondente para o filtro aplicado."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-24">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Descrição Oficial do Serviço</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Categoria Automática</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-32">Qtd. NFS-e</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {linhasFiltradas.map((linha) => {
                  return (
                    <tr
                      key={linha.codigo}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] bg-muted border border-border px-1.5 py-0.5 rounded-md font-semibold text-foreground/90">
                          {linha.codigo}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[320px] truncate" title={linha.descricao}>
                        <span className="truncate block text-foreground/85 font-medium">{linha.descricao}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold text-indigo-600 dark:text-indigo-400`}>
                          {linha.catAuto || "Sem categoria"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground font-semibold">
                        {linha.count.toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-[10px] text-muted-foreground">
            Exibindo {linhasFiltradas.length.toLocaleString("pt-BR")} código(s) de serviço de um total de {uniqueCodes.length.toLocaleString("pt-BR")} encontrados.
          </div>
        </div>
      )}

      <footer className="text-center text-[10px] text-muted-foreground pt-8 border-t border-border/80">
        🔒 Processamento 100% Client-Side local — Suas NFS-e e categorias ficam salvas apenas em seu navegador.
      </footer>
    </main>
  );
}
