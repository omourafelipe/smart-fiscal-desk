// src/store/dashboardSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type PeriodType = "competencia" | "emissao";

export interface DashboardState {
  periodType: PeriodType;
  executiveMode: boolean;
}

const initialState: DashboardState = {
  periodType: "competencia",
  executiveMode: false,
};

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    setPeriodType(state, action: PayloadAction<PeriodType>) {
      state.periodType = action.payload;
    },
    toggleExecutiveMode(state) {
      state.executiveMode = !state.executiveMode;
    },
    setExecutiveMode(state, action: PayloadAction<boolean>) {
      state.executiveMode = action.payload;
    },
  },
});

export const { setPeriodType, toggleExecutiveMode, setExecutiveMode } = dashboardSlice.actions;
export default dashboardSlice.reducer;
