import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { EmptyState } from "@/components/shared/EmptyState";

interface BarChartRankingProps {
  data: { name: string; value: number }[];
  title: string;
  subtitle?: string;
  color?: string;
}

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BarChartRanking({ data, title, subtitle, color = "#6366f1" }: BarChartRankingProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs h-full transition-colors duration-300">
        <h3 className="text-xs font-bold text-foreground mb-1">{title}</h3>
        {subtitle && <p className="text-[10px] text-muted-foreground mb-4">{subtitle}</p>}
        <div className="h-[250px] flex items-center justify-center">
          <EmptyState />
        </div>
      </div>
    );
  }

  // Find max value to normalize bar widths
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-xs h-full transition-colors duration-300 flex flex-col">
      <div>
        <h3 className="text-xs font-bold text-foreground mb-1">{title}</h3>
        {subtitle && <p className="text-[10px] text-muted-foreground mb-4">{subtitle}</p>}
      </div>

      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            barSize={12}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              width={100}
            />
            <Tooltip
              cursor={{ fill: "var(--color-muted)", opacity: 0.2 }}
              contentStyle={{
                backgroundColor: "var(--color-popover)",
                borderColor: "var(--color-border)",
                borderRadius: 12,
                color: "var(--color-foreground)",
                fontSize: "10px",
                fontWeight: 500,
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)",
              }}
              formatter={(value: number) => [fmtBRL(value), "Faturamento"]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.value === maxValue ? color : `${color}99`} // Highlight the top one
                  className="transition-all duration-300 hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
