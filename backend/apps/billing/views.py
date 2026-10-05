import csv
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce, TruncMonth
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.dates import add_months, month_start, parse_date_range
from apps.core.mixins import OrganizationScopedMixin
from apps.core.permissions import IsWorkspaceAdminOrReadOnly

from . import services
from .models import Customer, Plan, Subscription, Transaction
from .serializers import (
    CancelSerializer,
    ChangePlanSerializer,
    CustomerDetailSerializer,
    CustomerListSerializer,
    CustomerWriteSerializer,
    PlanSerializer,
    SubscriptionCreateSerializer,
    SubscriptionSerializer,
    TransactionSerializer,
)

MONEY = DecimalField(max_digits=14, decimal_places=2)
LIVE_STATUSES = [Subscription.Status.ACTIVE, Subscription.Status.PAST_DUE]


def apply_ordering(queryset, request, allowed: dict[str, str], default: str):
    """Order by a whitelisted `?ordering=` key (prefix with '-' for descending)."""
    raw = request.query_params.get("ordering", default)
    descending = raw.startswith("-")
    key = raw.lstrip("-")
    if key not in allowed:
        raise ValidationError({"ordering": [f"Unsupported ordering '{raw}'."]})
    field = allowed[key]
    return queryset.order_by(f"-{field}" if descending else field, "-id")


class PlanViewSet(OrganizationScopedMixin, viewsets.ModelViewSet):
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer
    pagination_class = None
    permission_classes = viewsets.ModelViewSet.permission_classes + [IsWorkspaceAdminOrReadOnly]

    def get_queryset(self):
        return super().get_queryset().annotate(
            active_subscriptions=Count("subscriptions", filter=Q(subscriptions__status__in=LIVE_STATUSES)),
            trialing_subscriptions=Count(
                "subscriptions", filter=Q(subscriptions__status=Subscription.Status.TRIALING)
            ),
            cancelled_subscriptions=Count(
                "subscriptions", filter=Q(subscriptions__status=Subscription.Status.CANCELLED)
            ),
            mrr=Coalesce(
                Sum("subscriptions__mrr", filter=Q(subscriptions__status__in=LIVE_STATUSES)),
                Value(Decimal("0")),
                output_field=MONEY,
            ),
        )

    def destroy(self, request, *args, **kwargs):
        plan = self.get_object()
        if plan.subscriptions.exists():
            raise ValidationError(
                {"detail": ["Plans with subscriptions can't be deleted. Archive the plan instead."]}
            )
        return super().destroy(request, *args, **kwargs)


