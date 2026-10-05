import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

/** Decorative trend line for KPI cards. The card's number and delta carry the meaning. */
export function Sparkline({ values, color = "var(--chart-1)" }: { values: number[]; color?: string }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const data = values.map((value, index) => ({ index, value }));
  return (
    <div className="h-10 w-24" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.25 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
