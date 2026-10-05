import type { ReactNode, ThHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("scrollbar-thin overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-surface-2 px-5 py-2.5 text-left text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted uppercase",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

interface SortThProps {
  label: string;
  field: string;
  ordering: string;
  onSort: (ordering: string) => void;
  align?: "left" | "right";
}

/** Sortable column header. `ordering` uses the API's `field` / `-field` convention. */
export function SortTh({ label, field, ordering, onSort, align = "left" }: SortThProps) {
  const active = ordering.replace("-", "") === field;
  const descending = ordering.startsWith("-");
  const Icon = !active ? ChevronsUpDown : descending ? ArrowDown : ArrowUp;
  return (
    <Th className={align === "right" ? "text-right" : undefined} aria-sort={active ? (descending ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(active && descending ? field : `-${field}`)}
        className={cn("inline-flex items-center gap-1 uppercase hover:text-ink", active && "text-ink", align === "right" && "flex-row-reverse")}
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </button>
    </Th>
  );
}

export function Td({ className, children }: { className?: string; children: ReactNode }) {
  return <td className={cn("border-b border-line px-5 py-3 align-middle", className)}>{children}</td>;
}
