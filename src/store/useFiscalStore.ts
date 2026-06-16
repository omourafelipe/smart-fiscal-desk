import { create } from "zustand";

/* ─── Drill-Down Filter Descriptors ─────────────────────────────── */
export type DrillDownFilter =
  | { type: "all" }
  | { type: "competencia"; value: string }         // MM/YYYY
  | { type: "prestador"; cnpj: string }
  | { type: "intercompany" }
  | { type: "externo" };

export interface DrillDownConfig {
  title: string;
  filter: DrillDownFilter;
}

/* ─── Store Interface ───────────────────────────────────────────── */
interface FiscalState {
  refreshTick: number;
  bumpRefresh: () => void;
  mesFiltro: string; // "" = todos
  anoFiltro: string; // "" = todos
  empresaFiltro: string; // "" = Consolidado do Grupo
  statusFiltro: "todos" | "Ativo" | "Cancelado"; // default Ativo
  operacaoFiltro: "Todas" | "Externas" | "Intercompany"; // default Todas
  setMesFiltro: (m: string) => void;
  setAnoFiltro: (a: string) => void;
  setEmpresaFiltro: (e: string) => void;
  setStatusFiltro: (s: "todos" | "Ativo" | "Cancelado") => void;
  setOperacaoFiltro: (o: "Todas" | "Externas" | "Intercompany") => void;
  // Drill-Down
  drillDown: DrillDownConfig | null;
  openDrillDown: (config: DrillDownConfig) => void;
  closeDrillDown: () => void;
}

export const useFiscalStore = create<FiscalState>((set) => ({
  refreshTick: 0,
  bumpRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
  mesFiltro: "",
  anoFiltro: "",
  empresaFiltro: "",
  statusFiltro: "Ativo",
  operacaoFiltro: "Todas",
  setMesFiltro: (m) => set({ mesFiltro: m }),
  setAnoFiltro: (a) => set({ anoFiltro: a }),
  setEmpresaFiltro: (e) => set({ empresaFiltro: e }),
  setStatusFiltro: (s) => set({ statusFiltro: s }),
  setOperacaoFiltro: (o) => set({ operacaoFiltro: o }),
  // Drill-Down
  drillDown: null,
  openDrillDown: (config) => set({ drillDown: config }),
  closeDrillDown: () => set({ drillDown: null }),
}));
