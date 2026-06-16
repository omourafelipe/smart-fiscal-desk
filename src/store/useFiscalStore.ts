import { create } from "zustand";

interface FiscalState {
  refreshTick: number;
  bumpRefresh: () => void;
  mesFiltro: string; // "" = todos
  anoFiltro: string; // "" = todos
  setMesFiltro: (m: string) => void;
  setAnoFiltro: (a: string) => void;
}

export const useFiscalStore = create<FiscalState>((set) => ({
  refreshTick: 0,
  bumpRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
  mesFiltro: "",
  anoFiltro: "",
  setMesFiltro: (m) => set({ mesFiltro: m }),
  setAnoFiltro: (a) => set({ anoFiltro: a }),
}));
