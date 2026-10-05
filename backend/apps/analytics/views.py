from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import Transaction
from apps.billing.serializers import TransactionSerializer
from apps.core.dates import parse_date_range

from .models import MetricSnapshot
from .services import MetricsEngine


class DashboardView(APIView):
    """Everything the dashboard needs for a date range, in one request."""

    def get(self, request):
        rng = parse_date_range(request.query_params)
        organization = request.user.organization
        engine = MetricsEngine(organization)

        recent = (
            Transaction.objects.filter(organization=organization, occurred_at__date__lte=rng.end)
            .select_related("customer", "subscription__plan")
            .order_by("-occurred_at")[:6]
        )
        return Response(
            {
                "range": {"start": rng.start, "end": rng.end},
                "previous_range": {"start": rng.previous().start, "end": rng.previous().end},
                "kpis": engine.kpis(rng),
                "series": engine.timeseries(rng),
                "plan_breakdown": engine.plan_breakdown(rng.end),
                "top_plans": sorted(
                    engine.plan_performance(rng), key=lambda row: row["mrr"], reverse=True
                ),
                "recent_transactions": TransactionSerializer(recent, many=True).data,
                "activity": engine.activity(rng.end),
            }
        )


class AnalyticsView(APIView):
    """Deeper analytics: trends, acquisition, retention, MRR movements, plans, funnel."""

    def get(self, request):
        rng = parse_date_range(request.query_params, default_days=365)
        engine = MetricsEngine(request.user.organization)
        return Response(
            {
                "range": {"start": rng.start, "end": rng.end},
                "kpis": engine.kpis(rng),
                "health": engine.health(rng),
                "series": engine.timeseries(rng),
                "acquisition": engine.acquisition_by_channel(rng),
                "funnel": engine.funnel(rng),
                "retention": engine.retention_cohorts(rng.end),
                "plan_performance": engine.plan_performance(rng),
            }
        )


class MetricSnapshotSerializer(serializers.ModelSerializer):
    arpu = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = MetricSnapshot
        exclude = ["organization", "created_at"]


class SnapshotListView(generics.ListAPIView):
    serializer_class = MetricSnapshotSerializer
    pagination_class = None

    def get_queryset(self):
        return MetricSnapshot.objects.filter(organization=self.request.user.organization)[:24]
