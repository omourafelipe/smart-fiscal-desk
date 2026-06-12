import { create } from 'zustand';

interface GlobalFiltersState {
  empresaFiltro: string;
  mesFiltro: string;
  anoFiltro: string;
  cServFiltro: string;
  searchCliente: string;
  setEmpresaFiltro: (val: string) => void;
  setMesFiltro: (val: string) => void;
  setAnoFiltro: (val: string) => void;
  setCServFiltro: (val: string) => void;
  setSearchCliente: (val: string) => void;
  resetFilters: () => void;
}

export const useGlobalFilters = create<GlobalFiltersState>((set) => ({
  empresaFiltro: '__all__',
  mesFiltro: '__all__',
  anoFiltro: '__all__',
  cServFiltro: '__all__',
  searchCliente: '',
  setEmpresaFiltro: (val) => set({ empresaFiltro: val }),
  setMesFiltro: (val) => set({ mesFiltro: val }),
  setAnoFiltro: (val) => set({ anoFiltro: val }),
  setCServFiltro: (val) => set({ cServFiltro: val }),
  setSearchCliente: (val) => set({ searchCliente: val }),
  resetFilters: () =>
    set({
      empresaFiltro: '__all__',
      mesFiltro: '__all__',
      anoFiltro: '__all__',
      cServFiltro: '__all__',
      searchCliente: '',
    }),
}));
