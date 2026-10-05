import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { TrendChart } from "@/components/charts/TrendChart";
import { SERIES } from "@/components/charts/theme";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Delta } from "@/components/ui/Delta";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Table, Td, Th } from "@/components/ui/Table";
import { useToast } from "@/context/ToastContext";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatDateTime, formatValue } from "@/lib/format";
import type { Report } from "@/types";

export function ReportDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data: report, error, refetch } = useApi<Report>((signal) => api.get(`/reports/${id}/`, undefined, signal), [id]);

  if (error) {
    return (
      <Card>
        <ErrorState message={error.status === 404 ? "This report doesn't exist." : error.message} onRetry={error.status === 404 ? undefined : refetch} />
      </Card>
    );
  }

  const content = report?.data;
  const chartData = content?.chart;

  const onExport = async () => {
    if (!report) return;
    try {
      await api.download(`/reports/${report.id}/export/`, undefined, `${report.name}.csv`);
      toast.success("Export ready", "Report downloaded as CSV.");
    } catch (err) {
      toast.error("Export failed", (err as ApiError).message);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/reports" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink print:hidden">
        <ArrowLeft className="size-4" aria-hidden /> Reports
      </Link>

      <Card className="hero-pattern overflow-hidden border-transparent p-6 text-white sm:p-8">
        {report ? (
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge className="bg-white/10 text-white ring-white/20">{report.report_type_label}</Badge>
              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{report.name}</h1>
              <p className="mt-1.5 text-sm text-white/70">
                {formatDate(report.period_start)} – {formatDate(report.period_end)} · Generated {formatDateTime(report.created_at)}
                {report.created_by && ` by ${report.created_by}`}
              </p>
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="hero-outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>
                Print
              </Button>
              <Button variant="hero" icon={<Download className="size-4" />} onClick={onExport}>
                Download CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-5 w-28 bg-white/10" />
            <Skeleton className="h-8 w-80 bg-white/10" />
          </div>
        )}
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {content
          ? content.summary.map((item) => (
              <Card key={item.label} className="p-5">
                <p className="text-xs font-medium text-muted">{item.label}</p>
                <p className="mt-1 text-xl font-bold tracking-tight text-ink tabular">{formatValue(item.value, item.format)}</p>
                {item.change !== null && item.change !== undefined && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Delta value={item.change} inverse={item.label.toLowerCase().includes("churn")} />
                  </div>
                )}
              </Card>
            ))
          : Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>

      {chartData && (
        <Card>
          <CardHeader title={chartData.title} subtitle={`By ${chartData.granularity}`} />
          <div className="px-3 pt-4 pb-4 sm:px-5">
            {chartData.data.length ? (
              <TrendChart
                title={chartData.title}
                type={chartData.type}
                data={chartData.data}
                granularity={chartData.granularity}
                format={chartData.series[0]?.format ?? "number"}
                series={chartData.series.map((s, i) => ({ key: s.key, label: s.label, color: SERIES[i], format: s.format }))}
              />
            ) : (
              <EmptyState title="No data for this period" />
            )}
          </div>
        </Card>
      )}

      {content?.tables.map((table) => (
        <Card key={table.title} className="overflow-hidden">
          <CardHeader title={table.title} className="pb-4" />
          {table.rows.length === 0 ? (
            <EmptyState title="No rows for this period" className="py-8" />
          ) : (
            <Table>
              <thead>
                <tr>
                  {table.columns.map((col, i) => (
                    <Th key={col.key} className={i > 0 && col.format !== "text" && col.format !== "status" ? "text-right" : undefined}>
                      {col.label}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, r) => (
                  <tr key={r} className="hover:bg-surface-2">
                    {table.columns.map((col, i) => (
                      <Td
                        key={col.key}
                        className={
                          i === 0
                            ? "font-semibold text-ink"
                            : col.format === "text" || col.format === "status"
                              ? "text-ink-2"
                              : "text-right text-ink-2 tabular"
                        }
                      >
                        {col.format === "status" ? <StatusBadge status={String(row[col.key])} /> : formatValue(row[col.key], col.format)}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ))}
    </div>
  );
}
