import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Layers, Pencil, Plus, SearchX } from "lucide-react";
import { planColor } from "@/components/charts/theme";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanFormModal } from "@/components/PlanFormModal";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FilterSelect } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SortTh, Table, Td, Th } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useListParams } from "@/hooks/useListParams";
import { usePlans } from "@/hooks/usePlans";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  humanize,
} from "@/lib/format";
import type { Paginated, Plan, Subscription, SubscriptionStats } from "@/types";

type StatusTab = "" | "active" | "trialing" | "past_due" | "cancelled";
const PAGE_SIZE = 10;

function PlanCard({
  plan,
  index,
  canEdit,
  onEdit,
}: {
  plan: Plan;
  index: number;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const featured = plan.is_featured;
  const annualSaving =
    Number(plan.monthly_price) * 12 - Number(plan.annual_price);
  return (
    <Card
      className={cn(
        "relative flex flex-col p-5",
        featured && "hero-pattern border-transparent text-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ background: planColor(index) }}
            aria-hidden
          />
          <h3
            className={cn(
              "font-semibold",
              featured ? "text-white" : "text-ink",
            )}
          >
            {plan.name}
          </h3>
          {!plan.is_active && <Badge>Archived</Badge>}
          {featured && (
            <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-950">
              Popular
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={onEdit}
            className={cn(
              "rounded-lg p-1.5",
              featured
                ? "text-white/70 hover:bg-white/10 hover:text-white"
                : "text-muted hover:bg-surface-3 hover:text-ink",
            )}
            aria-label={`Edit ${plan.name} plan`}
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>
      <p
        className={cn(
          "mt-1 min-h-10 text-sm",
          featured ? "text-white/70" : "text-muted",
        )}
      >
        {plan.description}
      </p>
      <p className="mt-4">
        <span
          className={cn(
            "text-3xl font-bold tracking-tight tabular",
            featured ? "text-white" : "text-ink",
          )}
        >
          {formatCurrency(plan.monthly_price, { cents: false })}
        </span>
        <span
          className={cn("text-sm", featured ? "text-white/60" : "text-muted")}
        >
          /month
        </span>
      </p>
      <p
        className={cn(
          "mt-0.5 text-xs",
          featured ? "text-white/60" : "text-muted",
        )}
      >
        or {formatCurrency(plan.annual_price, { cents: false })}/year
        {annualSaving > 0 &&
          ` · save ${formatCurrency(annualSaving, { cents: false })}`}
      </p>
      <ul className="mt-4 flex-1 space-y-1.5">
        {plan.features.slice(0, 4).map((feature) => (
          <li
            key={feature}
            className={cn(
              "flex items-center gap-2 text-sm",
              featured ? "text-white/85" : "text-ink-2",
            )}
          >
            <Check
              className={cn(
                "size-4 shrink-0",
                featured
                  ? "text-brand-300"
                  : "text-brand-600 dark:text-brand-400",
              )}
              aria-hidden
            />
            {feature}
          </li>
        ))}
      </ul>
      <div
        className={cn(
          "mt-5 grid grid-cols-3 gap-2 border-t pt-4",
          featured ? "border-white/15" : "border-line",
        )}
      >
        {[
          { label: "Paying", value: formatNumber(plan.active_subscriptions) },
          { label: "Trials", value: formatNumber(plan.trialing_subscriptions) },
          {
            label: "MRR",
            value: formatCurrency(plan.mrr, { compact: true, cents: false }),
          },
        ].map((stat) => (
          <div key={stat.label}>
            <p
              className={cn(
                "text-[11px] font-medium",
                featured ? "text-white/60" : "text-muted",
              )}
            >
              {stat.label}
            </p>
            <p
              className={cn(
                "text-sm font-bold tabular",
                featured ? "text-white" : "text-ink",
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SubscriptionsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "owner" || user?.role === "admin";
  const plans = usePlans();
  const stats = useApi<SubscriptionStats>(
    (signal) => api.get("/subscriptions/stats/", undefined, signal),
    [],
  );
  const { values, set, page } = useListParams(
    ["search", "status", "plan", "billing_cycle"] as const,
    { ordering: "-started_at" },
  );
  const [editing, setEditing] = useState<Plan | null | undefined>(undefined);

  const list = useApi<Paginated<Subscription>>(
    (signal) =>
      api.get(
        "/subscriptions/",
        { ...values, page, page_size: PAGE_SIZE },
        signal,
      ),
    [
      values.search,
      values.status,
      values.plan,
      values.billing_cycle,
      values.ordering,
      page,
    ],
  );

  const s = stats.data;
  const live = s ? s.active + s.past_due : 0;
  const annualShare = s && live ? (s.annual / live) * 100 : 0;
  const filtersActive = Boolean(
    values.search || values.status || values.plan || values.billing_cycle,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Plans, billing cycles and the lifecycle of every subscription."
        actions={
          canEdit && (
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => setEditing(null)}
            >
              New plan
            </Button>
          )
        }
      />

      {/* Stats */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          {[
            {
              label: "Paying subscriptions",
              value: s ? formatNumber(live) : null,
              hint: s ? `${s.past_due} past due` : "",
            },
            {
              label: "On trial",
              value: s ? formatNumber(s.trialing) : null,
              hint: "Not yet billed",
            },
            {
              label: "Trial conversion",
              value: s ? formatPercent(s.trial_conversion_rate) : null,
              hint: "Last 30 days",
            },
            {
              label: "Cancelled",
              value: s ? formatNumber(s.cancelled_30d) : null,
              hint: "Paid subs, last 30 days",
            },
          ].map((stat) => (
            <div key={stat.label} className="px-5 py-4">
              <p className="text-xs font-medium text-muted">{stat.label}</p>
              {stat.value ? (
                <p className="mt-1 text-2xl font-bold tracking-tight text-ink tabular">
                  {stat.value}
                </p>
              ) : (
                <Skeleton className="mt-2 h-7 w-16" />
              )}
              <p className="mt-0.5 text-xs text-muted">{stat.hint}</p>
            </div>
          ))}
        </Card>
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-muted">Billing cycle mix</p>
            <p className="text-sm font-bold text-ink tabular">
              {s ? formatCurrency(s.mrr, { cents: false }) : "-"} MRR
            </p>
          </div>
          {s ? (
            <>
              <div
                className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
                aria-hidden
              >
                <div
                  className="rounded-l-full"
                  style={{
                    width: `${100 - annualShare}%`,
                    background: "var(--chart-1)",
                  }}
                />
                <div
                  className="rounded-r-full"
                  style={{
                    width: `${annualShare}%`,
                    background: "var(--chart-3)",
                  }}
                />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-muted">
                    <span
                      className="size-2 rounded-[2px]"
                      style={{ background: "var(--chart-1)" }}
                      aria-hidden
                    />{" "}
                    Monthly
                  </dt>
                  <dd className="font-semibold text-ink tabular">
                    {formatNumber(s.monthly)} ·{" "}
                    {formatCurrency(s.monthly_mrr, {
                      compact: true,
                      cents: false,
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-muted">
                    <span
                      className="size-2 rounded-[2px]"
                      style={{ background: "var(--chart-3)" }}
                      aria-hidden
                    />{" "}
                    Annual
                  </dt>
                  <dd className="font-semibold text-ink tabular">
                    {formatNumber(s.annual)} ·{" "}
                    {formatCurrency(s.annual_mrr, {
                      compact: true,
                      cents: false,
                    })}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <Skeleton className="mt-4 h-12 w-full" />
          )}
        </Card>
      </div>

      {/* Plans */}
      <section aria-labelledby="plans-heading">
        <h2
          id="plans-heading"
          className="mb-3 text-base font-semibold text-ink"
        >
          Subscription plans
        </h2>
        {plans.error ? (
          <Card>
            <ErrorState message={plans.error.message} onRetry={plans.refetch} />
          </Card>
        ) : !plans.data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : plans.data.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Layers className="size-6" />}
              title="No plans yet"
              description="Create your first plan to start subscribing customers."
              action={
                canEdit && (
                  <Button onClick={() => setEditing(null)}>
                    Create a plan
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {plans.data.map((plan, index) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                index={index}
                canEdit={canEdit}
                onEdit={() => setEditing(plan)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Subscriptions table */}
      <Card className="overflow-hidden">
        <CardHeader
          title="All subscriptions"
          subtitle="Filter by lifecycle stage, plan or billing cycle"
        />
        <Tabs<StatusTab>
          label="Filter by status"
          className="mt-3 px-3"
          value={values.status as StatusTab}
          onChange={(status) => set({ status })}
          tabs={[
            { value: "", label: "All" },
            { value: "active", label: "Active", count: s?.active },
            { value: "trialing", label: "Trial", count: s?.trialing },
            { value: "past_due", label: "Past due", count: s?.past_due },
            { value: "cancelled", label: "Cancelled", count: s?.cancelled },
          ]}
        />
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={values.search}
            onChange={(search) => set({ search })}
            placeholder="Search by customer"
            className="sm:max-w-xs sm:flex-1"
          />
          <div className="grid grid-cols-2 gap-3 sm:ml-auto sm:flex">
            <FilterSelect
              label="Filter by plan"
              value={values.plan}
              onChange={(plan) => set({ plan })}
              options={[
                { value: "", label: "All plans" },
                ...(plans.data ?? []).map((p) => ({
                  value: p.slug,
                  label: p.name,
                })),
              ]}
            />
            <FilterSelect
              label="Filter by billing cycle"
              value={values.billing_cycle}
              onChange={(billing_cycle) => set({ billing_cycle })}
              options={[
                { value: "", label: "Any cycle" },
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Annual" },
              ]}
            />
          </div>
        </div>

        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.refetch} />
        ) : !list.data ? (
          <TableSkeleton rows={6} />
        ) : list.data.results.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title={
              filtersActive
                ? "No subscriptions match these filters"
                : "No subscriptions yet"
            }
            description={
              filtersActive
                ? "Try adjusting the filters."
                : "Start a subscription from a customer's page."
            }
          />
        ) : (
          <div
            className={cn("transition-opacity", list.loading && "opacity-60")}
          >
            <Table>
              <thead>
                <tr>
                  <SortTh
                    label="Customer"
                    field="customer"
                    ordering={values.ordering}
                    onSort={(ordering) => set({ ordering })}
                  />
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <SortTh
                    label="MRR"
                    field="mrr"
                    align="right"
                    ordering={values.ordering}
                    onSort={(ordering) => set({ ordering })}
                  />
                  <SortTh
                    label="Started"
                    field="started_at"
                    ordering={values.ordering}
                    onSort={(ordering) => set({ ordering })}
                  />
                  <Th>Renews / ends</Th>
                </tr>
              </thead>
              <tbody>
                {list.data.results.map((sub) => (
                  <tr key={sub.id} className="hover:bg-surface-2">
                    <Td>
                      <Link
                        to={`/customers/${sub.customer.id}`}
                        className="flex items-center gap-3"
                      >
                        <Avatar name={sub.customer.company_name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink hover:underline">
                            {sub.customer.company_name}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {sub.customer.email}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <span className="font-medium text-ink">
                        {sub.plan.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {humanize(sub.billing_cycle)}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={sub.status} />
                    </Td>
                    <Td className="text-right font-semibold text-ink tabular">
                      {formatCurrency(sub.mrr)}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">
                      {formatDate(sub.started_at)}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">
                      {sub.cancelled_at ? (
                        <span>Ended {formatDate(sub.cancelled_at)}</span>
                      ) : sub.status === "trialing" ? (
                        <span>Trial ends {formatDate(sub.trial_ends_at)}</span>
                      ) : (
                        formatDate(sub.current_period_end)
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={list.data.page}
              totalPages={list.data.total_pages}
              count={list.data.count}
              pageSize={PAGE_SIZE}
              noun="subscriptions"
              onChange={(next) => set({ page: String(next) })}
            />
          </div>
        )}
      </Card>

      <PlanFormModal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        plan={editing}
        onSaved={() => {
          plans.refetch();
          stats.refetch();
        }}
      />
    </div>
  );
}
