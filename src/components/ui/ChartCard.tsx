import React from "react";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  tooltip?: string;
  loading?: boolean;
  empty?: boolean;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  tooltip,
  loading,
  empty,
  children,
  className,
  headerRight,
}: ChartCardProps) {
  return (
    <div className={cn("flex flex-col rounded-xl border bg-card p-6 shadow-sm", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
            {tooltip && (
              <div title={tooltip} className="cursor-help text-muted-foreground">
                <Info className="h-4 w-4" />
              </div>
            )}
          </div>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {headerRight && <div>{headerRight}</div>}
      </div>

      <div className="flex-1 w-full min-h-[300px] relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Carregando dados...</p>
          </div>
        ) : empty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Info className="h-8 w-8" />
            <p className="text-sm">Sem dados para exibir.</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
