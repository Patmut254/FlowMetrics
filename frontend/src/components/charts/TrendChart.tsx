import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBucket } from "@/lib/format";
import type { Granularity, ValueFormat } from "@/types";
import { ChartTooltip } from "./ChartTooltip";
import { AXIS_TICK, GRID_STROKE, formatAxis, formatTooltipValue } from "./theme";

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  format?: ValueFormat;
}

type Datum = Record<string, string | number>;

interface TrendChartProps {
  data: Datum[];
  series: SeriesDef[];
  granularity: Granularity;
  type?: "area" | "bar" | "line";
  format?: ValueFormat;
  /** Pixel height, or "fill" to take the remaining height of a flex parent. */
  height?: number | "fill";
  xKey?: string;
  /** Accessible name for the chart and its hidden data table. */
  title: string;
}

export function ChartLegend({ series }: { series: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {series.map((s) => (
        <li key={s.label} className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Visually hidden table so the chart's numbers are available to screen readers. */
export function ChartDataTable({ title, data, series, granularity, xKey = "date" }: Omit<TrendChartProps, "type" | "height">) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          {series.map((s) => (
            <th key={s.key} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={String(row[xKey])}>
            <th scope="row">{formatBucket(String(row[xKey]), granularity, true)}</th>
            {series.map((s) => (
              <td key={s.key}>{formatTooltipValue(Number(row[s.key] ?? 0), s.format ?? "number")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TrendChart({ data, series, granularity, type = "area", format = "number", height = 280, xKey = "date", title }: TrendChartProps) {
  const gradientBase = useId().replace(/:/g, "");
  const formats = Object.fromEntries(series.map((s) => [s.key, s.format ?? format]));
  const tooltip = (
    <Tooltip
      cursor={type === "bar" ? { fill: "var(--surface-3)", opacity: 0.7 } : { stroke: "var(--line-strong)", strokeWidth: 1, strokeDasharray: "4 4" }}
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
  );
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={GRID_STROKE} />
      <XAxis
        dataKey={xKey}
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
        tickMargin={10}
        minTickGap={28}
        interval="preserveStartEnd"
        tickFormatter={(value: string) => formatBucket(value, granularity)}
      />
      <YAxis
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
        width={56}
        tickFormatter={(value: number) => formatAxis(value, format)}
        allowDecimals={format !== "number"}
      />
      {tooltip}
    </>
  );
  const margin = { top: 8, right: 8, bottom: 0, left: -4 };

  return (
    <figure aria-label={title} className={height === "fill" ? "m-0 flex h-full flex-col" : "m-0"}>
      {series.length > 1 && (
        <div className="mb-3">
          <ChartLegend series={series} />
        </div>
      )}
      <div style={height === "fill" ? undefined : { height }} className={height === "fill" ? "min-h-0 flex-1" : undefined} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data} margin={margin} barGap={2} barCategoryGap="22%">
              {axes}
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
              ))}
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={data} margin={margin}>
              {axes}
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--surface)" }}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={data} margin={margin}>
              <defs>
                {series.map((s, i) => (
                  <linearGradient key={s.key} id={`${gradientBase}-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.22 }} />
                    <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
                  </linearGradient>
                ))}
              </defs>
              {axes}
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#${gradientBase}-${i})`}
                  activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--surface)", fill: s.color }}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      <ChartDataTable title={title} data={data} series={series} granularity={granularity} xKey={xKey} />
    </figure>
  );
}
