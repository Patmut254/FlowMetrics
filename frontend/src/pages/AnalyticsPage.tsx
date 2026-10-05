import { BarList } from "@/components/charts/BarList";
import { CohortHeatmap } from "@/components/charts/CohortHeatmap";
import { MovementChart } from "@/components/charts/MovementChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { SERIES, planColor } from "@/components/charts/theme";
import { DateRangePicker } from "@/components/DateRangePicker";
import { StatTile } from "@/components/dashboard/KpiCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Delta } from "@/components/ui/Delta";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Table, Td, Th } from "@/components/ui/Table";
import { useDateRange } from "@/context/DateRangeContext";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { AnalyticsData } from "@/types";

function Block({ height = 280 }: { height?: number }) {
  return <Skeleton className="w-full rounded-xl" style={{ height }} />;
}

export function AnalyticsPage() {
  const { range, setRange } = useDateRange();
  const { data, error, loading, refetch } = useApi<AnalyticsData>(
    (signal) => api.get("/analytics/", { start: range.start, end: range.end }, signal),
    [range.start, range.end],
  );

  const points = data?.series.points ?? [];
  const granularity = data?.series.granularity ?? "month";
  const h = data?.health;
  const k = data?.kpis;
  const m = h?.movements;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Revenue trends, acquisition, retention and plan economics — computed live from your billing data."
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      {error && !data ? (
        <Card>
          <ErrorState message={error.message} onRetry={refetch} />
        </Card>
      ) : (
        <div className={cn("space-y-6 transition-opacity", loading && data && "opacity-70")}>
          {/* SaaS health */}
          <Card className="grid grid-cols-2 divide-line sm:grid-cols-3 xl:grid-cols-6 xl:divide-x">
            {h && k ? (
              <>
                <StatTile label="MRR growth" value={formatPercent(h.mrr_growth)} hint={`${formatCurrency(h.start_mrr, { compact: true })} → ${formatCurrency(h.end_mrr, { compact: true })}`} />
                <StatTile label="Net revenue retention" value={formatPercent(h.net_revenue_retention)} hint="Existing MRR kept + expanded" />
                <StatTile label="SaaS quick ratio" value={h.quick_ratio === null ? "—" : `${h.quick_ratio.toFixed(2)}×`} hint="Gains ÷ losses (4× is great)" />
                <StatTile label="Customer LTV" value={h.ltv === null ? "—" : formatCurrency(h.ltv, { compact: true })} hint="ARPU ÷ monthly churn" />
                <StatTile label="Monthly churn" value={formatPercent(h.monthly_churn, 2)} change={k.churn_rate.change} inverse hint="Paying customers lost" />
                <StatTile label="Trial conversion" value={formatPercent(k.conversion_rate.value)} change={k.conversion_rate.change} hint="Trials ending in period" />
              </>
            ) : (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-6 w-16" />
                </div>
              ))
            )}
          </Card>

          {/* MRR growth */}
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="MRR growth"
                subtitle="Monthly recurring revenue at the end of each period"
                action={k && <Delta value={k.mrr.change} />}
              />
              <div className="px-3 pt-4 pb-4 sm:px-5">
                {data ? (
                  <TrendChart title="MRR growth" data={points as never} granularity={granularity} format="currency" series={[{ key: "mrr", label: "MRR", color: SERIES[0], format: "currency" }]} />
                ) : (
                  <Block />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader
                title="MRR movements"
                subtitle={m ? `Net new ${formatCurrency(m.net_new, { cents: false })} in this period` : "What drove MRR up or down"}
              />
              <div className="px-3 pt-4 pb-4 sm:px-5">{data ? <MovementChart points={points} granularity={granularity} height={252} /> : <Block />}</div>
            </Card>
          </div>

          {/* Revenue + acquisition */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Revenue trend" subtitle="Cash collected from paid invoices" action={k && <Delta value={k.total_revenue.change} />} />
              <div className="px-3 pt-4 pb-4 sm:px-5">
                {data ? (
                  <TrendChart title="Revenue trend" type="bar" data={points as never} granularity={granularity} format="currency" series={[{ key: "revenue", label: "Revenue", color: SERIES[0], format: "currency" }]} />
                ) : (
                  <Block />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Acquisition by channel" subtitle="Sign-ups in period and share that became paying" />
              <div className="p-5">
                {data ? (
                  data.acquisition.some((a) => a.customers > 0) ? (
                    <BarList
                      items={data.acquisition.map((a) => ({
                        key: a.channel,
                        label: a.label,
                        value: a.customers,
                        display: formatNumber(a.customers),
                        secondary: `${formatPercent(a.conversion_rate, 0)} paid`,
                      }))}
                    />
                  ) : (
                    <EmptyState title="No sign-ups in this period" className="py-8" />
                  )
                ) : (
                  <Block height={220} />
                )}
              </div>
            </Card>
          </div>

          {/* Customers & churn */}
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Customer acquisition" subtitle="New sign-ups versus paying customers lost" />
              <div className="px-3 pt-4 pb-4 sm:px-5">
                {data ? (
                  <TrendChart
                    title="Customer acquisition"
                    type="bar"
                    data={points as never}
                    granularity={granularity}
                    height={252}
                    series={[
                      { key: "new_customers", label: "New sign-ups", color: SERIES[0] },
                      { key: "churned_customers", label: "Churned", color: SERIES[1] },
                    ]}
                  />
                ) : (
                  <Block />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Churn rate" subtitle="Share of paying customers lost per period" action={k && <Delta value={k.churn_rate.change} inverse />} />
              <div className="px-3 pt-4 pb-4 sm:px-5">
                {data ? (
                  <TrendChart title="Churn rate" type="line" data={points as never} granularity={granularity} format="percent" series={[{ key: "churn_rate", label: "Churn rate", color: SERIES[1], format: "percent" }]} />
                ) : (
                  <Block />
                )}
              </div>
            </Card>
          </div>

          {/* Retention + funnel */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Customer retention" subtitle="Share of each sign-up cohort still subscribed, by months since joining" />
              <div className="p-5">{data ? <CohortHeatmap rows={data.retention} /> : <Block height={240} />}</div>
            </Card>
            <Card>
              <CardHeader title="Conversion funnel" subtitle="Customers who signed up in this period" />
              <div className="space-y-3 p-5">
                {data
                  ? data.funnel.map((step, i) => (
                      <div key={step.stage}>
                        <div className="mb-1.5 flex items-baseline justify-between text-sm">
                          <span className="font-medium text-ink">{step.stage}</span>
                          <span className="tabular">
                            <span className="font-semibold text-ink">{formatNumber(step.count)}</span>
                            <span className="ml-1.5 text-xs text-muted">{formatPercent(step.rate, 0)}</span>
                          </span>
                        </div>
                        <div className="h-8 overflow-hidden rounded-lg bg-surface-3" aria-hidden>
                          <div
                            className="h-full rounded-lg"
                            style={{
                              width: `${Math.max(step.rate, 2)}%`,
                              background: `color-mix(in oklab, var(--chart-1) ${100 - i * 18}%, var(--surface))`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            </Card>
          </div>

          {/* Plan performance */}
          <Card className="overflow-hidden">
            <CardHeader title="Plan performance" subtitle="Subscriber growth, revenue and churn by plan for the selected period" className="pb-4" />
            {data ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Plan</Th>
                    <Th className="text-right">Subscribers</Th>
                    <Th className="text-right">MRR</Th>
                    <Th className="text-right">ARPA</Th>
                    <Th className="text-right">Revenue</Th>
                    <Th className="text-right">New</Th>
                    <Th className="text-right">Churned</Th>
                    <Th className="text-right">Monthly churn</Th>
                    <Th className="text-right">Trial conv.</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.plan_performance.map((p, i) => (
                    <tr key={p.slug} className="hover:bg-surface-2">
                      <Td>
                        <span className="flex items-center gap-2 font-semibold text-ink">
                          <span className="size-2.5 rounded-[3px]" style={{ background: planColor(i) }} aria-hidden />
                          {p.plan}
                        </span>
                        <span className="text-xs text-muted">{formatCurrency(p.monthly_price, { cents: false })}/mo</span>
                      </Td>
                      <Td className="text-right">
                        <span className="font-semibold text-ink tabular">{formatNumber(p.subscribers)}</span>
                        <span className="ml-2">
                          <Delta value={p.subscriber_change} />
                        </span>
                      </Td>
                      <Td className="text-right font-semibold text-ink tabular">{formatCurrency(p.mrr, { cents: false })}</Td>
                      <Td className="text-right text-ink-2 tabular">{formatCurrency(p.arpa)}</Td>
                      <Td className="text-right text-ink-2 tabular">{formatCurrency(p.revenue, { cents: false })}</Td>
                      <Td className="text-right text-ink-2 tabular">{formatNumber(p.new_subscriptions)}</Td>
                      <Td className="text-right text-ink-2 tabular">{formatNumber(p.churned_subscriptions)}</Td>
                      <Td className="text-right text-ink-2 tabular">{formatPercent(p.churn_rate, 2)}</Td>
                      <Td className="text-right text-ink-2 tabular">{formatPercent(p.trial_conversion)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
