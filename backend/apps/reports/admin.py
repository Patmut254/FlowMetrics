from django.contrib import admin

from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "report_type", "period_start", "period_end", "created_at"]
    list_filter = ["organization", "report_type"]
