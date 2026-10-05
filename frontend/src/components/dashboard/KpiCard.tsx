import type { ReactNode } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { Card } from "@/components/ui/Card";
import { Delta } from "@/components/ui/Delta";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

interface KpiCardProps {
  label: string;
  value: string;
  change: number | null | undefined;
  icon: ReactNode;
  inverse?: boolean;
  trend?: number[];
  footnote?: string;
  className?: string;
}

export function KpiCard({ label, value, change, icon, inverse, trend, footnote = "vs previous period", className }: KpiCardProps) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600 ring-4 ring-brand-50/50 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/5">{icon}</span>
        {trend && <Sparkline values={trend} />}
      </div>
      <p className="mt-4 text-sm font-medium text-ink-2">{label}</p>
      <p className="mt-1 text-[28px] leading-tight font-bold tracking-tight text-ink tabular">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        <Delta value={change} inverse={inverse} />
        <span className="text-xs text-muted">{footnote}</span>
      </div>
    </Card>
  );
}

export function StatTile({ label, value, change, inverse, hint }: { label: string; value: string; change?: number | null; inverse?: boolean; hint?: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="truncate text-xs font-medium text-muted">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-xl font-bold tracking-tight text-ink tabular">{value}</p>
        {change !== undefined && <Delta value={change} inverse={inverse} />}
      </div>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="size-10 rounded-xl" />
      <Skeleton className="mt-4 h-3.5 w-24" />
      <Skeleton className="mt-2.5 h-7 w-32" />
      <Skeleton className="mt-3 h-4 w-36" />
    </Card>
  );
}
