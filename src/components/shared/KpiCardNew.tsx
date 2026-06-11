export function KpiCardNew({
  label,
  value,
  trendText,
  isPositive,
  subtext,
  tone,
}: {
  label: string;
  value: string;
  trendText: string;
  isPositive: boolean;
  subtext: string;
  tone: "blue" | "purple" | "green" | "rose" | "amber";
}) {
  const borderColors = {
    blue: "border-blue-100 dark:border-blue-900/50 hover:border-blue-300 dark:hover:border-blue-800/60",
    purple: "border-purple-100 dark:border-purple-900/50 hover:border-purple-300 dark:hover:border-purple-800/60",
    green: "border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-800/60",
    rose: "border-rose-100 dark:border-rose-900/50 hover:border-rose-300 dark:hover:border-rose-800/60",
    amber: "border-amber-100 dark:border-amber-900/50 hover:border-amber-300 dark:hover:border-amber-800/60",
  };

  const glowEffects = {
    blue: "hover:shadow-[0_8px_30px_rgba(59,130,246,0.06)] dark:hover:shadow-[0_8px_30px_rgba(59,130,246,0.03)]",
    purple: "hover:shadow-[0_8px_30px_rgba(139,92,246,0.06)] dark:hover:shadow-[0_8px_30px_rgba(139,92,246,0.03)]",
    green: "hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)] dark:hover:shadow-[0_8px_30px_rgba(16,185,129,0.03)]",
    rose: "hover:shadow-[0_8px_30px_rgba(239,68,68,0.06)] dark:hover:shadow-[0_8px_30px_rgba(239,68,68,0.03)]",
    amber: "hover:shadow-[0_8px_30px_rgba(245,158,11,0.06)] dark:hover:shadow-[0_8px_30px_rgba(245,158,11,0.03)]",
  };

  const isLong = value.length > 12;
  const isVeryLong = value.length > 16;
  const valueFontSize = isVeryLong
    ? "text-sm sm:text-base font-bold tracking-tighter"
    : isLong
      ? "text-base sm:text-lg lg:text-xl xl:text-base 2xl:text-lg font-extrabold tracking-tighter"
      : "text-lg sm:text-2xl font-extrabold tracking-tight";

  return (
    <div className={`p-4 sm:p-5 xl:p-4 2xl:p-5 rounded-2xl border bg-card text-card-foreground flex flex-col justify-between shadow-xs ${borderColors[tone]} ${glowEffects[tone]} transition-all duration-300 hover:-translate-y-0.5`}>
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`${valueFontSize} text-foreground`}>{value}</p>
      </div>

      <div className="flex items-center gap-1.5 mt-4 pt-2 border-t border-border/40 flex-wrap">
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
            isPositive 
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" 
              : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
          }`}
        >
          {trendText} {isPositive ? "↗" : "↘"}
        </span>
        <span className="text-[9px] text-muted-foreground font-medium truncate max-w-[110px]" title={subtext}>{subtext}</span>
      </div>
    </div>
  );
}
