import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Filter, ChevronDown, ChevronUp, RotateCcw, Tag, Calendar, Shield } from "lucide-react";
import { db } from "@/lib/db";
import { useFiscalStore } from "@/store/useFiscalStore";
import { Button } from "@/components/ui/button";
import { CATEGORIAS_SINTETICAS } from "@/lib/classification/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MESES = [
  { v: "01", l: "Janeiro" }, { v: "02", l: "Fevereiro" }, { v: "03", l: "Março" },
  { v: "04", l: "Abril" }, { v: "05", l: "Maio" }, { v: "06", l: "Junho" },
  { v: "07", l: "Julho" }, { v: "08", l: "Agosto" }, { v: "09", l: "Setembro" },
  { v: "10", l: "Outubro" }, { v: "11", l: "Novembro" }, { v: "12", l: "Dezembro" },
];

export function GlobalFilters() {
  const {
    mesFiltro, setMesFiltro,
    anoFiltro, setAnoFiltro,
    emissaoMesFiltro, setEmissaoMesFiltro,
    emissaoAnoFiltro, setEmissaoAnoFiltro,
    empresaFiltro, setEmpresaFiltro,
    statusFiltro, setStatusFiltro,
    operacaoFiltro, setOperacaoFiltro,
    clienteFiltro, setClienteFiltro,
    municipioFiltro, setMunicipioFiltro,
    codigoTributarioFiltro, setCodigoTributarioFiltro,
    tipoServicoFiltro, setTipoServicoFiltro,
    categoriaFiltro, setCategoriaFiltro,
    grupoFiltro, setGrupoFiltro,
    resetFilters,
  } = useFiscalStore();

  const [expanded, setExpanded] = useState(false);

  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const empresas = useLiveQuery(() => db.empresas.toArray(), []);

  // Compute unique values from docs for filter dropdowns
  const filterOptions = useMemo(() => {
    const years = new Set<string>();
    const emissionYears = new Set<string>();
    const clients = new Set<string>();
    const municipalities = new Set<string>();
    const groups = new Set<string>();
    const codes = new Set<string>();
    const serviceTypes = new Set<string>();

    (docs ?? []).forEach((d) => {
      if (d.data_competencia) {
        years.add(d.data_competencia.slice(0, 4));
      }
      if (d.data_emissao) {
        emissionYears.add(d.data_emissao.slice(0, 4));
      }
      const clientName = d.nome_tomador || d.cnpj_tomador;
      if (clientName) clients.add(clientName);
      if (d.municipio) municipalities.add(d.municipio);
      if (d.grupo) groups.add(d.grupo);
      
      const code = d.item_lista_servico || d.codigo_servico;
      if (code) codes.add(code);

      const sType = d.tipo_servico || d.grupo;
      if (sType) serviceTypes.add(sType);
    });

    return {
      years: Array.from(years).sort().reverse(),
      emissionYears: Array.from(emissionYears).sort().reverse(),
      clients: Array.from(clients).sort(),
      municipalities: Array.from(municipalities).sort(),
      groups: Array.from(groups).sort(),
      codes: Array.from(codes).sort(),
      serviceTypes: Array.from(serviceTypes).sort(),
    };
  }, [docs]);

  const hasActiveFilters =
    mesFiltro ||
    anoFiltro ||
    emissaoMesFiltro ||
    emissaoAnoFiltro ||
    empresaFiltro ||
    statusFiltro !== "todos" ||
    operacaoFiltro !== "Todas" ||
    clienteFiltro ||
    municipioFiltro ||
    codigoTributarioFiltro ||
    tipoServicoFiltro ||
    categoriaFiltro ||
    grupoFiltro;

  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-sm space-y-3 transition-all duration-200">
      {/* Prime filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-muted-foreground mr-1">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Filtros Globais</span>
        </div>

        {/* Ano Competência */}
        <Select value={anoFiltro || "__all__"} onValueChange={(v) => setAnoFiltro(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[120px] h-8 text-xs bg-background">
            <SelectValue placeholder="Ano Competência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Competência: Anos</SelectItem>
            {filterOptions.years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Mês Competência */}
        <Select value={mesFiltro || "__all__"} onValueChange={(v) => setMesFiltro(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
            <SelectValue placeholder="Mês Competência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Competência: Meses</SelectItem>
            {MESES.map((m) => (
              <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Empresa (Prestadora no grupo) */}
        <Select value={empresaFiltro || "__all__"} onValueChange={(v) => setEmpresaFiltro(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
            <SelectValue placeholder="Empresa Prestadora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as Empresas</SelectItem>
            {empresas?.map((g) => (
              <SelectItem key={g.cnpj} value={g.cnpj}>
                {g.razao_social || g.cnpj}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Cliente Tomador */}
        <Select value={clienteFiltro || "__all__"} onValueChange={(v) => setClienteFiltro(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
            <SelectValue placeholder="Cliente (Tomador)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os Clientes</SelectItem>
            {filterOptions.clients.map((c) => (
              <SelectItem key={c} value={c}>
                {c.length > 25 ? c.slice(0, 25) + "..." : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-8 text-xs gap-1 hover:bg-muted"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Menos filtros" : "Mais filtros"}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-8 text-xs gap-1 border-dashed hover:bg-muted"
            >
              <RotateCcw className="h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Advanced filters (collapsible) */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-3 border-t border-border/80 animate-in slide-in-from-top-2 duration-200">
          
          {/* Período de Emissão: Ano */}
          <div className="space-y-1">
            <label className="text-[9px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Ano de Emissão
            </label>
            <Select value={emissaoAnoFiltro || "__all__"} onValueChange={(v) => setEmissaoAnoFiltro(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue placeholder="Ano Emissão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os Anos</SelectItem>
                {filterOptions.emissionYears.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Período de Emissão: Mês */}
          <div className="space-y-1">
            <label className="text-[9px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Mês de Emissão
            </label>
            <Select value={emissaoMesFiltro || "__all__"} onValueChange={(v) => setEmissaoMesFiltro(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue placeholder="Mês Emissão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os Meses</SelectItem>
                {MESES.map((m) => (
                  <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Município */}
          <div className="space-y-1">
            <label className="text-[9px] font-semibold text-muted-foreground uppercase">Município</label>
            <Select value={municipioFiltro || "__all__"} onValueChange={(v) => setMunicipioFiltro(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue placeholder="Município" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os Municípios</SelectItem>
                {filterOptions.municipalities.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Serviço */}
          <div className="space-y-1">
            <label className="text-[9px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Shield className="h-3 w-3 text-emerald-500" />
              Tipo de Serviço
            </label>
            <Select value={tipoServicoFiltro || "__all__"} onValueChange={(v) => setTipoServicoFiltro(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue placeholder="Tipo de Serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os Tipos</SelectItem>
                {filterOptions.serviceTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria Sintética */}
          <div className="space-y-1">
            <label className="text-[9px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Tag className="h-3 w-3 text-purple-500" />
              Categoria Sintética
            </label>
            <Select value={categoriaFiltro || "__all__"} onValueChange={(v) => setCategoriaFiltro(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue placeholder="Categoria Sintética" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as Categorias</SelectItem>
                {CATEGORIAS_SINTETICAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Código Tributário */}
          <div className="space-y-1">
            <label className="text-[9px] font-semibold text-muted-foreground uppercase">Código Tributário</label>
            <Select value={codigoTributarioFiltro || "__all__"} onValueChange={(v) => setCodigoTributarioFiltro(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue placeholder="Código Tributário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os Códigos</SelectItem>
                {filterOptions.codes.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Situação da NFS-e */}
          <div className="space-y-1">
            <label className="text-[9px] font-semibold text-muted-foreground uppercase">Situação da NFS-e</label>
            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as any)}>
              <SelectTrigger className="w-full h-8 text-xs bg-background">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Situações</SelectItem>
                <SelectItem value="Ativo">Ativas</SelectItem>
                <SelectItem value="Cancelado">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
