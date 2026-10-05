from django.db import models

from apps.accounts.models import Organization
from apps.core.models import TimeStampedModel


class MetricSnapshot(TimeStampedModel):
    """
    A persisted month-end record of the workspace's key metrics.

    Snapshots are *derived* — they are recomputed from subscriptions and
    transactions by `analytics.services.refresh_snapshots` — and give reports
    a stable historical record that does not drift when source data changes.
    """

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="metric_snapshots"
    )
    month = models.DateField(help_text="First day of the month this snapshot covers.")
    revenue = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    mrr = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    new_mrr = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    expansion_mrr = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    contraction_mrr = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    churned_mrr = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    active_customers = models.PositiveIntegerField(default=0)
    new_customers = models.PositiveIntegerField(default=0)
    churned_customers = models.PositiveIntegerField(default=0)
    trials_started = models.PositiveIntegerField(default=0)
    trials_converted = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-month"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "month"], name="unique_snapshot_month"),
        ]

    def __str__(self) -> str:
        return f"{self.organization} · {self.month:%b %Y}"

    @property
    def arpu(self):
        return self.mrr / self.active_customers if self.active_customers else 0
