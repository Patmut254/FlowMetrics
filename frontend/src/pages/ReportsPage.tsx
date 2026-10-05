import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Download, FileText, Layers, Plus, Trash2, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Table, Td, Th } from "@/components/ui/Table";
import { useToast } from "@/context/ToastContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { rangeFromPreset, toISO } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Paginated, Report, ReportType } from "@/types";

export const REPORT_TYPES: { value: ReportType; label: string; description: string; icon: LucideIcon }[] = [
  { value: "executive", label: "Executive summary", description: "Headline KPIs, MRR trend and plan performance for leadership.", icon: BarChart3 },
  { value: "revenue", label: "Revenue report", description: "Revenue collected, MRR movements and payment outcomes.", icon: TrendingUp },
  { value: "customers", label: "Customer report", description: "Acquisition by channel, churn and the conversion funnel.", icon: Users },
  { value: "subscriptions", label: "Subscription report", description: "Plan mix, billing cycles and trial conversion.", icon: Layers },
];

const PERIODS = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "custom", label: "Custom range" },
] as const;

type Period = (typeof PERIODS)[number]["value"];

function GenerateModal({ open, onClose, initialType }: { open: boolean; onClose: () => void; initialType: ReportType }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [type, setType] = useState<ReportType>(initialType);
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<Period>("90d");
  const [custom, setCustom] = useState({ start: "", end: toISO(new Date()) });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);

  // Reset when the modal is reopened, possibly from a different template.
  useEffect(() => {
    if (open) {
      setType(initialType);
      setName("");
      setErrors({});
    }
  }, [open, initialType]);

  const typeLabel = REPORT_TYPES.find((t) => t.value === type)?.label ?? "Report";

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const range = period === "custom" ? custom : rangeFromPreset(period);
    const next: Record<string, string> = {};
    const finalName = name.trim() || `${typeLabel} — ${PERIODS.find((p) => p.value === period)?.label}`;
    if (finalName.length < 3) next.name = "Name must be at least 3 characters.";
    if (!range.start) next.start = "Choose a start date.";
    if (range.start && range.end && range.start > range.end) next.end = "End date must be after the start date.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const report = await api.post<Report>("/reports/", {
        name: finalName,
        report_type: type,
        period_start: range.start,
        period_end: range.end,
      });
      toast.success("Report generated", finalName);
      onClose();
      navigate(`/reports/${report.id}`);
    } catch (error) {
      const err = error as ApiError;
      setErrors({ name: err.field?.("name"), start: err.field?.("period_start"), end: err.field?.("period_end"), form: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Generate a report"
      description="Figures are calculated from your data now and saved with the report."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="report-form" loading={saving}>
            Generate report
          </Button>
        </>
      }
    >
      <form id="report-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        {errors.form && !errors.name && !errors.start && !errors.end && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {errors.form}
          </p>
        )}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Report type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REPORT_TYPES.map(({ value, label, description, icon: Icon }) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                  type === value ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500 dark:bg-brand-500/10" : "border-line hover:bg-surface-2",
                )}
              >
                <input type="radio" name="report-type" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
                <Icon className="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-ink">{label}</span>
                  <span className="block text-xs text-muted">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Input label="Report name" placeholder={`${typeLabel} — ${PERIODS.find((p) => p.value === period)?.label}`} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} hint="Leave blank to use the suggested name." />
        <Select label="Period" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        {period === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="From" type="date" max={toISO(new Date())} value={custom.start} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} error={errors.start} />
            <Input label="To" type="date" max={toISO(new Date())} value={custom.end} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} error={errors.end} />
          </div>
        )}
      </form>
    </Modal>
  );
}

export function ReportsPage() {
  const toast = useToast();
  const [modalType, setModalType] = useState<ReportType | null>(null);
  const [toDelete, setToDelete] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { data, error, refetch, setData } = useApi<Paginated<Report>>((signal) => api.get("/reports/", { page_size: 50 }, signal), []);

  const onDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/reports/${toDelete.id}/`);
      setData((current) => (current ? { ...current, count: current.count - 1, results: current.results.filter((r) => r.id !== toDelete.id) } : current));
      toast.success("Report deleted", toDelete.name);
      setToDelete(null);
    } catch (err) {
      toast.error("Couldn't delete report", (err as ApiError).message);
    } finally {
      setDeleting(false);
    }
  };

  const exportReport = async (report: Report) => {
    try {
      await api.download(`/reports/${report.id}/export/`, undefined, `${report.name}.csv`);
    } catch (err) {
      toast.error("Export failed", (err as ApiError).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate point-in-time business reports to share with your team or investors."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setModalType("executive")}>
            New report
          </Button>
        }
      />

      <section aria-labelledby="templates-heading">
        <h2 id="templates-heading" className="mb-3 text-base font-semibold text-ink">
          Start from a template
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {REPORT_TYPES.map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setModalType(value)}
              className="group rounded-2xl border border-line bg-surface p-5 text-left shadow-card transition-colors hover:border-brand-300 dark:hover:border-brand-700"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white dark:bg-brand-500/10 dark:text-brand-300">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="mt-4 block font-semibold text-ink">{label}</span>
              <span className="mt-1 block text-sm text-muted">{description}</span>
            </button>
          ))}
        </div>
      </section>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-[15px] font-semibold text-ink">Saved reports</h2>
          <p className="mt-0.5 text-xs text-muted">{data ? `${data.count} report${data.count === 1 ? "" : "s"}` : "Loading…"}</p>
        </div>
        {error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : !data ? (
          <TableSkeleton rows={4} cols={4} />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" />}
            title="No reports yet"
            description="Pick a template above to generate your first report."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Report</Th>
                <Th>Type</Th>
                <Th>Period</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((report) => (
                <tr key={report.id} className="hover:bg-surface-2">
                  <Td>
                    <Link to={`/reports/${report.id}`} className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-2">
                        <FileText className="size-4" aria-hidden />
                      </span>
                      <span className="font-semibold text-ink hover:underline">{report.name}</span>
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone="teal">{report.report_type_label}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-2">
                    {formatDate(report.period_start, "short")} – {formatDate(report.period_end)}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-2">
                    {formatDateTime(report.created_at)}
                    {report.created_by && <span className="block text-xs text-muted">by {report.created_by}</span>}
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Download ${report.name} as CSV`} onClick={() => exportReport(report)}>
                        <Download className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${report.name}`} onClick={() => setToDelete(report)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <GenerateModal open={modalType !== null} onClose={() => setModalType(null)} initialType={modalType ?? "executive"} />
      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        size="sm"
        title="Delete report?"
        description={toDelete?.name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={onDelete}>
              Delete report
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">The saved figures will be removed. You can always generate a new report for the same period.</p>
      </Modal>
    </div>
  );
}
