import React from "react";
import { type Insight } from "@/hooks/useInsightsEngine";

export function ExecutiveInsights({ insights }: { insights: Insight[] }) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {insights.map((insight) => {
        const Icon = insight.icon;
        
        let bgColor = "bg-muted/50";
        let iconColor = "text-muted-foreground";
        let iconBg = "bg-muted";
        
        if (insight.type === "positive") {
          bgColor = "bg-emerald-500/5 border-emerald-500/20";
          iconColor = "text-emerald-600 dark:text-emerald-400";
          iconBg = "bg-emerald-500/10";
        } else if (insight.type === "negative") {
          bgColor = "bg-rose-500/5 border-rose-500/20";
          iconColor = "text-rose-600 dark:text-rose-400";
          iconBg = "bg-rose-500/10";
        } else if (insight.type === "warning") {
          bgColor = "bg-amber-500/5 border-amber-500/20";
          iconColor = "text-amber-600 dark:text-amber-400";
          iconBg = "bg-amber-500/10";
        } else if (insight.type === "achievement") {
          bgColor = "bg-indigo-500/5 border-indigo-500/20";
          iconColor = "text-indigo-600 dark:text-indigo-400";
          iconBg = "bg-indigo-500/10";
        }

        return (
          <div key={insight.id} className={`p-4 rounded-xl border ${bgColor} flex items-start gap-3 transition-all duration-300 hover:shadow-sm`}>
            <div className={`mt-0.5 p-2 rounded-lg ${iconBg}`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground mb-0.5">{insight.title}</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {insight.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
