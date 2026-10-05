from django.contrib import admin

from .models import MetricSnapshot


@admin.register(MetricSnapshot)
class MetricSnapshotAdmin(admin.ModelAdmin):
    list_display = ["organization", "month", "mrr", "revenue", "active_customers"]
    list_filter = ["organization"]
