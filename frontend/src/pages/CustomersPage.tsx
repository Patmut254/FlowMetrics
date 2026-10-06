import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, SearchX, Users } from "lucide-react";
import {
  CHANNEL_OPTIONS,
  CustomerFormModal,
} from "@/components/CustomerFormModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilterSelect } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SortTh, Table, Td, Th } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { useApi } from "@/hooks/useApi";
import { useListParams } from "@/hooks/useListParams";
import { usePlans } from "@/hooks/usePlans";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate, humanize } from "@/lib/format";
import type { Customer, Paginated } from "@/types";

type StatusTab = "" | "active" | "trialing" | "past_due" | "churned";
const PAGE_SIZE = 12;

export function CustomersPage() {
  const navigate = useNavigate();
  const { values, set, page } = useListParams(
    ["search", "status", "plan", "channel"] as const,
    { ordering: "-joined_at" },
  );
  const [creating, setCreating] = useState(false);
  const plans = usePlans();

  const summary = useApi<Record<string, number>>(
    (signal) => api.get("/customers/summary/", undefined, signal),
    [],
  );
  const { data, error, loading, refetch } = useApi<Paginated<Customer>>(
    (signal) =>
      api.get(
        "/customers/",
        {
          search: values.search,
          status: values.status,
          plan: values.plan,
          channel: values.channel,
          ordering: values.ordering,
          page,
          page_size: PAGE_SIZE,
        },
        signal,
      ),
    [
      values.search,
      values.status,
      values.plan,
      values.channel,
      values.ordering,
      page,
    ],
  );

  const filtersActive = Boolean(
    values.search || values.status || values.plan || values.channel,
  );
  const counts = summary.data;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Every company subscribed to your product, with plan, revenue and lifecycle status."
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => setCreating(true)}
          >
            Add customer
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Tabs<StatusTab>
          label="Filter by status"
          className="px-3 pt-1"
          value={values.status as StatusTab}
          onChange={(status) => set({ status })}
          tabs={[
            { value: "", label: "All customers", count: counts?.total },
            { value: "active", label: "Active", count: counts?.active },
            { value: "trialing", label: "Trialing", count: counts?.trialing },
            { value: "past_due", label: "Past due", count: counts?.past_due },
            { value: "churned", label: "Churned", count: counts?.churned },
          ]}
        />

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={values.search}
            onChange={(search) => set({ search })}
            placeholder="Search company, contact or email"
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
              label="Filter by channel"
              value={values.channel}
              onChange={(channel) => set({ channel })}
              options={[
                { value: "", label: "All channels" },
                ...CHANNEL_OPTIONS,
              ]}
            />
          </div>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : !data ? (
          <TableSkeleton rows={8} cols={5} />
        ) : data.results.length === 0 ? (
          filtersActive ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No customers match your filters"
              description="Try a different search term or clear the filters."
              action={
                <Button
                  variant="secondary"
                  onClick={() =>
                    set({ search: "", status: "", plan: "", channel: "" })
                  }
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No customers yet"
              description="Add your first customer to start tracking subscriptions and revenue."
              action={
                <Button onClick={() => setCreating(true)}>Add customer</Button>
              }
            />
          )
        ) : (
          <div className={cn("transition-opacity", loading && "opacity-60")}>
            <Table>
              <thead>
                <tr>
                  <SortTh
                    label="Customer"
                    field="company_name"
                    ordering={values.ordering}
                    onSort={(ordering) => set({ ordering })}
                  />
                  <Th>Status</Th>
                  <Th>Plan</Th>
                  <SortTh
                    label="MRR"
                    field="mrr"
                    align="right"
                    ordering={values.ordering}
                    onSort={(ordering) => set({ ordering })}
                  />
                  <SortTh
                    label="Lifetime revenue"
                    field="lifetime_revenue"
                    align="right"
                    ordering={values.ordering}
                    onSort={(ordering) => set({ ordering })}
                  />
                  <Th>Channel</Th>
                  <SortTh
                    label="Joined"
                    field="joined_at"
                    ordering={values.ordering}
                    onSort={(ordering) => set({ ordering })}
                  />
                </tr>
              </thead>
              <tbody>
                {data.results.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="cursor-pointer hover:bg-surface-2"
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={customer.company_name} size="sm" />
                        <div className="min-w-0">
                          <Link
                            to={`/customers/${customer.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate font-semibold text-ink hover:underline"
                          >
                            {customer.company_name}
                          </Link>
                          <span className="block truncate text-xs text-muted">
                            {customer.contact_name} · {customer.country}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge status={customer.status} />
                    </Td>
                    <Td className="text-ink">
                      {customer.current_plan ?? (
                        <span className="text-muted">-</span>
                      )}
                    </Td>
                    <Td className="text-right font-semibold text-ink tabular">
                      {formatCurrency(customer.mrr)}
                    </Td>
                    <Td className="text-right text-ink-2 tabular">
                      {formatCurrency(customer.lifetime_revenue, {
                        cents: false,
                      })}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">
                      {humanize(customer.channel)}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">
                      {formatDate(customer.joined_at)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={data.page}
              totalPages={data.total_pages}
              count={data.count}
              pageSize={PAGE_SIZE}
              noun="customers"
              onChange={(next) => set({ page: String(next) })}
            />
          </div>
        )}
      </Card>

      <CustomerFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(customer) => navigate(`/customers/${customer.id}`)}
      />
    </div>
  );
}
