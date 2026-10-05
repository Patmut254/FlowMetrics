import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import type { ValueFormat } from "@/types";
import { formatTooltipValue } from "./theme";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  detail?: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  format?: ValueFormat;
  centerLabel: string;
  centerValue: string;
  title: string;
}

/**
 * Part-to-whole donut. Slices are separated by a 2px surface gap, and the legend
 * lists every value as text so identity never depends on colour alone.
 */
export function DonutChart({ data, format = "currency", centerLabel, centerValue, title }: DonutChartProps) {
  const [active, setActive] = useState<string | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const visible = data.filter((d) => d.value > 0);

  return (
    <figure aria-label={title} className="m-0 flex flex-col items-center gap-6 sm:flex-row lg:flex-col">
      <div className="relative size-44 shrink-0" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="value"
              nameKey="label"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={0}
              stroke="var(--surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              onMouseEnter={(_, index) => setActive(visible[index]?.key ?? null)}
              onMouseLeave={() => setActive(null)}
            >
              {visible.map((slice) => (
                <Cell key={slice.key} fill={slice.color} opacity={active && active !== slice.key ? 0.35 : 1} />
              ))}
            </Pie>
            <Tooltip
              content={({ active: isActive, payload }) => {
                const item = payload?.[0];
                if (!isActive || !item) return null;
                const slice = item.payload as DonutSlice;
                return (
                  <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-pop">
                    <p className="text-sm font-semibold text-ink tabular">{formatTooltipValue(slice.value, format)}</p>
                    <p className="text-xs text-ink-2">
                      {slice.label} · {total ? ((slice.value / total) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-medium text-muted">{centerLabel}</span>
          <span className="text-lg font-bold text-ink tabular">{centerValue}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {data.map((slice) => (
          <li
            key={slice.key}
            onMouseEnter={() => setActive(slice.key)}
            onMouseLeave={() => setActive(null)}
            className={cn("flex items-center gap-3 rounded-lg transition-opacity", active && active !== slice.key && "opacity-50")}
          >
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: slice.color }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{slice.label}</span>
              {slice.detail && <span className="block text-xs text-muted">{slice.detail}</span>}
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold whitespace-nowrap text-ink tabular">{format === "currency" ? formatCurrency(slice.value, { cents: false }) : formatTooltipValue(slice.value, format)}</span>
              <span className="block text-xs text-muted tabular">{total ? ((slice.value / total) * 100).toFixed(1) : "0.0"}%</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
