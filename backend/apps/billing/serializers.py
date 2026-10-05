from decimal import Decimal

from django.utils.text import slugify
from rest_framework import serializers

from .models import Customer, Plan, Subscription, Transaction


class PlanSerializer(serializers.ModelSerializer):
    active_subscriptions = serializers.IntegerField(read_only=True, default=0)
    trialing_subscriptions = serializers.IntegerField(read_only=True, default=0)
    cancelled_subscriptions = serializers.IntegerField(read_only=True, default=0)
    mrr = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, default=Decimal("0"))

    class Meta:
        model = Plan
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "monthly_price",
            "annual_price",
            "features",
            "trial_days",
            "is_active",
            "is_featured",
            "sort_order",
            "active_subscriptions",
            "trialing_subscriptions",
            "cancelled_subscriptions",
            "mrr",
        ]
        read_only_fields = ["id", "slug"]

    def validate_name(self, value: str) -> str:
        value = value.strip()
        org = self.context["organization"]
        slug = slugify(value)
        if not slug:
            raise serializers.ValidationError("Enter a valid plan name.")
        clash = Plan.objects.filter(organization=org, slug=slug)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("A plan with this name already exists.")
        return value

    def validate_features(self, value):
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise serializers.ValidationError("Features must be a list of strings.")
        return [item.strip() for item in value if item.strip()][:12]

    def validate(self, attrs):
        monthly = attrs.get("monthly_price", getattr(self.instance, "monthly_price", None))
        annual = attrs.get("annual_price", getattr(self.instance, "annual_price", None))
        if monthly is not None and annual is not None and annual > monthly * 12:
            raise serializers.ValidationError(
                {"annual_price": ["Annual price should not exceed 12× the monthly price."]}
            )
        return attrs

    def save(self, **kwargs):
        if "name" in self.validated_data:
            kwargs["slug"] = slugify(self.validated_data["name"])
        return super().save(**kwargs)


class CustomerRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "company_name", "contact_name", "email"]


class PlanRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ["id", "name", "slug"]


class CustomerListSerializer(serializers.ModelSerializer):
    current_plan = serializers.CharField(read_only=True, allow_null=True, default=None)
    mrr = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, default=Decimal("0"))
    lifetime_revenue = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, default=Decimal("0")
    )

    class Meta:
        model = Customer
        fields = [
            "id",
            "company_name",
            "contact_name",
            "email",
            "country",
            "industry",
            "company_size",
            "channel",
            "status",
            "joined_at",
            "churned_at",
            "current_plan",
            "mrr",
            "lifetime_revenue",
        ]
        read_only_fields = ["id", "status", "churned_at"]


class CustomerWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "company_name",
            "contact_name",
            "email",
            "country",
            "industry",
            "company_size",
            "channel",
            "joined_at",
            "notes",
        ]
        read_only_fields = ["id"]

    def validate_company_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Company name must be at least 2 characters.")
        return value

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        clash = Customer.objects.filter(organization=self.context["organization"], email__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("A customer with this email already exists.")
        return value


class SubscriptionSerializer(serializers.ModelSerializer):
    customer = CustomerRefSerializer(read_only=True)
    plan = PlanRefSerializer(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "customer",
            "plan",
            "status",
            "billing_cycle",
            "price",
            "mrr",
            "started_at",
            "trial_ends_at",
            "activated_at",
            "cancelled_at",
            "current_period_end",
            "cancel_reason",
            "previous",
        ]
        read_only_fields = fields


class SubscriptionCreateSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    plan_id = serializers.IntegerField()
    billing_cycle = serializers.ChoiceField(choices=Subscription.Cycle.choices)
    with_trial = serializers.BooleanField(default=True)

    def validate_customer_id(self, value: int) -> Customer:
        try:
            return Customer.objects.get(pk=value, organization=self.context["organization"])
        except Customer.DoesNotExist as exc:
            raise serializers.ValidationError("Customer not found.") from exc

    def validate_plan_id(self, value: int) -> Plan:
        try:
            return Plan.objects.get(pk=value, organization=self.context["organization"], is_active=True)
        except Plan.DoesNotExist as exc:
            raise serializers.ValidationError("Plan not found or inactive.") from exc


class ChangePlanSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()
    billing_cycle = serializers.ChoiceField(choices=Subscription.Cycle.choices)

    validate_plan_id = SubscriptionCreateSerializer.validate_plan_id


class CancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")


class TransactionSerializer(serializers.ModelSerializer):
    customer = CustomerRefSerializer(read_only=True)
    plan = serializers.CharField(source="subscription.plan.name", read_only=True, default=None)
    billing_cycle = serializers.CharField(
        source="subscription.billing_cycle", read_only=True, default=None
    )

    class Meta:
        model = Transaction
        fields = [
            "id",
            "reference",
            "customer",
            "plan",
            "billing_cycle",
            "amount",
            "currency",
            "status",
            "method",
            "description",
            "occurred_at",
        ]
        read_only_fields = fields


class CustomerDetailSerializer(CustomerListSerializer):
    notes = serializers.CharField(read_only=True)
    subscriptions = SubscriptionSerializer(many=True, read_only=True)

    class Meta(CustomerListSerializer.Meta):
        fields = CustomerListSerializer.Meta.fields + ["notes", "subscriptions"]
