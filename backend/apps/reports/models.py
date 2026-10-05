from django.conf import settings
from django.db import models

from apps.accounts.models import Organization
from apps.core.models import TimeStampedModel


class Report(TimeStampedModel):
    """A generated business report. `data` stores the computed figures at generation time."""

    class Type(models.TextChoices):
        EXECUTIVE = "executive", "Executive summary"
        REVENUE = "revenue", "Revenue report"
        CUSTOMERS = "customers", "Customer report"
        SUBSCRIPTIONS = "subscriptions", "Subscription report"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="reports")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="reports"
    )
    name = models.CharField(max_length=150)
    report_type = models.CharField(max_length=20, choices=Type.choices)
    period_start = models.DateField()
    period_end = models.DateField()
    data = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name
