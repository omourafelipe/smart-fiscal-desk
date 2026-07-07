import React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  comparison?: string;
  isPositive?: boolean;
  tooltip?: string;
  className?: string;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  icon,
  comparison,
  isPositive,
  tooltip,
  className,
  onClick,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      title={tooltip}
      className={cn(
        "rounded-xl border bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md",
        onClick && "cursor-pointer hover:border-primary/50",
        className
      )}
    >
      <div className="flex flex-row items-center justify-between pb-2">
        <h3 className="text-sm font-medium text-muted-foreground tracking-tight">
          {title}
        </h3>
        {icon && (
          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-secondary text-secondary-foreground">
            {icon}
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">
          {value}
        </div>
        {comparison && (
          <p
            className={cn(
              "text-xs mt-1 font-medium flex items-center gap-1",
              isPositive === true && "text-emerald-500",
              isPositive === false && "text-rose-500",
              isPositive === undefined && "text-muted-foreground"
            )}
          >
            {comparison}
          </p>
        )}
      </div>
    </div>
  );
}
