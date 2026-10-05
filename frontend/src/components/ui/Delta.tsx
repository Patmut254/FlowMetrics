import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatChange } from "@/lib/format";

interface DeltaProps {
  value: number | null | undefined;
  /** For metrics like churn, a decrease is good. */
  inverse?: boolean;
  onDark?: boolean;
  className?: string;
}

/** Period-over-period change. Direction is shown by an arrow and sign, not colour alone. */
export function Delta({ value, inverse = false, onDark = false, className }: DeltaProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className={cn("inline-flex items-center text-xs font-semibold", onDark ? "text-white/60" : "text-muted", className)}>
        —
      </span>
    );
  }
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : inverse ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = onDark
    ? good === null
      ? "bg-white/10 text-white/80"
      : good
        ? "bg-emerald-400/15 text-emerald-200"
        : "bg-red-400/20 text-red-100"
    : good === null
      ? "bg-surface-3 text-ink-2"
      : good
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300";
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular", tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {formatChange(value)}
    </span>
  );
}
