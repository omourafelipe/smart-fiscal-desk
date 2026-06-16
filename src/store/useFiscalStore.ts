import { create } from "zustand";

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
}));
