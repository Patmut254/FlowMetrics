"""Business operations on subscriptions. Views call these instead of mutating models directly."""
from __future__ import annotations

import secrets
from datetime import date, datetime, time, timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Customer, Plan, Subscription, Transaction


def new_reference() -> str:
    return f"TXN-{secrets.token_hex(5).upper()}"


def period_end(start: date, cycle: str) -> date:
    days = 365 if cycle == Subscription.Cycle.ANNUAL else 30
    return start + timedelta(days=days)


def sync_customer_status(customer: Customer) -> Customer:
    """Derive the customer's status from their subscriptions."""
    live = [s for s in customer.subscriptions.all() if s.status != Subscription.Status.CANCELLED]
    if not live:
        last_cancel = max(
            (s.cancelled_at for s in customer.subscriptions.all() if s.cancelled_at), default=None
        )
        customer.status = Customer.Status.CHURNED
        customer.churned_at = last_cancel or timezone.localdate()
    else:
        statuses = {s.status for s in live}
        if Subscription.Status.PAST_DUE in statuses:
            customer.status = Customer.Status.PAST_DUE
        elif Subscription.Status.ACTIVE in statuses:
            customer.status = Customer.Status.ACTIVE
        else:
            customer.status = Customer.Status.TRIALING
        customer.churned_at = None
    customer.save(update_fields=["status", "churned_at", "updated_at"])
    return customer


def record_payment(subscription: Subscription, on: date, status=Transaction.Status.PAID) -> Transaction:
    occurred = timezone.make_aware(datetime.combine(on, time(hour=10)))
    return Transaction.objects.create(
        organization=subscription.organization,
        customer=subscription.customer,
        subscription=subscription,
        reference=new_reference(),
        amount=subscription.price,
        currency=subscription.organization.currency,
        status=status,
        method=Transaction.Method.CARD,
        description=f"{subscription.plan.name} · {subscription.get_billing_cycle_display()}",
        occurred_at=occurred,
    )


@transaction.atomic
def start_subscription(
    customer: Customer, plan: Plan, cycle: str, with_trial: bool = True
) -> Subscription:
    if customer.subscriptions.exclude(status=Subscription.Status.CANCELLED).exists():
        raise ValidationError(
            {"customer_id": ["This customer already has a live subscription. Change its plan instead."]}
        )
    today = timezone.localdate()
    trial = with_trial and plan.trial_days > 0
    subscription = Subscription.objects.create(
        organization=customer.organization,
        customer=customer,
        plan=plan,
        billing_cycle=cycle,
        price=plan.price_for(cycle),
        started_at=today,
        trial_ends_at=today + timedelta(days=plan.trial_days) if trial else None,
        activated_at=None if trial else today,
        status=Subscription.Status.TRIALING if trial else Subscription.Status.ACTIVE,
        current_period_end=today + timedelta(days=plan.trial_days) if trial else period_end(today, cycle),
    )
    if not trial:
        record_payment(subscription, today)
    sync_customer_status(customer)
    return subscription


@transaction.atomic
def cancel_subscription(subscription: Subscription, reason: str = "") -> Subscription:
    if subscription.status == Subscription.Status.CANCELLED:
        raise ValidationError({"detail": ["This subscription is already cancelled."]})
    subscription.status = Subscription.Status.CANCELLED
    subscription.cancelled_at = timezone.localdate()
    subscription.cancel_reason = reason[:120]
    subscription.save()
    sync_customer_status(subscription.customer)
    return subscription


@transaction.atomic
def change_plan(subscription: Subscription, plan: Plan, cycle: str) -> Subscription:
    """Replace a live subscription with one on a different plan or cycle."""
    if subscription.status == Subscription.Status.CANCELLED:
        raise ValidationError({"detail": ["Cancelled subscriptions cannot change plan."]})
    if subscription.plan_id == plan.id and subscription.billing_cycle == cycle:
        raise ValidationError({"plan_id": ["The subscription is already on this plan and cycle."]})

    today = timezone.localdate()
    was_trialing = subscription.status == Subscription.Status.TRIALING
    subscription.status = Subscription.Status.CANCELLED
    subscription.cancelled_at = today
    subscription.cancel_reason = "Plan change"
    subscription.save()

    replacement = Subscription.objects.create(
        organization=subscription.organization,
        customer=subscription.customer,
        plan=plan,
        previous=None if was_trialing else subscription,
        billing_cycle=cycle,
        price=plan.price_for(cycle),
        started_at=today,
        trial_ends_at=subscription.trial_ends_at if was_trialing else None,
        activated_at=None if was_trialing else today,
        status=Subscription.Status.TRIALING if was_trialing else Subscription.Status.ACTIVE,
        current_period_end=subscription.trial_ends_at if was_trialing else period_end(today, cycle),
    )
    if not was_trialing:
        record_payment(replacement, today)
    sync_customer_status(subscription.customer)
    return replacement
