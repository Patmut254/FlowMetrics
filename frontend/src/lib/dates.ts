import type { RangePreset } from "@/types";
import { formatDate } from "./format";

export interface DateRangeValue {
  start: string;
  end: string;
  preset: RangePreset | "ytd" | "custom";
}

export const PRESETS: { value: RangePreset | "ytd"; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
];

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function rangeFromPreset(preset: RangePreset | "ytd", today = new Date()): DateRangeValue {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  switch (preset) {
    case "7d":
      start.setDate(end.getDate() - 6);
      break;
    case "30d":
      start.setDate(end.getDate() - 29);
      break;
    case "90d":
      start.setDate(end.getDate() - 89);
      break;
    case "12m":
      start.setFullYear(end.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      break;
    case "ytd":
      start.setMonth(0, 1);
      break;
  }
  return { start: toISO(start), end: toISO(end), preset };
}

export function describeRange(range: DateRangeValue): string {
  const preset = PRESETS.find((p) => p.value === range.preset);
  if (preset) return preset.label;
  return `${formatDate(range.start, "short")} – ${formatDate(range.end)}`;
}
