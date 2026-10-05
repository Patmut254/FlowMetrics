import type { ValueFormat } from "@/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

/**
 * Categorical series colours, assigned in this fixed order (never cycled).
 * Validated for colour-vision deficiency in light and dark mode.
 * Charts plotting all-pairs comparisons use at most the first three.
 */
export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"] as const;

/** Colour for the nth plan (plans are ordered by tier). Beyond four, plans share a neutral. */
export function planColor(index: number): string {
  return SERIES[index] ?? "var(--muted)";
}

export const AXIS_TICK = { fill: "var(--chart-axis)", fontSize: 11, fontWeight: 500 };
export const GRID_STROKE = "var(--chart-grid)";

export function formatAxis(value: number, format: ValueFormat) {
  if (format === "currency") return formatCurrency(value, { compact: true, cents: false });
  if (format === "percent") return `${value}%`;
  return formatNumber(value, true);
}

export function formatTooltipValue(value: number, format: ValueFormat) {
  if (format === "currency") return formatCurrency(value);
  if (format === "percent") return formatPercent(value, 2);
  return formatNumber(value);
}
