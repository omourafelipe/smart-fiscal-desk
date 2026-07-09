import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";

export type DrillDownFilter =
  | { type: "all" }
  | { type: "competencia"; value: string }
  | { type: "prestador"; cnpj: string }
  | { type: "intercompany" }
  | { type: "externo" }
  | { type: "servico"; serviceKey: string; serviceLabel: string }
  | { type: "cliente"; value: string; cnpj?: string }
  | { type: "municipio"; value: string }
  | { type: "categoria_sintetica"; value: string }
  | { type: "tributo"; value: string };

export interface DrillDownConfig {
  title: string;
  filter: DrillDownFilter;
}

export interface SavedFilter {
  id: string;
  name: string;
  mesFiltro: string;
  anoFiltro: string;
  empresaFiltro: string;
  statusFiltro: "todos" | "Ativo" | "Cancelado";
  operacaoFiltro: "Todas" | "Externas" | "Intercompany";
  createdAt: number;
}

interface FiscalState {
  refreshTick: number;
  bumpRefresh: () => void;

  /* ── Filters ── */
  mesFiltro: string;
  anoFiltro: string;
  emissaoMesFiltro: string;
  emissaoAnoFiltro: string;
  empresaFiltro: string;
  statusFiltro: "todos" | "Ativo" | "Cancelado";
  operacaoFiltro: "Todas" | "Externas" | "Intercompany";
  clienteFiltro: string;
  municipioFiltro: string;
  ufFiltro: string;
  lc116Filtro: string;
  nbsFiltro: string;
  codigoTributarioFiltro: string;
  tipoServicoFiltro: string;
  retencaoFiltro: "Todos" | "Com Retenção" | "Sem Retenção";
  categoriaFiltro: string;
  grupoFiltro: string;
  valorMinFiltro: string;
  valorMaxFiltro: string;

  setMesFiltro: (m: string) => void;
  setAnoFiltro: (a: string) => void;
  setEmissaoMesFiltro: (m: string) => void;
  setEmissaoAnoFiltro: (a: string) => void;
  setEmpresaFiltro: (e: string) => void;
  setStatusFiltro: (s: "todos" | "Ativo" | "Cancelado") => void;
  setOperacaoFiltro: (o: "Todas" | "Externas" | "Intercompany") => void;
  setClienteFiltro: (c: string) => void;
  setMunicipioFiltro: (m: string) => void;
  setUfFiltro: (u: string) => void;
  setLc116Filtro: (l: string) => void;
  setNbsFiltro: (n: string) => void;
  setCodigoTributarioFiltro: (c: string) => void;
  setTipoServicoFiltro: (t: string) => void;
  setRetencaoFiltro: (r: "Todos" | "Com Retenção" | "Sem Retenção") => void;
  setCategoriaFiltro: (c: string) => void;
  setGrupoFiltro: (g: string) => void;
  setValorMinFiltro: (v: string) => void;
  setValorMaxFiltro: (v: string) => void;
  resetFilters: () => void;

  /* ── Saved Filters ── */
  savedFilters: SavedFilter[];
  saveCurrentFilter: (name: string) => void;
  removeSavedFilter: (id: string) => void;
  applySavedFilter: (id: string) => void;

  /* ── Drill-Down ── */
  drillDown: DrillDownConfig | null;
  openDrillDown: (config: DrillDownConfig) => void;
  closeDrillDown: () => void;

  /* ── Presentation Mode ── */
  presentationMode: boolean;
  setPresentationMode: (v: boolean) => void;
  togglePresentationMode: () => void;
}

const DEFAULT_FILTERS = {
  mesFiltro: "",
  anoFiltro: "",
  emissaoMesFiltro: "",
  emissaoAnoFiltro: "",
  empresaFiltro: "",
  statusFiltro: "Ativo" as const,
  operacaoFiltro: "Todas" as const,
  clienteFiltro: "",
  municipioFiltro: "",
  ufFiltro: "",
  lc116Filtro: "",
  nbsFiltro: "",
  codigoTributarioFiltro: "",
  tipoServicoFiltro: "",
  retencaoFiltro: "Todos" as const,
  categoriaFiltro: "",
  grupoFiltro: "",
  valorMinFiltro: "",
  valorMaxFiltro: "",
};

