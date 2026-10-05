import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Globe2, Mail, MoreHorizontal, Pencil, Repeat, Trash2, UserRound, XCircle } from "lucide-react";
import { TrendChart } from "@/components/charts/TrendChart";
import { SERIES } from "@/components/charts/theme";
import { CustomerFormModal } from "@/components/CustomerFormModal";
import { TransactionsTable } from "@/components/dashboard/TransactionsTable";
import { CancelModal, PlanModal } from "@/components/SubscriptionModals";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { MenuItem, Popover } from "@/components/ui/Controls";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/context/ToastContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, humanize, parseDate } from "@/lib/format";
import type { CustomerDetail, Paginated, Subscription, Transaction } from "@/types";

function tenure(joined: string, churned: string | null) {
  const start = parseDate(joined);
  const end = churned ? parseDate(churned) : new Date();
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (months < 1) return "Less than a month";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} yr${years === 1 ? "" : "s"}${rest ? ` ${rest} mo` : ""}`;
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate text-sm font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [txPage, setTxPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [planModal, setPlanModal] = useState<"start" | "change" | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const customer = useApi<CustomerDetail>((signal) => api.get(`/customers/${id}/`, undefined, signal), [id]);
  const transactions = useApi<Paginated<Transaction>>(
    (signal) => api.get(`/customers/${id}/transactions/`, { page: txPage, page_size: 8 }, signal),
    [id, txPage],
  );

  const refreshAll = () => {
    customer.refetch();
    transactions.refetch();
  };

  if (customer.error) {
    return (
      <Card>
        <ErrorState
          message={customer.error.status === 404 ? "This customer doesn't exist or belongs to another workspace." : customer.error.message}
          onRetry={customer.error.status === 404 ? undefined : customer.refetch}
        />
        <div className="pb-8 text-center">
          <Link to="/customers" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
            Back to customers
          </Link>
        </div>
      </Card>
    );
  }

  const data = customer.data;
  const live: Subscription | undefined = data?.subscriptions.find((s) => s.status !== "cancelled");

  const onDelete = async () => {
    setDeleteBusy(true);
    try {
      await api.delete(`/customers/${id}/`);
      toast.success("Customer deleted", data?.company_name);
      navigate("/customers", { replace: true });
    } catch (err) {
      toast.error("Couldn't delete customer", (err as ApiError).message);
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Customers
      </Link>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="hero-pattern h-20" aria-hidden />
        <div className="flex flex-col gap-5 px-6 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            {data ? (
              <Avatar name={data.company_name} size="lg" className="-mt-7 ring-4 ring-surface" />
            ) : (
              <Skeleton className="-mt-7 size-14 rounded-full ring-4 ring-surface" />
            )}
            <div className="pt-3">
              {data ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{data.company_name}</h1>
                    <StatusBadge status={data.status} />
                  </div>
                  <p className="text-sm text-muted">
                    {data.industry || "—"} · Customer since {formatDate(data.joined_at)}
                  </p>
                </>
              ) : (
                <>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="mt-2 h-4 w-32" />
                </>
              )}
            </div>
          </div>
          {data && (
            <div className="flex flex-wrap items-center gap-2">
              {live ? (
                <>
                  <Button variant="secondary" icon={<Repeat className="size-4" />} onClick={() => setPlanModal("change")}>
                    Change plan
                  </Button>
                  <Button variant="secondary" icon={<XCircle className="size-4" />} onClick={() => setCancelling(true)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button icon={<Repeat className="size-4" />} onClick={() => setPlanModal("start")}>
                  Start subscription
                </Button>
              )}
              <Popover
                className="w-48"
                trigger={({ toggle, open }) => (
                  <Button variant="secondary" size="icon" onClick={toggle} aria-expanded={open} aria-label="More actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                )}
              >
                {(close) => (
                  <>
                    <MenuItem icon={<Pencil className="size-4" />} onClick={() => { close(); setEditing(true); }}>
                      Edit details
                    </MenuItem>
                    <MenuItem icon={<Trash2 className="size-4" />} danger onClick={() => { close(); setDeleting(true); }}>
                      Delete customer
                    </MenuItem>
                  </>
                )}
              </Popover>
            </div>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Current MRR", value: data ? formatCurrency(data.mrr) : null, hint: live ? `${live.plan.name} · ${humanize(live.billing_cycle)}` : "No live subscription" },
          { label: "Lifetime revenue", value: data ? formatCurrency(data.lifetime_revenue, { cents: false }) : null, hint: "Paid invoices" },
          { label: "Tenure", value: data ? tenure(data.joined_at, data.churned_at) : null, hint: data?.churned_at ? `Churned ${formatDate(data.churned_at)}` : "And counting" },
          { label: "Payments", value: data ? `${data.payment_stats.paid} paid` : null, hint: data ? `${data.payment_stats.failed} failed attempts` : "" },
        ].map((stat) => (
          <Card key={stat.label} className="p-5">
            <p className="text-xs font-medium text-muted">{stat.label}</p>
            {stat.value ? <p className="mt-1 text-xl font-bold tracking-tight text-ink tabular">{stat.value}</p> : <Skeleton className="mt-2 h-6 w-24" />}
            <p className="mt-1 truncate text-xs text-muted">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue history" subtitle="Paid invoices over the last 12 months" />
          <div className="h-[270px] px-3 pt-4 pb-4 sm:px-5">
            {data && data.revenue_history.every((r) => Number(r.revenue) === 0) ? (
              <EmptyState
                title="No payments in the last 12 months"
                description={live?.billing_cycle === "annual" ? "This customer is billed annually — the next invoice is due at renewal." : undefined}
              />
            ) : data ? (
              <TrendChart
                title="Customer revenue history"
                type="bar"
                format="currency"
                granularity="month"
                height={250}
                xKey="month"
                data={data.revenue_history.map((r) => ({ month: r.month, revenue: Number(r.revenue) }))}
                series={[{ key: "revenue", label: "Revenue", color: SERIES[0], format: "currency" }]}
              />
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Company details" />
          <div className="space-y-4 p-5">
            {data ? (
              <>
                <DetailItem icon={<UserRound className="size-4" />} label="Primary contact" value={data.contact_name} />
                <DetailItem icon={<Mail className="size-4" />} label="Billing email" value={<a href={`mailto:${data.email}`} className="hover:underline">{data.email}</a>} />
                <DetailItem icon={<Globe2 className="size-4" />} label="Country" value={data.country} />
                <DetailItem icon={<Building2 className="size-4" />} label="Company size" value={`${data.company_size} employees`} />
                <DetailItem icon={<Repeat className="size-4" />} label="Acquired via" value={humanize(data.channel)} />
                {data.notes && <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">{data.notes}</p>}
              </>
            ) : (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
            )}
          </div>
        </Card>
      </div>

      {/* Subscriptions */}
      <Card>
        <CardHeader title="Subscription history" subtitle="Every plan this customer has been on" />
        <div className="p-5">
          {!data ? (
            <Skeleton className="h-24 w-full" />
          ) : data.subscriptions.length === 0 ? (
            <EmptyState title="No subscriptions yet" description="Start a subscription to begin billing this customer." className="py-8" />
          ) : (
            <ol className="relative space-y-4 border-l border-line pl-6">
              {data.subscriptions.map((sub) => (
                <li key={sub.id} className="relative">
                  <span
                    className={`absolute top-1.5 -left-[29px] size-2.5 rounded-full ring-4 ring-surface ${sub.status === "cancelled" ? "bg-line-strong" : "bg-brand-500"}`}
                    aria-hidden
                  />
                  <div className="flex flex-col gap-2 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{sub.plan.name}</p>
                        <StatusBadge status={sub.status} />
                        <span className="text-xs text-muted">{humanize(sub.billing_cycle)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Started {formatDate(sub.started_at)}
                        {sub.trial_ends_at && ` · Trial ${sub.activated_at ? "ended" : "ends"} ${formatDate(sub.trial_ends_at)}`}
                        {sub.cancelled_at && ` · Ended ${formatDate(sub.cancelled_at)}`}
                        {sub.cancel_reason && ` · ${sub.cancel_reason}`}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-bold text-ink tabular">
                        {formatCurrency(sub.price)}
                        <span className="text-xs font-medium text-muted">/{sub.billing_cycle === "annual" ? "yr" : "mo"}</span>
                      </p>
                      <p className="text-xs text-muted tabular">{formatCurrency(sub.mrr)} MRR</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      {/* Transactions */}
      <Card className="overflow-hidden">
        <CardHeader title="Transactions" subtitle="All payment attempts for this customer" className="pb-4" />
        {transactions.error ? (
          <ErrorState message={transactions.error.message} onRetry={transactions.refetch} />
        ) : !transactions.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : transactions.data.results.length === 0 ? (
          <EmptyState title="No transactions yet" />
        ) : (
          <>
            <TransactionsTable transactions={transactions.data.results} showCustomer={false} />
            <Pagination
              page={transactions.data.page}
              totalPages={transactions.data.total_pages}
              count={transactions.data.count}
              pageSize={8}
              noun="transactions"
              onChange={setTxPage}
            />
          </>
        )}
      </Card>

      {data && (
        <>
          <CustomerFormModal open={editing} onClose={() => setEditing(false)} customer={data} onSaved={() => customer.refetch()} />
          <PlanModal
            open={planModal !== null}
            onClose={() => setPlanModal(null)}
            customerId={data.id}
            current={planModal === "change" ? live : null}
            onDone={refreshAll}
          />
          <CancelModal open={cancelling} onClose={() => setCancelling(false)} subscription={live ?? null} onDone={refreshAll} />
          <Modal
            open={deleting}
            onClose={() => setDeleting(false)}
            size="sm"
            title={`Delete ${data.company_name}?`}
            description="This permanently removes the customer with all of its subscriptions and transactions. Metrics will be recalculated without them."
            footer={
              <>
                <Button variant="secondary" onClick={() => setDeleting(false)}>
                  Keep customer
                </Button>
                <Button variant="danger" loading={deleteBusy} onClick={onDelete}>
                  Delete permanently
                </Button>
              </>
            }
          >
            <p className="text-sm text-ink-2">This action can't be undone.</p>
          </Modal>
        </>
      )}
    </div>
  );
}
