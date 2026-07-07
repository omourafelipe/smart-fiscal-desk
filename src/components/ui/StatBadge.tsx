import React from "react";
import { cn } from "@/lib/utils";

interface StatBadgeProps {
  label: string;
  value: string | number;
  className?: string;
  trend?: "up" | "down" | "neutral";
}

export function StatBadge({ label, value, className, trend }: StatBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm shadow-sm bg-background",
        className
      )}
    >
      <span className="text-muted-foreground font-medium">{label}:</span>
      <span
        className={cn(
          "font-bold",
          trend === "up" && "text-emerald-500",
          trend === "down" && "text-rose-500",
          (!trend || trend === "neutral") && "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}
