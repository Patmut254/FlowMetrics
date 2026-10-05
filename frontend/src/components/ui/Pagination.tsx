import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

interface PaginationProps {
  page: number;
  totalPages: number;
  count: number;
  pageSize: number;
  onChange: (page: number) => void;
  noun?: string;
}

function pageList(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export function Pagination({ page, totalPages, count, pageSize, onChange, noun = "results" }: PaginationProps) {
  if (count === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  const navButton = "grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-surface-3 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <nav className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:flex-row" aria-label="Pagination">
      <p className="text-xs text-muted tabular">
        Showing <span className="font-semibold text-ink">{formatNumber(from)}–{formatNumber(to)}</span> of{" "}
        <span className="font-semibold text-ink">{formatNumber(count)}</span> {noun}
      </p>
      <div className="flex items-center gap-1">
        <button className={navButton} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        {pageList(page, totalPages).map((item, index) =>
          item === "…" ? (
            <span key={`gap-${index}`} className="px-1.5 text-xs text-muted">
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 rounded-lg px-2 text-xs font-semibold tabular",
                item === page ? "bg-brand-700 text-white dark:bg-brand-400 dark:text-brand-900" : "text-ink-2 hover:bg-surface-3",
              )}
            >
              {item}
            </button>
          ),
        )}
        <button className={navButton} onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
