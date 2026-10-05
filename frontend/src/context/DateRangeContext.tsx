import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { rangeFromPreset, type DateRangeValue } from "@/lib/dates";
import type { RangePreset } from "@/types";

export const DEFAULT_RANGE_KEY = "fm-default-range";

interface DateRangeState {
  range: DateRangeValue;
  setRange: (range: DateRangeValue) => void;
}

const DateRangeContext = createContext<DateRangeState | null>(null);

function initialRange(): DateRangeValue {
  let preset: RangePreset = "30d";
  try {
    const stored = localStorage.getItem(DEFAULT_RANGE_KEY);
    if (stored === "7d" || stored === "30d" || stored === "90d" || stored === "12m") preset = stored;
  } catch {
    /* ignore */
  }
  return rangeFromPreset(preset);
}

/** Shared date range so Dashboard and Analytics stay in sync as you navigate. */
export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRangeValue>(initialRange);
  const value = useMemo(() => ({ range, setRange }), [range]);
  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange(): DateRangeState {
  const context = useContext(DateRangeContext);
  if (!context) throw new Error("useDateRange must be used inside <DateRangeProvider>");
  return context;
}
