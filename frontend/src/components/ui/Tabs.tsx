import { cn } from "@/lib/cn";

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string; count?: number }[];
  label: string;
  className?: string;
}

/** Underlined tab strip used for status filters and settings sections. */
export function Tabs<T extends string>({ value, onChange, tabs, label, className }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={cn("scrollbar-thin flex gap-1 overflow-x-auto border-b border-line", className)}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              selected ? "border-brand-600 text-ink dark:border-brand-400" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] tabular",
                  selected ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "bg-surface-3 text-ink-2",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
