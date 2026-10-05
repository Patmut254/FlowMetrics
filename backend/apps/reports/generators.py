"""Builds the content of each report type from the metrics engine."""
from __future__ import annotations

from django.db.models import Count, Sum

from apps.analytics.models import MetricSnapshot
from apps.analytics.services import MetricsEngine, refresh_snapshots
from apps.billing.models import Transaction
from apps.core.dates import DateRange, month_start


def stat(label: str, value, fmt: str = "number", change=None) -> dict:
    return {"label": label, "value": value, "format": fmt, "change": change}


def col(key: str, label: str, fmt: str = "text") -> dict:
    return {"key": key, "label": label, "format": fmt}


def monthly_table(organization, rng: DateRange) -> dict:
    snapshots = MetricSnapshot.objects.filter(
        organization=organization, month__range=(month_start(rng.start), rng.end)
    ).order_by("month")
    return {
        "title": "Monthly performance",
        "columns": [
            col("month", "Month", "month"),
            col("revenue", "Revenue", "currency"),
            col("mrr", "MRR", "currency"),
            col("net_new_mrr", "Net new MRR", "currency"),
            col("active_customers", "Active customers", "number"),
            col("new_customers", "New", "number"),
            col("churned_customers", "Churned", "number"),
        ],
        "rows": [
            {
                "month": s.month.isoformat(),
                "revenue": float(s.revenue),
                "mrr": float(s.mrr),
                "net_new_mrr": float(s.new_mrr + s.expansion_mrr - s.contraction_mrr - s.churned_mrr),
                "active_customers": s.active_customers,
                "new_customers": s.new_customers,
                "churned_customers": s.churned_customers,
            }
            for s in snapshots
        ],
    }


def plan_table(engine: MetricsEngine, rng: DateRange) -> dict:
    return {
        "title": "Plan performance",
        "columns": [
            col("plan", "Plan"),
            col("subscribers", "Subscribers", "number"),
            col("mrr", "MRR", "currency"),
            col("revenue", "Revenue in period", "currency"),
            col("arpa", "ARPA", "currency"),
            col("churn_rate", "Churn", "percent"),
        ],
        "rows": engine.plan_performance(rng),
    }


def build_report(organization, report_type: str, rng: DateRange) -> dict:
    engine = MetricsEngine(organization)
    refresh_snapshots(organization, engine=engine)
    kpis = engine.kpis(rng)
    series = engine.timeseries(rng)

    def k(key: str, label: str, fmt: str = "number") -> dict:
        return stat(label, kpis[key]["value"], fmt, kpis[key]["change"])

    if report_type == "executive":
        health = engine.health(rng)
        summary = [
            k("total_revenue", "Total revenue", "currency"),
            k("mrr", "MRR", "currency"),
            k("active_customers", "Active customers"),
            k("churn_rate", "Churn rate", "percent"),
            k("arpu", "ARPU", "currency"),
            stat("Net revenue retention", health["net_revenue_retention"], "percent"),
        ]
        chart = {
            "type": "area",
            "title": "MRR over time",
            "series": [{"key": "mrr", "label": "MRR", "format": "currency"}],
        }
        tables = [monthly_table(organization, rng), plan_table(engine, rng)]

    elif report_type == "revenue":
        moves = engine.movements(rng.start, rng.end)
        summary = [
            k("total_revenue", "Total revenue", "currency"),
            k("mrr", "MRR", "currency"),
            k("arr", "ARR", "currency"),
            stat("New MRR", moves["new"], "currency"),
            stat("Expansion MRR", moves["expansion"], "currency"),
            stat("Churned MRR", moves["churned"], "currency"),
        ]
        chart = {
            "type": "bar",
            "title": "Revenue collected",
            "series": [{"key": "revenue", "label": "Revenue", "format": "currency"}],
        }
        status_rows = (
            Transaction.objects.filter(
                organization=organization, occurred_at__date__range=(rng.start, rng.end)
            )
            .values("status")
            .annotate(count=Count("id"), amount=Sum("amount"))
            .order_by("status")
        )
        tables = [
            monthly_table(organization, rng),
            {
                "title": "Payments by status",
                "columns": [
                    col("status", "Status", "status"),
                    col("count", "Transactions", "number"),
                    col("amount", "Amount", "currency"),
                ],
                "rows": [
                    {"status": r["status"], "count": r["count"], "amount": float(r["amount"] or 0)}
                    for r in status_rows
                ],
            },
        ]

    elif report_type == "customers":
        summary = [
            k("active_customers", "Active customers"),
            k("new_customers", "New customers"),
            k("churned_customers", "Churned customers"),
            k("churn_rate", "Churn rate", "percent"),
            k("conversion_rate", "Trial conversion", "percent"),
            k("arpu", "ARPU", "currency"),
        ]
        chart = {
            "type": "bar",
            "title": "New vs churned customers",
            "series": [
                {"key": "new_customers", "label": "New", "format": "number"},
                {"key": "churned_customers", "label": "Churned", "format": "number"},
            ],
        }
        tables = [
            {
                "title": "Acquisition by channel",
                "columns": [
                    col("label", "Channel"),
                    col("customers", "Sign-ups", "number"),
                    col("converted", "Converted", "number"),
                    col("conversion_rate", "Conversion", "percent"),
                ],
                "rows": engine.acquisition_by_channel(rng),
            },
            {
                "title": "Conversion funnel",
                "columns": [
                    col("stage", "Stage"),
                    col("count", "Customers", "number"),
                    col("rate", "Of sign-ups", "percent"),
                ],
                "rows": engine.funnel(rng),
            },
        ]

    else:  # subscriptions
        breakdown = engine.plan_breakdown(rng.end)
        paid = sum(r["subscriptions"] for r in breakdown)
        annual = sum(r["annual"] for r in breakdown)
        summary = [
            stat("Paid subscriptions", paid),
            k("trialing", "On trial"),
            stat("Annual share", round(annual / paid * 100, 1) if paid else 0.0, "percent"),
            k("conversion_rate", "Trial conversion", "percent"),
            k("mrr", "MRR", "currency"),
            k("arpu", "ARPU", "currency"),
        ]
        chart = {
            "type": "area",
            "title": "Paying customers",
            "series": [{"key": "active_customers", "label": "Paying customers", "format": "number"}],
        }
        tables = [
            plan_table(engine, rng),
            {
                "title": "Billing cycle mix",
                "columns": [
                    col("plan", "Plan"),
                    col("monthly", "Monthly", "number"),
                    col("annual", "Annual", "number"),
                    col("share", "MRR share", "percent"),
                ],
                "rows": breakdown,
            },
        ]

    keys = ["date", *[s["key"] for s in chart["series"]]]
    chart["granularity"] = series["granularity"]
    chart["data"] = [{key: point[key] for key in keys} for point in series["points"]]
    return {"summary": summary, "chart": chart, "tables": tables}