export const useFiscalStore = create<FiscalState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        refreshTick: 0,
        bumpRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),

        /* ── Filters ── */
        ...DEFAULT_FILTERS,
        setMesFiltro: (m) => set({ mesFiltro: m }),
        setAnoFiltro: (a) => set({ anoFiltro: a }),
        setEmissaoMesFiltro: (m) => set({ emissaoMesFiltro: m }),
        setEmissaoAnoFiltro: (a) => set({ emissaoAnoFiltro: a }),
        setEmpresaFiltro: (e) => set({ empresaFiltro: e }),
        setStatusFiltro: (s) => set({ statusFiltro: s }),
        setOperacaoFiltro: (o) => set({ operacaoFiltro: o }),
        setClienteFiltro: (c) => set({ clienteFiltro: c }),
        setMunicipioFiltro: (m) => set({ municipioFiltro: m }),
        setUfFiltro: (u) => set({ ufFiltro: u }),
        setLc116Filtro: (l) => set({ lc116Filtro: l }),
        setNbsFiltro: (n) => set({ nbsFiltro: n }),
        setCodigoTributarioFiltro: (c) => set({ codigoTributarioFiltro: c }),
        setTipoServicoFiltro: (t) => set({ tipoServicoFiltro: t }),
        setRetencaoFiltro: (r) => set({ retencaoFiltro: r }),
        setCategoriaFiltro: (c) => set({ categoriaFiltro: c }),
        setGrupoFiltro: (g) => set({ grupoFiltro: g }),
        setValorMinFiltro: (v) => set({ valorMinFiltro: v }),
        setValorMaxFiltro: (v) => set({ valorMaxFiltro: v }),
        resetFilters: () => set(DEFAULT_FILTERS),

        /* ── Saved Filters ── */
        savedFilters: [],
        saveCurrentFilter: (name: string) => {
          const s = get();
          const newFilter: SavedFilter = {
            id: `filter-${Date.now()}`,
            name,
            mesFiltro: s.mesFiltro,
            anoFiltro: s.anoFiltro,
            empresaFiltro: s.empresaFiltro,
            statusFiltro: s.statusFiltro,
            operacaoFiltro: s.operacaoFiltro,
            createdAt: Date.now(),
          };
          set((prev) => ({
            savedFilters: [...prev.savedFilters, newFilter].slice(-10),
          }));
        },
        removeSavedFilter: (id: string) =>
          set((prev) => ({
            savedFilters: prev.savedFilters.filter((f) => f.id !== id),
          })),
        applySavedFilter: (id: string) => {
          const filter = get().savedFilters.find((f) => f.id === id);
          if (!filter) return;
          set({
            mesFiltro: filter.mesFiltro,
            anoFiltro: filter.anoFiltro,
            empresaFiltro: filter.empresaFiltro,
            statusFiltro: filter.statusFiltro,
            operacaoFiltro: filter.operacaoFiltro,
          });
        },

        /* ── Drill-Down ── */
        drillDown: null,
        openDrillDown: (config) => set({ drillDown: config }),
        closeDrillDown: () => set({ drillDown: null }),

        /* ── Presentation Mode ── */
        presentationMode: false,
        setPresentationMode: (v) => set({ presentationMode: v }),
        togglePresentationMode: () =>
          set((s) => ({ presentationMode: !s.presentationMode })),
      }),
      {
        name: "fiscal-cockpit-filters-v2",
        partialize: (state) => ({
          mesFiltro: state.mesFiltro,
          anoFiltro: state.anoFiltro,
          emissaoMesFiltro: state.emissaoMesFiltro,
          emissaoAnoFiltro: state.emissaoAnoFiltro,
          empresaFiltro: state.empresaFiltro,
          statusFiltro: state.statusFiltro,
          operacaoFiltro: state.operacaoFiltro,
          clienteFiltro: state.clienteFiltro,
          municipioFiltro: state.municipioFiltro,
          ufFiltro: state.ufFiltro,
          lc116Filtro: state.lc116Filtro,
          nbsFiltro: state.nbsFiltro,
          codigoTributarioFiltro: state.codigoTributarioFiltro,
          tipoServicoFiltro: state.tipoServicoFiltro,
          retencaoFiltro: state.retencaoFiltro,
          categoriaFiltro: state.categoriaFiltro,
          grupoFiltro: state.grupoFiltro,
          valorMinFiltro: state.valorMinFiltro,
          valorMaxFiltro: state.valorMaxFiltro,
          savedFilters: state.savedFilters,
        }),
      }
    )
  )
);
