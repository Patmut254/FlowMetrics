import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBucket } from "@/lib/format";
import type { Granularity, SeriesPoint } from "@/types";
import { ChartTooltip } from "./ChartTooltip";
import { ChartDataTable, ChartLegend } from "./TrendChart";
import { AXIS_TICK, GRID_STROKE, SERIES, formatAxis } from "./theme";

const MOVEMENT_SERIES = [
  { key: "new_mrr", label: "New", color: SERIES[0], format: "currency" as const },
  { key: "expansion_mrr", label: "Expansion", color: SERIES[2], format: "currency" as const },
  { key: "lost_mrr", label: "Churn & contraction", color: SERIES[1], format: "currency" as const },
];

/**
 * MRR movements as a diverging stacked bar: gains above the baseline, losses below.
 * Uses three series so every pair stays distinguishable for colour-blind readers.
 */
export function MovementChart({ points, granularity, height = 280 }: { points: SeriesPoint[]; granularity: Granularity; height?: number }) {
  const data = points.map((p) => ({
    date: p.date,
    new_mrr: p.new_mrr,
    expansion_mrr: p.expansion_mrr,
    lost_mrr: -(p.churned_mrr + p.contraction_mrr),
  }));
  const formats = Object.fromEntries(MOVEMENT_SERIES.map((s) => [s.key, s.format]));

  return (
    <figure aria-label="MRR movements" className="m-0">
      <div className="mb-3">
        <ChartLegend series={MOVEMENT_SERIES} />
      </div>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: -4 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={28}
              tickFormatter={(v: string) => formatBucket(v, granularity)}
            />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatAxis(v, "currency")} />
            <ReferenceLine y={0} stroke="var(--line-strong)" />
            <Tooltip
              cursor={{ fill: "var(--surface-3)", opacity: 0.7 }}
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  payload={props.payload as never}
                  label={props.label as string}
                  labelFormatter={(label) => formatBucket(label, granularity, true)}
                  formats={formats}
                />
              )}
            />
            {MOVEMENT_SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="mrr" fill={s.color} stroke="var(--surface)" strokeWidth={1} maxBarSize={28} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable title="MRR movements" data={data} series={MOVEMENT_SERIES} granularity={granularity} />
    </figure>
  );
}
