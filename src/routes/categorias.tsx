import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import { db, type CustomCategory, type CategoryOverride } from "@/lib/db";
import {
  categorizarServico,
  lc116CategoriasMap,
  getServicoDescricao,
  obterCategoriaPorCodigo,
  obterCategoriaMaisProxima,
} from "@/lib/category-utils";
import { useLayoutShell } from "@/components/layout/LayoutShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, XCircle, Trash2, Filter, Sparkles } from "lucide-react";
import { toast } from "sonner";

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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.id });
  const { addActivity } = useLayoutShell();

  // Load custom categories from IndexedDB
  const customCategoriesObj = useLiveQuery(() => db.customCategories.toArray(), [], [] as CustomCategory[]);
  const customCategories = useMemo(() => {
    return (customCategoriesObj || []).map((c) => c.nome);
  }, [customCategoriesObj]);

  // Load category overrides from IndexedDB
  const categoryOverridesObj = useLiveQuery(() => db.categoryOverrides.toArray(), [], [] as CategoryOverride[]);
  const categoryOverrides = useMemo(() => {
    const map: Record<string, string> = {};
    (categoryOverridesObj || []).forEach((o) => {
      map[o.codigo] = o.categoria;
    });
    return map;
  }, [categoryOverridesObj]);

  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [showCriarForm, setShowCriarForm] = useState(false);
  const [searchCat, setSearchCat] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  // Database notes queries
  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], []);
  const todasNotasTomadas = useLiveQuery(() => db.notasTomadas.toArray(), [], []);

  // Combined categories list (Official 40 + Custom categories)
  const todasCategorias = useMemo(() => {
    return [...Object.values(lc116CategoriasMap), ...customCategories].sort();
  }, [customCategories]);

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
        let catAuto = categorizarServico(desc, code, todasCategorias, categoryOverrides);
        if (catAuto === "Serviços Diversos") {
          const catOfficial = categorizarServico(officialDesc, code, todasCategorias, categoryOverrides);
          if (catOfficial !== "Serviços Diversos") {
            catAuto = catOfficial;
          } else {
            const closest = obterCategoriaMaisProxima(officialDesc, todasCategorias);
            if (closest && closest !== "Serviços Diversos") {
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
  }, [todasNotas, todasNotasTomadas, todasCategorias, categoryOverrides]);

  // Filtered rows for code mappings table
  const linhasFiltradas = useMemo(() => {
    return uniqueCodes.filter(
      (l) =>
        !searchCat ||
        l.codigo.toLowerCase().includes(searchCat.toLowerCase()) ||
        l.descricao.toLowerCase().includes(searchCat.toLowerCase()) ||
        l.catAuto.toLowerCase().includes(searchCat.toLowerCase()) ||
        (categoryOverrides[l.codigo] || "").toLowerCase().includes(searchCat.toLowerCase())
    );
  }, [uniqueCodes, searchCat, categoryOverrides]);

  const saveCategoryOverride = async (code: string, categoria: string) => {
    await db.categoryOverrides.put({ codigo: code, categoria });
    addActivity("update", "Override de Categoria", `Código "${code}" mapeado para "${categoria}".`);
    toast.success(`Categoria do código "${code}" alterada para "${categoria}".`);
  };

  const removeCategoryOverride = async (code: string) => {
    await db.categoryOverrides.delete(code);
    addActivity("update", "Override Removido", `Restaurada categoria padrão do código "${code}".`);
    toast.success(`Override do código "${code}" removido.`);
  };

  const addCustomCategory = async (nome: string) => {
    const cleanNome = nome.trim();
    if (!cleanNome) return false;
    if (customCategories.length >= 100) {
      toast.error("Limite de 100 categorias personalizadas atingido!");
      return false;
    }
    const exists = [...Object.values(lc116CategoriasMap), ...customCategories]
      .some(cat => cat.toLowerCase() === cleanNome.toLowerCase() || cleanNome.toLowerCase() === "serviços diversos");
    if (exists) {
      toast.error("Esta categoria já existe!");
      return false;
    }

    await db.customCategories.put({ id: cleanNome, nome: cleanNome });
    addActivity("update", "Nova Categoria", `Categoria customizada "${cleanNome}" criada.`);
    toast.success(`Categoria "${cleanNome}" criada com sucesso!`);
    return true;
  };

  const removeCustomCategory = async (nome: string) => {
    await db.customCategories.delete(nome);

    // Cleanup overrides pointing to this category in Dexie
    const overrides = await db.categoryOverrides.toArray();
    const toDelete = overrides.filter((o) => o.categoria === nome).map((o) => o.codigo);
    if (toDelete.length > 0) {
      await Promise.all(toDelete.map((code) => db.categoryOverrides.delete(code)));
    }

    addActivity("update", "Categoria Removida", `Categoria customizada "${nome}" excluída.`);
    toast.success(`Categoria "${nome}" removida.`);
  };

  const autoCategorizeSelected = async (codes: string[]) => {
    let successCount = 0;
    const batch = [];

    for (const code of codes) {
      const desc = getServicoDescricao(code);
      let matched = obterCategoriaPorCodigo(code);
      if (!matched) {
        const closest = obterCategoriaMaisProxima(desc, todasCategorias);
        if (closest && closest !== "Serviços Diversos") {
          matched = closest;
        }
      }

      if (matched) {
        batch.push({ codigo: code, categoria: matched });
        successCount++;
      }
    }

    if (batch.length > 0) {
      await db.categoryOverrides.bulkPut(batch);
      addActivity("update", "Auto-Categorização Lote", `${successCount} códigos classificados em lote.`);
      toast.success(`${successCount} código(s) categorizado(s) automaticamente com base na descrição.`);
    } else {
      toast.info("Não foi possível inferir uma categoria mais específica para os códigos selecionados.");
    }
    setSelectedCodes(new Set());
  };

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
      {/* Header controls section */}
      <div className="bg-card p-5 rounded-2xl border border-border shadow-xs transition-colors duration-300">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Categorias de Serviço</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Relação dos códigos de serviço encontrados nas NFS-e e seus respectivos mapeamentos. Edite para corrigir a classificação.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.keys(categoryOverrides).length > 0 && (
                <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-lg font-semibold">
                  {Object.keys(categoryOverrides).length} override(s) manual(is)
                </span>
              )}
              {selectedCodes.size > 0 && (
                <Button
                  onClick={() => autoCategorizeSelected(Array.from(selectedCodes))}
                  size="sm"
                  className="h-8 rounded-xl text-xs gap-1.5 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  ⚡ Auto-Categorizar ({selectedCodes.size})
                </Button>
              )}
              <Button
                onClick={() => setShowCriarForm(!showCriarForm)}
                size="sm"
                variant="outline"
                className="h-8 rounded-xl text-xs gap-1.5 cursor-pointer border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-500/5"
              >
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">+ Nova Categoria</span>
              </Button>
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

          {showCriarForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addCustomCategory(novaCategoriaNome).then((success) => {
                  if (success) {
                    setNovaCategoriaNome("");
                    setShowCriarForm(false);
                  }
                });
              }}
              className="flex flex-col gap-2 pt-3 border-t border-border/60 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 max-w-sm">
                  <Input
                    type="text"
                    placeholder="Nome da categoria (ex: Consultoria Especializada)"
                    value={novaCategoriaNome}
                    onChange={(e) => setNovaCategoriaNome(e.target.value)}
                    className="h-8 text-xs rounded-xl"
                    autoFocus
                  />
                </div>
                <Button type="submit" size="sm" className="h-8 rounded-xl text-xs cursor-pointer">
                  Criar Categoria
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCriarForm(false);
                    setNovaCategoriaNome("");
                  }}
                  className="h-8 rounded-xl text-xs cursor-pointer text-muted-foreground"
                >
                  Cancelar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Crie categorias personalizadas além dos 40 itens padrão da LC 116 (Limite máximo de 100 categorias personalizadas).
              </p>
            </form>
          )}

          {customCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1 pt-3 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground self-center mr-1">Categorias criadas ({customCategories.length}/100):</span>
              {customCategories.map((cat) => (
                <Badge
                  key={cat}
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 rounded-md gap-1 bg-indigo-500/[0.02] border-indigo-500/10 text-indigo-700 dark:text-indigo-300 flex items-center"
                >
                  {cat}
                  <button
                    type="button"
                    onClick={() => removeCustomCategory(cat)}
                    className="hover:text-rose-500 cursor-pointer font-bold focus:outline-none ml-1 text-xs"
                    title="Excluir esta categoria"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Section */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Códigos únicos", value: uniqueCodes.length },
          { label: "Com override manual", value: Object.keys(categoryOverrides).length },
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
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-10">
                    <input
                      type="checkbox"
                      checked={linhasFiltradas.length > 0 && linhasFiltradas.every(l => selectedCodes.has(l.codigo))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCodes(new Set([...selectedCodes, ...linhasFiltradas.map(l => l.codigo)]));
                        } else {
                          const next = new Set(selectedCodes);
                          linhasFiltradas.forEach(l => next.delete(l.codigo));
                          setSelectedCodes(next);
                        }
                      }}
                      className="rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Descrição Oficial do Serviço</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Categoria Automática</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Categoria Efetiva</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Qtd. NFS-e</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {linhasFiltradas.map((linha) => {
                  const hasOverride = !!categoryOverrides[linha.codigo];
                  const catEfetiva = categoryOverrides[linha.codigo] || linha.catAuto;
                  return (
                    <tr
                      key={linha.codigo}
                      className={`hover:bg-muted/30 transition-colors ${
                        hasOverride ? "bg-indigo-500/[0.02] dark:bg-indigo-500/[0.04]" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-10 text-left">
                        <input
                          type="checkbox"
                          checked={selectedCodes.has(linha.codigo)}
                          onChange={(e) => {
                            const next = new Set(selectedCodes);
                            if (e.target.checked) {
                              next.add(linha.codigo);
                            } else {
                              next.delete(linha.codigo);
                            }
                            setSelectedCodes(next);
                          }}
                          className="rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] bg-muted border border-border px-1.5 py-0.5 rounded-md font-semibold text-foreground/90">
                          {linha.codigo}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[320px] truncate" title={linha.descricao}>
                        <span className="truncate block text-foreground/85 font-medium">{linha.descricao}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground font-medium">{linha.catAuto}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={catEfetiva}
                          onChange={(e) => saveCategoryOverride(linha.codigo, e.target.value)}
                          className={`h-7 px-2 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-indigo-500/30 bg-card cursor-pointer font-medium ${
                            hasOverride
                              ? "border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 font-semibold"
                              : "border-border text-foreground/90"
                          }`}
                        >
                          {todasCategorias.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="Serviços Diversos">Serviços Diversos</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground font-semibold">
                        {linha.count.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasOverride && (
                          <button
                            onClick={() => removeCategoryOverride(linha.codigo)}
                            title="Restaurar categoria automática"
                            className="text-[10px] text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 underline underline-offset-2 transition-colors cursor-pointer"
                          >
                            Restaurar
                          </button>
                        )}
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
        🔒 Processamento 100% Client-Side local — Suas categorias e overrides manuais ficam salvos apenas em seu navegador.
      </footer>
    </main>
  );
}
