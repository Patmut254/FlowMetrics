import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleDollarSign, Download, Repeat, UserMinus, Users } from "lucide-react";
import { BarList } from "@/components/charts/BarList";
import { DonutChart } from "@/components/charts/DonutChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { SERIES, planColor } from "@/components/charts/theme";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { KpiCard, KpiCardSkeleton, StatTile } from "@/components/dashboard/KpiCard";
import { TransactionsTable } from "@/components/dashboard/TransactionsTable";
import { DateRangePicker } from "@/components/DateRangePicker";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Controls";
import { Delta } from "@/components/ui/Delta";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useAuth } from "@/context/AuthContext";
import { useDateRange } from "@/context/DateRangeContext";
import { useToast } from "@/context/ToastContext";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import { describeRange } from "@/lib/dates";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { DashboardData } from "@/types";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function ChartSkeleton() {
  return <Skeleton className="h-full w-full rounded-xl" />;
}

export function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { range, setRange } = useDateRange();
  const [revenueMetric, setRevenueMetric] = useState<"revenue" | "mrr">("revenue");
  const [customerView, setCustomerView] = useState<"active" | "flow">("active");

  const { data, error, loading, refetch } = useApi<DashboardData>(
    (signal) => api.get("/dashboard/", { start: range.start, end: range.end }, signal),
    [range.start, range.end],
  );

  const kpis = data?.kpis;
  const points = data?.series.points ?? [];
  const granularity = data?.series.granularity ?? "day";
  const hasData = Boolean(data && (points.some((p) => p.revenue > 0 || p.active_customers > 0) || data.recent_transactions.length));

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`flowmetrics-dashboard-${range.start}-to-${range.end}.csv`, [
      ["Period", "Revenue", "MRR", "Active customers", "New customers", "Churned customers"],
      ...points.map((p) => [p.date, p.revenue, p.mrr, p.active_customers, p.new_customers, p.churned_customers]),
    ]);
    toast.success("Export ready", "Dashboard data downloaded as CSV.");
  };

  const firstName = user?.first_name || "there";

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
            {greeting()}, {firstName}
          </p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">{user?.organization?.name ?? "Your workspace"} overview</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <span>{describeRange(range)}</span>
            {kpis && (
              <>
                <span aria-hidden className="text-muted">·</span>
                <span className="inline-flex items-center gap-1.5">
                  Revenue <Delta value={kpis.revenue_growth} />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  Customers <Delta value={kpis.customer_growth} />
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <Button icon={<Download className="size-4" />} onClick={exportCsv} disabled={!data}>
            Export
          </Button>
        </div>
      </section>

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!kpis ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total revenue"
              value={formatCurrency(kpis.total_revenue.value, { cents: false })}
              change={kpis.total_revenue.change}
              icon={<CircleDollarSign className="size-5" />}
              trend={points.map((p) => p.revenue)}
            />
            <KpiCard
              label="Monthly recurring revenue"
              value={formatCurrency(kpis.mrr.value, { cents: false })}
              change={kpis.mrr.change}
              icon={<Repeat className="size-5" />}
              trend={points.map((p) => p.mrr)}
            />
            <KpiCard
              label="Active customers"
              value={formatNumber(kpis.active_customers.value)}
              change={kpis.active_customers.change}
              icon={<Users className="size-5" />}
              trend={points.map((p) => p.active_customers)}
            />
            <KpiCard
              label="Churn rate"
              value={formatPercent(kpis.churn_rate.value, 2)}
              change={kpis.churn_rate.change}
              inverse
              icon={<UserMinus className="size-5" />}
              footnote="monthly, vs previous"
            />
          </>
        )}
      </section>

      {error && !data ? (
        <Card>
          <ErrorState message={error.message} onRetry={refetch} />
        </Card>
      ) : (
        <>
          {/* Secondary metrics strip */}
          <Card className={cn("grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x", loading && data && "opacity-70 transition-opacity")}>
            {kpis ? (
              <>
                <StatTile label="New customers" value={formatNumber(kpis.new_customers.value)} change={kpis.new_customers.change} hint="Sign-ups in period" />
                <StatTile label="Trial conversion" value={formatPercent(kpis.conversion_rate.value)} change={kpis.conversion_rate.change} hint="Trials ending in period" />
                <StatTile label="ARPU" value={formatCurrency(kpis.arpu.value)} change={kpis.arpu.change} hint="Avg. revenue per paying customer" />
                <StatTile label="ARR run-rate" value={formatCurrency(kpis.arr.value, { compact: true })} change={kpis.arr.change} hint="MRR × 12" />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-6 w-24" />
                </div>
              ))
            )}
          </Card>

          {data && !hasData ? (
            <Card>
              <EmptyState
                title="No data in this date range"
                description="Try a wider range, or add customers and subscriptions to start tracking revenue."
                action={
                  <Link to="/customers">
                    <Button>Add your first customer</Button>
                  </Link>
                }
              />
            </Card>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="flex flex-col lg:col-span-2">
                  <CardHeader
                    title={revenueMetric === "revenue" ? "Revenue over time" : "MRR over time"}
                    subtitle={revenueMetric === "revenue" ? "Collected payments per period" : "Recurring revenue at the end of each period"}
                    action={
                      <Segmented
                        label="Revenue metric"
                        size="sm"
                        value={revenueMetric}
                        onChange={setRevenueMetric}
                        options={[
                          { value: "revenue", label: "Revenue" },
                          { value: "mrr", label: "MRR" },
                        ]}
                      />
                    }
                  />
                  <div className="min-h-[300px] flex-1 px-3 pt-4 pb-4 sm:px-5">
                    {data ? (
                      <TrendChart
                        title={revenueMetric === "revenue" ? "Revenue over time" : "MRR over time"}
                        data={points as never}
                        granularity={granularity}
                        type={revenueMetric === "revenue" ? "bar" : "area"}
                        format="currency"
                        height="fill"
                        series={[{ key: revenueMetric, label: revenueMetric === "revenue" ? "Revenue" : "MRR", color: SERIES[0], format: "currency" }]}
                      />
                    ) : (
                      <ChartSkeleton />
                    )}
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Revenue by plan" subtitle="Share of MRR at end of period" />
                  <div className="p-5">
                    {data ? (
                      data.plan_breakdown.some((p) => p.mrr > 0) ? (
                        <DonutChart
                          title="MRR by plan"
                          centerLabel="Total MRR"
                          centerValue={formatCurrency(kpis?.mrr.value ?? 0, { compact: true })}
                          data={data.plan_breakdown.map((p, i) => ({
                            key: p.slug,
                            label: p.plan,
                            value: p.mrr,
                            color: planColor(i),
                            detail: `${formatNumber(p.subscriptions)} subscriptions`,
                          }))}
                        />
                      ) : (
                        <EmptyState title="No paying subscriptions" className="py-8" />
                      )
                    ) : (
                      <Skeleton className="mx-auto size-44 rounded-full" />
                    )}
                  </div>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="flex flex-col lg:col-span-2">
                  <CardHeader
                    title="Customer growth"
                    subtitle={customerView === "active" ? "Paying customers at the end of each period" : "New sign-ups and paying customers lost"}
                    action={
                      <Segmented
                        label="Customer view"
                        size="sm"
                        value={customerView}
                        onChange={setCustomerView}
                        options={[
                          { value: "active", label: "Active" },
                          { value: "flow", label: "New vs churned" },
                        ]}
                      />
                    }
                  />
                  <div className="min-h-[300px] flex-1 px-3 pt-4 pb-4 sm:px-5">
                    {data ? (
                      customerView === "active" ? (
                        <TrendChart
                          title="Active customers"
                          data={points as never}
                          granularity={granularity}
                          type="line"
                          height="fill"
                          series={[{ key: "active_customers", label: "Active customers", color: SERIES[0] }]}
                        />
                      ) : (
                        <TrendChart
                          title="New vs churned customers"
                          data={points as never}
                          granularity={granularity}
                          type="bar"
                          height="fill"
                          series={[
                            { key: "new_customers", label: "New", color: SERIES[0] },
                            { key: "churned_customers", label: "Churned", color: SERIES[1] },
                          ]}
                        />
                      )
                    ) : (
                      <ChartSkeleton />
                    )}
                  </div>
                </Card>

                <Card>
                  <CardHeader
                    title="Top plans"
                    subtitle="Ranked by MRR"
                    action={
                      <Link to="/subscriptions" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                        View plans
                      </Link>
                    }
                  />
                  <div className="p-5">
                    {data ? (
                      <BarList
                        items={data.top_plans.map((p) => ({
                          key: p.slug,
                          label: p.plan,
                          value: p.mrr,
                          display: formatCurrency(p.mrr, { cents: false }),
                          secondary: `${formatNumber(p.subscribers)} subs`,
                        }))}
                      />
                    ) : (
                      <div className="space-y-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    )}
                    {data && (
                      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-4">
                        {data.top_plans.slice(0, 2).map((p) => (
                          <div key={p.slug}>
                            <p className="text-xs text-muted">{p.plan} subscribers</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-base font-bold text-ink tabular">{formatNumber(p.subscribers)}</span>
                              <Delta value={p.subscriber_change} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="overflow-hidden lg:col-span-2">
                  <CardHeader
                    title="Recent transactions"
                    subtitle="Latest payment activity"
                    className="pb-4"
                    action={
                      <Link to="/transactions">
                        <Button variant="secondary" size="sm" icon={<ArrowRight className="size-3.5" />} className="flex-row-reverse">
                          View all
                        </Button>
                      </Link>
                    }
                  />
                  {data ? (
                    data.recent_transactions.length ? (
                      <TransactionsTable transactions={data.recent_transactions} showReference={false} />
                    ) : (
                      <EmptyState title="No transactions yet" />
                    )
                  ) : (
                    <div className="space-y-3 p-5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  )}
                </Card>

                <Card>
                  <CardHeader title="Customer activity" subtitle="Lifecycle events across your base" className="pb-3" />
                  {data ? (
                    <ActivityFeed events={data.activity} />
                  ) : (
                    <div className="space-y-3 p-5">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