class CustomerViewSet(OrganizationScopedMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.all()

    ORDERING = {
        "company_name": "company_name",
        "joined_at": "joined_at",
        "lifetime_revenue": "lifetime_revenue",
        "mrr": "mrr",
        "status": "status",
    }

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return CustomerWriteSerializer
        if self.action == "retrieve":
            return CustomerDetailSerializer
        return CustomerListSerializer

    def get_queryset(self):
        live_subs = Subscription.objects.filter(customer=OuterRef("pk")).exclude(
            status=Subscription.Status.CANCELLED
        )
        mrr_sum = (
            Subscription.objects.filter(customer=OuterRef("pk"), status__in=LIVE_STATUSES)
            .values("customer")
            .annotate(total=Sum("mrr"))
            .values("total")
        )
        revenue_sum = (
            Transaction.objects.filter(customer=OuterRef("pk"), status=Transaction.Status.PAID)
            .values("customer")
            .annotate(total=Sum("amount"))
            .values("total")
        )
        queryset = super().get_queryset().annotate(
            current_plan=Subquery(live_subs.order_by("-started_at").values("plan__name")[:1]),
            current_plan_slug=Subquery(live_subs.order_by("-started_at").values("plan__slug")[:1]),
            mrr=Coalesce(Subquery(mrr_sum, output_field=MONEY), Value(Decimal("0")), output_field=MONEY),
            lifetime_revenue=Coalesce(
                Subquery(revenue_sum, output_field=MONEY), Value(Decimal("0")), output_field=MONEY
            ),
        )
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("subscriptions__plan", "subscriptions__customer")
        if self.action != "list":
            return queryset

        params = self.request.query_params
        if search := params.get("search", "").strip():
            queryset = queryset.filter(
                Q(company_name__icontains=search)
                | Q(contact_name__icontains=search)
                | Q(email__icontains=search)
            )
        if value := params.get("status"):
            queryset = queryset.filter(status=value)
        if value := params.get("plan"):
            queryset = queryset.filter(current_plan_slug=value)
        if value := params.get("channel"):
            queryset = queryset.filter(channel=value)
        if value := params.get("country"):
            queryset = queryset.filter(country=value)
        return apply_ordering(queryset, self.request, self.ORDERING, "-joined_at")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = serializer.save(organization=self.get_organization())
        output = CustomerListSerializer(self.get_queryset().get(pk=customer.pk))
        return Response(output.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        customer = self.get_object()
        data = CustomerDetailSerializer(customer).data

        # Revenue for the last 12 months, filled with zeros for empty months.
        first_month = add_months(month_start(timezone.localdate()), -11)
        monthly = (
            customer.transactions.filter(
                status=Transaction.Status.PAID, occurred_at__date__gte=first_month
            )
            .annotate(month=TruncMonth("occurred_at"))
            .values("month")
            .annotate(total=Sum("amount"))
        )
        totals = {row["month"].date().isoformat()[:7]: row["total"] for row in monthly}
        data["revenue_history"] = [
            {"month": (m := add_months(first_month, i)).isoformat(), "revenue": totals.get(m.isoformat()[:7], Decimal("0"))}
            for i in range(12)
        ]
        payments = customer.transactions.aggregate(
            paid=Count("id", filter=Q(status=Transaction.Status.PAID)),
            failed=Count("id", filter=Q(status=Transaction.Status.FAILED)),
        )
        data["payment_stats"] = payments
        return Response(data)

    @action(detail=True, methods=["get"])
    def transactions(self, request, pk=None):
        customer = self.get_object()
        queryset = customer.transactions.select_related("subscription__plan").order_by("-occurred_at")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(TransactionSerializer(page, many=True).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        counts = Customer.objects.filter(organization=self.get_organization()).aggregate(
            total=Count("id"),
            **{code: Count("id", filter=Q(status=code)) for code, _ in Customer.Status.choices},
        )
        return Response(counts)

    @action(detail=False, methods=["get"])
    def countries(self, request):
        countries = (
            super().get_queryset().values_list("country", flat=True).distinct().order_by("country")
        )
        return Response(list(countries))


class SubscriptionViewSet(
    OrganizationScopedMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Subscription.objects.select_related("customer", "plan")
    serializer_class = SubscriptionSerializer

    ORDERING = {
        "started_at": "started_at",
        "mrr": "mrr",
        "customer": "customer__company_name",
        "status": "status",
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        params = self.request.query_params
        if search := params.get("search", "").strip():
            queryset = queryset.filter(
                Q(customer__company_name__icontains=search) | Q(customer__email__icontains=search)
            )
        if value := params.get("status"):
            queryset = queryset.filter(status=value)
        if value := params.get("billing_cycle"):
            queryset = queryset.filter(billing_cycle=value)
        if value := params.get("plan"):
            queryset = queryset.filter(plan__slug=value)
        return apply_ordering(queryset, self.request, self.ORDERING, "-started_at")

    def create(self, request, *args, **kwargs):
        serializer = SubscriptionCreateSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        subscription = services.start_subscription(
            data["customer_id"], data["plan_id"], data["billing_cycle"], data["with_trial"]
        )
        return Response(SubscriptionSerializer(subscription).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        serializer = CancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription = services.cancel_subscription(self.get_object(), serializer.validated_data["reason"])
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=True, methods=["post"], url_path="change-plan")
    def change_plan(self, request, pk=None):
        serializer = ChangePlanSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        replacement = services.change_plan(self.get_object(), data["plan_id"], data["billing_cycle"])
        return Response(SubscriptionSerializer(replacement).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        base = Subscription.objects.filter(organization=self.get_organization())
        today = timezone.localdate()
        last_30 = today - timedelta(days=29)
        totals = base.aggregate(
            active=Count("id", filter=Q(status=Subscription.Status.ACTIVE)),
            past_due=Count("id", filter=Q(status=Subscription.Status.PAST_DUE)),
            trialing=Count("id", filter=Q(status=Subscription.Status.TRIALING)),
            cancelled=Count("id", filter=Q(status=Subscription.Status.CANCELLED)),
            monthly=Count("id", filter=Q(status__in=LIVE_STATUSES, billing_cycle=Subscription.Cycle.MONTHLY)),
            annual=Count("id", filter=Q(status__in=LIVE_STATUSES, billing_cycle=Subscription.Cycle.ANNUAL)),
            total_mrr=Coalesce(Sum("mrr", filter=Q(status__in=LIVE_STATUSES)), Value(Decimal("0")), output_field=MONEY),
            monthly_mrr=Coalesce(
                Sum("mrr", filter=Q(status__in=LIVE_STATUSES, billing_cycle=Subscription.Cycle.MONTHLY)),
                Value(Decimal("0")),
                output_field=MONEY,
            ),
            annual_mrr=Coalesce(
                Sum("mrr", filter=Q(status__in=LIVE_STATUSES, billing_cycle=Subscription.Cycle.ANNUAL)),
                Value(Decimal("0")),
                output_field=MONEY,
            ),
            trials_ended_30d=Count("id", filter=Q(trial_ends_at__range=(last_30, today))),
            trials_converted_30d=Count(
                "id", filter=Q(trial_ends_at__range=(last_30, today), activated_at__isnull=False)
            ),
            cancelled_30d=Count(
                "id",
                filter=Q(cancelled_at__range=(last_30, today), activated_at__isnull=False, successor__isnull=True),
            ),
        )
        totals["mrr"] = totals.pop("total_mrr")
        live = totals["active"] + totals["past_due"]
        totals["trial_conversion_rate"] = (
            round(totals["trials_converted_30d"] / totals["trials_ended_30d"] * 100, 1)
            if totals["trials_ended_30d"]
            else 0.0
        )
        totals["average_mrr"] = round(totals["mrr"] / live, 2) if live else Decimal("0")
        return Response(totals)


class TransactionViewSet(OrganizationScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Transaction.objects.select_related("customer", "subscription__plan")
    serializer_class = TransactionSerializer

    ORDERING = {
        "occurred_at": "occurred_at",
        "amount": "amount",
        "customer": "customer__company_name",
        "status": "status",
    }

    def filtered_queryset(self):
        queryset = self.get_queryset()
        params = self.request.query_params
        if search := params.get("search", "").strip():
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(customer__company_name__icontains=search)
                | Q(customer__email__icontains=search)
            )
        if value := params.get("status"):
            queryset = queryset.filter(status=value)
        if value := params.get("method"):
            queryset = queryset.filter(method=value)
        if value := params.get("plan"):
            queryset = queryset.filter(subscription__plan__slug=value)
        if params.get("start") or params.get("end"):
            rng = parse_date_range(params, default_days=3650)
            queryset = queryset.filter(occurred_at__date__range=(rng.start, rng.end))
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = apply_ordering(self.filtered_queryset(), request, self.ORDERING, "-occurred_at")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.filtered_queryset()
        summary = {}
        for code, _label in Transaction.Status.choices:
            agg = queryset.filter(status=code).aggregate(
                count=Count("id"),
                amount=Coalesce(Sum("amount"), Value(Decimal("0")), output_field=MONEY),
            )
            summary[code] = agg
        total = queryset.aggregate(count=Count("id"))["count"]
        summary["total_count"] = total
        summary["success_rate"] = round(summary["paid"]["count"] / total * 100, 1) if total else 0.0
        return Response(summary)

    @action(detail=False, methods=["get"])
    def export(self, request):
        queryset = apply_ordering(self.filtered_queryset(), request, self.ORDERING, "-occurred_at")[:5000]
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="flowmetrics-transactions.csv"'
        writer = csv.writer(response)
        writer.writerow(["Reference", "Date", "Customer", "Email", "Plan", "Amount", "Currency", "Status", "Method"])
        for txn in queryset:
            writer.writerow(
                [
                    txn.reference,
                    txn.occurred_at.date().isoformat(),
                    txn.customer.company_name,
                    txn.customer.email,
                    txn.subscription.plan.name if txn.subscription else "",
                    txn.amount,
                    txn.currency,
                    txn.status,
                    txn.method,
                ]
            )
        return response
