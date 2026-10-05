from django.contrib import admin

from .models import Customer, Plan, Subscription, Transaction


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "monthly_price", "annual_price", "is_active"]
    list_filter = ["organization", "is_active"]


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["company_name", "email", "status", "channel", "joined_at"]
    list_filter = ["organization", "status", "channel"]
    search_fields = ["company_name", "contact_name", "email"]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ["customer", "plan", "status", "billing_cycle", "mrr", "started_at", "cancelled_at"]
    list_filter = ["organization", "status", "billing_cycle", "plan"]
    raw_id_fields = ["customer", "previous"]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["reference", "customer", "amount", "status", "method", "occurred_at"]
    list_filter = ["organization", "status", "method"]
    search_fields = ["reference", "customer__company_name"]
    raw_id_fields = ["customer", "subscription"]
