import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ActivityLogDrawer } from "../shared/ActivityLogDrawer";
import { GlobalFilterBar } from "../shared/GlobalFilterBar";
import { FiscalAssistantDrawer } from "../shared/FiscalAssistantDrawer";

export interface ActivityLogItem {
  id: string;
  type: "upload" | "conciliation" | "clear" | "update" | "export";
  title: string;
  description: string;
  time: Date;
}

interface LayoutContextProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  periodType: "competencia" | "emissao";
  setPeriodType: (t: "competencia" | "emissao") => void;
  activities: ActivityLogItem[];
  addActivity: (type: ActivityLogItem["type"], title: string, description: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const LayoutContext = createContext<LayoutContextProps | undefined>(undefined);

export function useLayoutShell() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayoutShell must be used within a LayoutProvider");
  }
  return context;
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme") as "light" | "dark" | null;
      const systemPreference = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      const initialTheme = saved || systemPreference;
      setTheme(initialTheme);
      
      const root = window.document.documentElement;
      if (initialTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    const root = window.document.documentElement;
    if (nextTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", nextTheme);
  };

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebarOpen") === "true";
    }
    return false;
  });

  const handleSetSidebarOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    setSidebarOpen((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      localStorage.setItem("sidebarOpen", String(next));
      return next;
    });
  };

  // Right Panel / Notification Drawer state
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Date period state (Competência vs Emissão)
  const [periodType, setPeriodTypeState] = useState<"competencia" | "emissao">("competencia");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("periodType") as "competencia" | "emissao" | null;
      if (saved) setPeriodTypeState(saved);
    }
  }, []);

  const setPeriodType = (t: "competencia" | "emissao") => {
    setPeriodTypeState(t);
    localStorage.setItem("periodType", t);
  };

  // Activities Log state
  const [activities, setActivities] = useState<ActivityLogItem[]>([
    {
      id: "init",
      type: "update",
      title: "Sistema Inicializado",
      description: "Banco de dados local carregado com sucesso.",
      time: new Date(),
    }
  ]);

  const addActivity = useCallback((type: ActivityLogItem["type"], title: string, description: string) => {
    setActivities((prev) => [
      {
        id: Math.random().toString(36).substring(7),
        type,
        title,
        description,
        time: new Date(),
      },
      ...prev.slice(0, 19)
    ]);
  }, []);

  return (
    <LayoutContext.Provider
      value={{
        theme,
        toggleTheme,
        periodType,
        setPeriodType,
        activities,
        addActivity,
        sidebarOpen,
        setSidebarOpen: handleSetSidebarOpen,
      }}
    >
      <div className="min-h-screen bg-background flex font-sans antialiased text-foreground w-full overflow-hidden transition-colors duration-300">
        <Toaster richColors position="top-right" />
        
        {/* Overlay for Mobile Sidebar */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-xs md:hidden"
          />
        )}

        <Sidebar />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen relative">
          <Topbar 
            rightPanelOpen={rightPanelOpen} 
            setRightPanelOpen={setRightPanelOpen} 
            assistantOpen={assistantOpen} 
            setAssistantOpen={setAssistantOpen} 
          />
          <div className="px-6 pt-4">
            <GlobalFilterBar />
          </div>
          {children}
        </div>

        <ActivityLogDrawer rightPanelOpen={rightPanelOpen} setRightPanelOpen={setRightPanelOpen} />
        <FiscalAssistantDrawer assistantOpen={assistantOpen} setAssistantOpen={setAssistantOpen} />
      </div>
    </LayoutContext.Provider>
  );
}
