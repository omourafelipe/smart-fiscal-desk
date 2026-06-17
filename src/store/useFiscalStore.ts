import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";

/* ─── Drill-Down Filter Descriptors ─────────────────────────────── */
export type DrillDownFilter =
  | { type: "all" }
  | { type: "competencia"; value: string }         // MM/YYYY
  | { type: "prestador"; cnpj: string }
  | { type: "intercompany" }
  | { type: "externo" }
  | { type: "servico"; serviceKey: string; serviceLabel: string };

export interface DrillDownConfig {
  title: string;
  filter: DrillDownFilter;
}

/* ─── Saved Filter ──────────────────────────────────────────────── */
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

/* ─── Store Interface ───────────────────────────────────────────── */
interface FiscalState {
  refreshTick: number;
  bumpRefresh: () => void;

  /* ── Filters ── */
  mesFiltro: string;
  anoFiltro: string;
  empresaFiltro: string;
  statusFiltro: "todos" | "Ativo" | "Cancelado";
  operacaoFiltro: "Todas" | "Externas" | "Intercompany";
  setMesFiltro: (m: string) => void;
  setAnoFiltro: (a: string) => void;
  setEmpresaFiltro: (e: string) => void;
  setStatusFiltro: (s: "todos" | "Ativo" | "Cancelado") => void;
  setOperacaoFiltro: (o: "Todas" | "Externas" | "Intercompany") => void;
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
  empresaFiltro: "",
  statusFiltro: "Ativo" as const,
  operacaoFiltro: "Todas" as const,
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
        setEmpresaFiltro: (e) => set({ empresaFiltro: e }),
        setStatusFiltro: (s) => set({ statusFiltro: s }),
        setOperacaoFiltro: (o) => set({ operacaoFiltro: o }),
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
            savedFilters: [...prev.savedFilters, newFilter].slice(-10), // max 10
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
        name: "fiscal-cockpit-filters",
        // Only persist filter state + saved filters (not UI state)
        partialize: (state) => ({
          mesFiltro: state.mesFiltro,
          anoFiltro: state.anoFiltro,
          empresaFiltro: state.empresaFiltro,
          statusFiltro: state.statusFiltro,
          operacaoFiltro: state.operacaoFiltro,
          savedFilters: state.savedFilters,
        }),
      }
    )
  )
);
