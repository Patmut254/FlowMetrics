import { formatMonth, formatNumber } from "@/lib/format";
import type { AnalyticsData } from "@/types";

/**
 * Retention cohort grid. Sequential encoding: one hue (teal), lighter = lower,
 * mixed against the surface so it reads correctly in light and dark mode.
 * Every cell also prints its value, so colour is never the only channel.
 */
export function CohortHeatmap({ rows }: { rows: AnalyticsData["retention"] }) {
  const columns = rows[0]?.retention.length ?? 0;
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-[3px] text-xs">
        <caption className="sr-only">Customer retention by sign-up month</caption>
        <thead>
          <tr>
            <th scope="col" className="px-2 pb-1 text-left font-semibold text-muted">Cohort</th>
            <th scope="col" className="px-2 pb-1 text-right font-semibold text-muted">Customers</th>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} scope="col" className="px-2 pb-1 text-center font-semibold text-muted">
                M{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cohort}>
              <th scope="row" className="px-2 py-1 text-left font-semibold whitespace-nowrap text-ink">
                {formatMonth(row.cohort, true)}
              </th>
              <td className="px-2 py-1 text-right text-ink-2 tabular">{formatNumber(row.size)}</td>
              {row.retention.map((value, i) => {
                if (value === null) return <td key={i} className="rounded-md bg-surface-2" aria-label="No data yet" />;
                const strength = Math.max(8, Math.round(value * 0.92));
                const strong = strength > 65;
                return (
                  <td
                    key={i}
                    title={`${formatMonth(row.cohort)} · month ${i}: ${value}% retained`}
                    className="h-9 min-w-12 rounded-md text-center font-semibold tabular"
                    style={{
                      background: `color-mix(in oklab, var(--chart-1) ${strength}%, var(--surface))`,
                      color: strong ? "var(--heat-text-strong)" : "var(--ink)",
                    }}
                  >
                    {Math.round(value)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
