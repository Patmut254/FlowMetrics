import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Landmark,
  RotateCcw,
  SearchX,
  Wallet,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilterSelect } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SortTh, Table, Td, Th } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/context/ToastContext";
import { useApi } from "@/hooks/useApi";
import { useListParams } from "@/hooks/useListParams";
import { usePlans } from "@/hooks/usePlans";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { rangeFromPreset } from "@/lib/dates";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
  humanize,
} from "@/lib/format";
import type {
  Paginated,
  RangePreset,
  Transaction,
  TransactionSummary,
} from "@/types";

type StatusTab = "" | "paid" | "pending" | "failed" | "refunded";
const PAGE_SIZE = 15;

const METHOD_ICONS = {
  card: CreditCard,
  bank_transfer: Landmark,
  paypal: Wallet,
};

const PERIODS: { value: "" | RangePreset; label: string }[] = [
  { value: "", label: "Any time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

export function TransactionsPage() {
  const toast = useToast();
  const plans = usePlans();
  const [exporting, setExporting] = useState(false);
  const { values, set, page } = useListParams(
    ["search", "status", "method", "plan", "period"] as const,
    { ordering: "-occurred_at" },
  );

  const dates = values.period
    ? rangeFromPreset(values.period as RangePreset)
    : null;
  const filters = {
    search: values.search,
    status: values.status,
    method: values.method,
    plan: values.plan,
    start: dates?.start,
    end: dates?.end,
  };
  // Summary cards reflect every filter except status, so the tabs stay meaningful.
  const summaryFilters = { ...filters, status: undefined };
  const deps = [values.search, values.method, values.plan, values.period];

  const summary = useApi<TransactionSummary>(
    (signal) => api.get("/transactions/summary/", summaryFilters, signal),
    deps,
  );
  const list = useApi<Paginated<Transaction>>(
    (signal) =>
      api.get(
        "/transactions/",
        { ...filters, ordering: values.ordering, page, page_size: PAGE_SIZE },
        signal,
      ),
    [...deps, values.status, values.ordering, page],
  );

  const onExport = async () => {
    setExporting(true);
    try {
      await api.download(
        "/transactions/export/",
        { ...filters, ordering: values.ordering },
        "flowmetrics-transactions.csv",
      );
      toast.success("Export ready", "Transactions downloaded as CSV.");
    } catch (error) {
      toast.error("Export failed", (error as ApiError).message);
    } finally {
      setExporting(false);
    }
  };

  const s = summary.data;
  const cards = [
    {
      key: "paid",
      label: "Collected",
      icon: CheckCircle2,
      tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    {
      key: "pending",
      label: "Pending",
      icon: Clock3,
      tone: "text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300",
    },
    {
      key: "failed",
      label: "Failed",
      icon: XCircle,
      tone: "text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-300",
    },
    {
      key: "refunded",
      label: "Refunded",
      icon: RotateCcw,
      tone: "text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-300",
    },
  ] as const;
  const filtersActive = Boolean(
    values.search ||
    values.status ||
    values.method ||
    values.plan ||
    values.period,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Every payment attempt across your customer base."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="size-4" />}
            loading={exporting}
            onClick={onExport}
          >
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key} className="p-5">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg",
                  tone,
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="text-sm font-medium text-ink-2">{label}</p>
            </div>
            {s ? (
              <>
                <p className="mt-3 text-xl font-bold tracking-tight text-ink tabular">
                  {formatCurrency(s[key].amount, { cents: false })}
                </p>
                <p className="text-xs text-muted tabular">
                  {formatNumber(s[key].count)} transactions
                </p>
              </>
            ) : (
              <Skeleton className="mt-3 h-10 w-28" />
            )}
          </Card>
        ))}
        <Card className="col-span-2 p-5 lg:col-span-1">
          <p className="text-sm font-medium text-ink-2">Payment success rate</p>
          {s ? (
            <>
              <p className="mt-3 text-xl font-bold tracking-tight text-ink tabular">
                {formatPercent(s.success_rate)}
              </p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-[var(--chart-1)]"
                  style={{ width: `${s.success_rate}%` }}
                />
              </div>
            </>
          ) : (
            <Skeleton className="mt-3 h-10 w-24" />
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <Tabs<StatusTab>
          label="Filter by payment status"
          className="px-3 pt-1"
          value={values.status as StatusTab}
          onChange={(status) => set({ status })}
          tabs={[
            { value: "", label: "All", count: s?.total_count },
            { value: "paid", label: "Paid", count: s?.paid.count },
            { value: "pending", label: "Pending", count: s?.pending.count },
            { value: "failed", label: "Failed", count: s?.failed.count },
            { value: "refunded", label: "Refunded", count: s?.refunded.count },
          ]}
        />
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={values.search}
            onChange={(search) => set({ search })}
            placeholder="Search reference, customer or email"
            className="lg:max-w-xs lg:flex-1"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:ml-auto lg:flex">
            <FilterSelect
              label="Filter by period"
              value={values.period}
              onChange={(period) => set({ period })}
              options={PERIODS}
            />
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
              label="Filter by payment method"
              value={values.method}
              onChange={(method) => set({ method })}
              options={[
                { value: "", label: "All methods" },
                { value: "card", label: "Card" },
                { value: "bank_transfer", label: "Bank transfer" },
                { value: "paypal", label: "PayPal" },
              ]}
            />
          </div>
        </div>

        {list.error ? (
          <ErrorState message={list.error.message} onRetry={list.refetch} />
        ) : !list.data ? (
          <TableSkeleton rows={10} cols={5} />
        ) : list.data.results.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title={
              filtersActive
                ? "No transactions match your filters"
                : "No transactions yet"
            }
            description={
              filtersActive
                ? "Try a different period or clear the filters."
                : "Payments appear here once customers are billed."
            }
            action={
              filtersActive && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    set({
                      search: "",
                      status: "",
                      method: "",
                      plan: "",
                      period: "",
                    })
                  }
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div
            className={cn("transition-opacity", list.loading && "opacity-60")}
          >
            <Table>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <SortTh
                    label="Customer"
                    field="customer"
                    ordering={values.ordering}
                    onSort={(ordering) => set({ ordering })}
                  />
                  <Th>Subscription</Th>
                  <Th>Method</Th>
                  <SortTh
                    label="Date"
                    field="occurred_at"
                    ordering={values.ordering}
                    onSort={(ordering) => set({ ordering })}
                  />
                  <Th>Status</Th>
                  <SortTh
                    label="Amount"
                    field="amount"
                    align="right"
                    ordering={values.ordering}
                    onSort={(ordering) => set({ ordering })}
                  />
                </tr>
              </thead>
              <tbody>
                {list.data.results.map((txn) => {
                  const MethodIcon = METHOD_ICONS[txn.method];
                  return (
                    <tr key={txn.id} className="hover:bg-surface-2">
                      <Td className="font-mono text-xs text-ink-2">
                        {txn.reference}
                      </Td>
                      <Td>
                        <Link
                          to={`/customers/${txn.customer.id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar name={txn.customer.company_name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink hover:underline">
                              {txn.customer.company_name}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {txn.customer.email}
                            </span>
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <span className="text-ink">{txn.plan ?? "-"}</span>
                        {txn.billing_cycle && (
                          <span className="block text-xs text-muted">
                            {humanize(txn.billing_cycle)}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5 text-ink-2">
                          <MethodIcon
                            className="size-4 text-muted"
                            aria-hidden
                          />
                          {humanize(txn.method)}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-2">
                        {formatDateTime(txn.occurred_at)}
                      </Td>
                      <Td>
                        <StatusBadge status={txn.status} />
                      </Td>
                      <Td
                        className={cn(
                          "text-right font-semibold tabular",
                          txn.status === "paid" ? "text-ink" : "text-muted",
                        )}
                      >
                        {formatCurrency(txn.amount)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination
              page={list.data.page}
              totalPages={list.data.total_pages}
              count={list.data.count}
              pageSize={PAGE_SIZE}
              noun="transactions"
              onChange={(next) => set({ page: String(next) })}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
