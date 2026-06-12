import React, { useMemo } from "react";
import { Building2, Calendar, Tag, FilterX } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useGlobalFilters } from "@/store/useGlobalFilters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const mesesOpcoes = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export function GlobalFilterBar() {
  const {
    empresaFiltro,
    mesFiltro,
    anoFiltro,
    cServFiltro,
    setEmpresaFiltro,
    setMesFiltro,
    setAnoFiltro,
    setCServFiltro,
    resetFilters
  } = useGlobalFilters();

  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], []);

  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    todasNotas?.forEach((n) => {
      if (!map.has(n.cnpjPrestador)) map.set(n.cnpjPrestador, n.nomePrestador || n.cnpjPrestador);
    });
    return Array.from(map.entries()).map(([cnpj, nome]) => ({ cnpj, nome }));
  }, [todasNotas]);

  const anos = useMemo(() => {
    const set = new Set<string>();
    todasNotas?.forEach((n) => {
      const dateStr = (n.dCompet || n.dhEmi || "").split("T")[0];
      if (dateStr) {
        const y = dateStr.slice(0, 4);
        if (y.length === 4) set.add(y);
      }
    });
    return Array.from(set).sort().reverse();
  }, [todasNotas]);

  const hasActiveFilters = empresaFiltro !== "__all__" || mesFiltro !== "__all__" || anoFiltro !== "__all__" || cServFiltro !== "__all__";

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 flex-wrap bg-card border border-border p-3 rounded-xl shadow-xs transition-colors duration-300">
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
          <SelectTrigger className="w-full sm:w-[220px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors">
            <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
            <SelectItem value="__all__">Todas as Empresas</SelectItem>
            {empresas.map((e) => (
              <SelectItem key={e.cnpj} value={e.cnpj}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mesFiltro} onValueChange={setMesFiltro}>
          <SelectTrigger className="w-[120px] sm:w-[130px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors">
            <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground max-h-60">
            <SelectItem value="__all__">Todos os meses</SelectItem>
            {mesesOpcoes.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={anoFiltro} onValueChange={setAnoFiltro}>
          <SelectTrigger className="w-[100px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors">
            <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
            <SelectItem value="__all__">Todos os anos</SelectItem>
            {anos.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cServFiltro} onValueChange={setCServFiltro}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors">
            <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
            <SelectValue placeholder="Serviço" />
          </SelectTrigger>
          <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
            <SelectItem value="__all__">Todos os Serviços</SelectItem>
            <SelectItem value="042201">Planos de Saúde</SelectItem>
            <SelectItem value="040301">Serviços Hospitalares</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={resetFilters}
          className="h-9 text-xs text-muted-foreground hover:text-foreground"
        >
          <FilterX className="h-3.5 w-3.5 mr-1.5" />
          Limpar Filtros
        </Button>
      )}
    </div>
  );
}
