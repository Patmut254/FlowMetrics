from decimal import ROUND_HALF_UP, Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.accounts.models import Organization
from apps.core.models import TimeStampedModel

TWO_PLACES = Decimal("0.01")


class Plan(TimeStampedModel):
    """A subscription plan offered by the workspace to its customers."""

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="plans")
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=90)
    description = models.CharField(max_length=255, blank=True)
    monthly_price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    annual_price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    features = models.JSONField(default=list, blank=True)
    trial_days = models.PositiveSmallIntegerField(default=14)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "monthly_price"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "slug"], name="unique_plan_slug"),
        ]

    def __str__(self) -> str:
        return self.name

    def price_for(self, cycle: str) -> Decimal:
        return self.annual_price if cycle == Subscription.Cycle.ANNUAL else self.monthly_price


class Customer(TimeStampedModel):
    """A company that subscribes to one of the workspace's plans."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        TRIALING = "trialing", "Trialing"
        PAST_DUE = "past_due", "Past due"
        CHURNED = "churned", "Churned"

    class Channel(models.TextChoices):
        ORGANIC = "organic", "Organic search"
        PAID = "paid", "Paid ads"
        REFERRAL = "referral", "Referral"
        PARTNER = "partner", "Partner"
        OUTBOUND = "outbound", "Outbound sales"

    class CompanySize(models.TextChoices):
        XS = "1-10", "1–10"
        S = "11-50", "11–50"
        M = "51-200", "51–200"
        L = "201-1000", "201–1,000"
        XL = "1000+", "1,000+"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="customers"
    )
    company_name = models.CharField(max_length=150)
    contact_name = models.CharField(max_length=150)
    email = models.EmailField()
    country = models.CharField(max_length=80)
    industry = models.CharField(max_length=80, blank=True)
    company_size = models.CharField(
        max_length=10, choices=CompanySize.choices, default=CompanySize.S
    )
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.ORGANIC)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TRIALING)
    joined_at = models.DateField()
    churned_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-joined_at", "company_name"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "joined_at"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["organization", "email"], name="unique_customer_email"),
        ]

    def __str__(self) -> str:
        return self.company_name


class Subscription(TimeStampedModel):
    """
    A customer's subscription to a plan.

    Lifecycle dates drive every metric:
      started_at   - signup (trial start, or paid start if no trial)
      activated_at - first paid day; null while trialing or if the trial lapsed
      cancelled_at - last day of service; null while live
    `previous` links an upgrade/downgrade to the subscription it replaced.
    """

    class Status(models.TextChoices):
        TRIALING = "trialing", "Trialing"
        ACTIVE = "active", "Active"
        PAST_DUE = "past_due", "Past due"
        CANCELLED = "cancelled", "Cancelled"

    class Cycle(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        ANNUAL = "annual", "Annual"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="subscriptions"
    )
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="subscriptions")
    plan = models.ForeignKey(Plan, on_delete=models.RESTRICT, related_name="subscriptions")
    previous = models.OneToOneField(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="successor"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TRIALING)
    billing_cycle = models.CharField(max_length=10, choices=Cycle.choices, default=Cycle.MONTHLY)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    mrr = models.DecimalField(max_digits=10, decimal_places=2, editable=False)
    started_at = models.DateField()
    trial_ends_at = models.DateField(null=True, blank=True)
    activated_at = models.DateField(null=True, blank=True)
    cancelled_at = models.DateField(null=True, blank=True)
    current_period_end = models.DateField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "activated_at"]),
            models.Index(fields=["organization", "cancelled_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.customer} · {self.plan} ({self.billing_cycle})"

    @staticmethod
    def normalise_mrr(price: Decimal, cycle: str) -> Decimal:
        monthly = price / 12 if cycle == Subscription.Cycle.ANNUAL else price
        return Decimal(monthly).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

    def save(self, *args, **kwargs):
        self.mrr = self.normalise_mrr(self.price, self.billing_cycle)
        super().save(*args, **kwargs)


class Transaction(TimeStampedModel):
    """A payment attempt against a subscription invoice."""

    class Status(models.TextChoices):
        PAID = "paid", "Paid"
        PENDING = "pending", "Pending"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    class Method(models.TextChoices):
        CARD = "card", "Card"
        BANK_TRANSFER = "bank_transfer", "Bank transfer"
        PAYPAL = "paypal", "PayPal"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="transactions"
    )
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="transactions")
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )
    reference = models.CharField(max_length=32, unique=True)
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    currency = models.CharField(max_length=3, default="USD")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PAID)
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CARD)
    description = models.CharField(max_length=200, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["organization", "occurred_at"]),
            models.Index(fields=["organization", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.reference} · {self.amount} {self.currency}"
