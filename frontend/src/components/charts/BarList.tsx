import { cn } from "@/lib/cn";

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  display: string;
  secondary?: string;
}

/** Horizontal magnitude bars with labels and values printed as text. Single hue. */
export function BarList({ items, color = "var(--chart-1)", className }: { items: BarListItem[]; color?: string; className?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className={cn("space-y-3.5", className)}>
      {items.map((item) => (
        <li key={item.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-ink">{item.label}</span>
            <span className="shrink-0 tabular">
              <span className="font-semibold text-ink">{item.display}</span>
              {item.secondary && <span className="ml-1.5 text-xs text-muted">{item.secondary}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(item.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
