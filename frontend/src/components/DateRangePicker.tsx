import { useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Controls";
import { cn } from "@/lib/cn";
import { PRESETS, describeRange, rangeFromPreset, toISO, type DateRangeValue } from "@/lib/dates";

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  variant?: "default" | "hero";
}

export function DateRangePicker({ value, onChange, variant = "default" }: DateRangePickerProps) {
  const [start, setStart] = useState(value.start);
  const [end, setEnd] = useState(value.end);
  const [error, setError] = useState<string | null>(null);
  const today = toISO(new Date());

  const applyCustom = (close: () => void) => {
    if (!start || !end) return setError("Choose both dates.");
    if (start > end) return setError("Start date must be before the end date.");
    if (end > today) return setError("End date can't be in the future.");
    setError(null);
    onChange({ start, end, preset: "custom" });
    close();
  };

  return (
    <Popover
      className="w-[300px]"
      trigger={({ toggle, open }) => (
        <button
          onClick={() => {
            setStart(value.start);
            setEnd(value.end);
            setError(null);
            toggle();
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
            variant === "hero"
              ? "border border-white/20 bg-white/5 text-white hover:bg-white/10"
              : "border border-line bg-surface text-ink shadow-card hover:bg-surface-2",
          )}
        >
          <CalendarDays className="size-4 opacity-80" aria-hidden />
          {describeRange(value)}
          <ChevronDown className="size-4 opacity-70" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div role="dialog" aria-label="Choose date range">
          <ul className="space-y-0.5">
            {PRESETS.map((preset) => (
              <li key={preset.value}>
                <button
                  onClick={() => {
                    onChange(rangeFromPreset(preset.value));
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium",
                    value.preset === preset.value ? "bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200" : "text-ink-2 hover:bg-surface-3",
                  )}
                >
                  {preset.label}
                  {value.preset === preset.value && <Check className="size-4" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 border-t border-line px-1 pt-3 pb-1">
            <p className="mb-2 px-1.5 text-xs font-semibold text-muted">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-ink-2">
                From
                <input
                  type="date"
                  value={start}
                  max={today}
                  onChange={(e) => setStart(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink"
                />
              </label>
              <label className="text-xs font-medium text-ink-2">
                To
                <input
                  type="date"
                  value={end}
                  max={today}
                  onChange={(e) => setEnd(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink"
                />
              </label>
            </div>
            {error && <p className="mt-2 px-0.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
            <Button size="sm" className="mt-3 w-full justify-center" onClick={() => applyCustom(close)}>
              Apply range
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}
