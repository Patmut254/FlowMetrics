import type { ValueFormat } from "@/types";
import { formatTooltipValue } from "./theme";

interface PayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  stroke?: string;
  fill?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly PayloadItem[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
  formats?: Record<string, ValueFormat>;
  defaultFormat?: ValueFormat;
}

/**
 * Shared tooltip: values lead (bold), series labels follow, each keyed with a
 * short stroke of its colour. Text always uses ink tokens, never series colour.
 */
export function ChartTooltip({ active, payload, label, labelFormatter, formats = {}, defaultFormat = "number" }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-pop">
      {label !== undefined && (
        <p className="mb-1.5 text-xs font-medium text-muted">{labelFormatter ? labelFormatter(String(label)) : label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name);
          const color = item.stroke && item.stroke !== "none" ? item.stroke : (item.fill ?? item.color);
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span className="h-0.5 w-3 rounded-full" style={{ background: color }} aria-hidden />
              <span className="font-semibold text-ink tabular">{formatTooltipValue(Number(item.value ?? 0), formats[key] ?? defaultFormat)}</span>
              <span className="text-ink-2">{item.name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
