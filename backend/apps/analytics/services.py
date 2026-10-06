"""
The FlowMetrics metrics engine.

Every number on the dashboard is derived here from raw subscriptions,
customers and transactions - nothing is hard-coded. Subscriptions for a
workspace are loaded once into memory (a few thousand rows at most) so that
point-in-time metrics like MRR can be evaluated for many dates cheaply.

Definitions
-----------
* A subscription is *paid-active* on day d when activated_at <= d < cancelled_at.
* MRR on day d is the sum of normalised monthly value of paid-active subscriptions.
* Active customers on day d are customers with at least one paid-active subscription.
* Churned customers are previously *paying* customers whose `churned_at` falls
  in the period (lapsed trials are not churn).
* Churn rate is the average monthly logo churn over the period:
  churned / average active customers / months in period.
* Trial conversion = trials ending in the period that became paid / trials ending.
* ARPU = MRR / active customers.
* MRR movements: new (first paid subscription), expansion / contraction (plan
  changes via `previous`), churned (paid subscription cancelled without successor).
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum

from apps.billing.models import Customer, Plan, Subscription, Transaction
from apps.core.dates import (
    DateRange,
    add_months,
    bucket_index,
    build_buckets,
    month_end,
    month_start,
)

from .models import MetricSnapshot


def pct_change(current: float, previous: float) -> float | None:
    if not previous:
        return None
    return round((current - previous) / abs(previous) * 100, 1)


def money(value) -> float:
    return round(float(value or 0), 2)


def ratio(numerator: float, denominator: float) -> float:
    return round(numerator / denominator * 100, 1) if denominator else 0.0


@dataclass(frozen=True)
class Sub:
    id: int
    customer_id: int
    plan_id: int
    cycle: str
    mrr: float
    started: date
    trial_ends: date | None
    activated: date | None
    cancelled: date | None
    previous_id: int | None
    has_successor: bool

    def paid_on(self, day: date) -> bool:
        return (
            self.activated is not None
            and self.activated <= day
            and (self.cancelled is None or self.cancelled > day)
        )

    @property
    def is_trial(self) -> bool:
        return self.trial_ends is not None and self.previous_id is None

    @property
    def was_paid(self) -> bool:
        return self.activated is not None and (self.cancelled is None or self.activated < self.cancelled)


@dataclass(frozen=True)
class Cust:
    id: int
    name: str
    joined: date
    churned: date | None
    channel: str
    was_paid: bool


class MetricsEngine:
    def __init__(self, organization):
        self.organization = organization
        rows = list(
            Subscription.objects.filter(organization=organization).values(
                "id",
                "customer_id",
                "plan_id",
                "billing_cycle",
                "mrr",
                "started_at",
                "trial_ends_at",
                "activated_at",
                "cancelled_at",
                "previous_id",
            )
        )
        replaced = {row["previous_id"] for row in rows if row["previous_id"]}
        self.subs = [
            Sub(
                id=row["id"],
                customer_id=row["customer_id"],
                plan_id=row["plan_id"],
                cycle=row["billing_cycle"],
                mrr=float(row["mrr"]),
                started=row["started_at"],
                trial_ends=row["trial_ends_at"],
                activated=row["activated_at"],
                cancelled=row["cancelled_at"],
                previous_id=row["previous_id"],
                has_successor=row["id"] in replaced,
            )
            for row in rows
        ]
        self.sub_by_id = {sub.id: sub for sub in self.subs}
        paid_customers = {sub.customer_id for sub in self.subs if sub.activated}
        self.customers = [
            Cust(
                row["id"],
                row["company_name"],
                row["joined_at"],
                row["churned_at"],
                row["channel"],
                row["id"] in paid_customers,
            )
            for row in Customer.objects.filter(organization=organization).values(
                "id", "company_name", "joined_at", "churned_at", "channel"
            )
        ]
        self.customer_by_id = {c.id: c for c in self.customers}
        self.plans = list(Plan.objects.filter(organization=organization).order_by("sort_order", "monthly_price"))

    # ----------------------------------------------------------- point in time
    def mrr_at(self, day: date) -> float:
        return round(sum(s.mrr for s in self.subs if s.paid_on(day)), 2)

    def active_customer_ids(self, day: date) -> set[int]:
        return {s.customer_id for s in self.subs if s.paid_on(day)}

    def trialing_on(self, day: date) -> int:
        return sum(
            1
            for s in self.subs
            if s.trial_ends
            and s.started <= day < s.trial_ends
            and (s.activated is None or s.activated > day)
            and (s.cancelled is None or s.cancelled > day)
        )

    # ------------------------------------------------------------- over range
    def revenue_between(self, start: date, end: date) -> float:
        total = Transaction.objects.filter(
            organization=self.organization,
            status=Transaction.Status.PAID,
            occurred_at__date__range=(start, end),
        ).aggregate(total=Sum("amount"))["total"]
        return money(total)

    def movements(self, start: date, end: date) -> dict[str, float]:
        result = {"new": 0.0, "expansion": 0.0, "contraction": 0.0, "churned": 0.0}
        for s in self.subs:
            if s.activated and start <= s.activated <= end:
                prev = self.sub_by_id.get(s.previous_id) if s.previous_id else None
                if prev and prev.was_paid:
                    delta = s.mrr - prev.mrr
                    if delta >= 0:
                        result["expansion"] += delta
                    else:
                        result["contraction"] += -delta
                else:
                    result["new"] += s.mrr
            if s.cancelled and start <= s.cancelled <= end and s.was_paid and not s.has_successor:
                result["churned"] += s.mrr
        result = {key: round(value, 2) for key, value in result.items()}
        result["net_new"] = round(
            result["new"] + result["expansion"] - result["contraction"] - result["churned"], 2
        )
        return result

    def new_customers(self, start: date, end: date) -> int:
        return sum(1 for c in self.customers if start <= c.joined <= end)

    def churned_customers(self, start: date, end: date) -> int:
        return sum(1 for c in self.customers if c.was_paid and c.churned and start <= c.churned <= end)

    def trial_stats(self, start: date, end: date) -> dict[str, int]:
        started = sum(1 for s in self.subs if s.is_trial and start <= s.started <= end)
        ended = [s for s in self.subs if s.is_trial and start <= s.trial_ends <= end]
        converted = sum(1 for s in ended if s.activated is not None)
        return {"started": started, "ended": len(ended), "converted": converted}

    # --------------------------------------------------------------- KPIs
    def period_metrics(self, rng: DateRange) -> dict[str, float]:
        active_start = len(self.active_customer_ids(rng.start - timedelta(days=1)))
        active_end = len(self.active_customer_ids(rng.end))
        mrr = self.mrr_at(rng.end)
        churned = self.churned_customers(rng.start, rng.end)
        trials = self.trial_stats(rng.start, rng.end)
        return {
            "total_revenue": self.revenue_between(rng.start, rng.end),
            "mrr": mrr,
            "arr": round(mrr * 12, 2),
            "active_customers": active_end,
            "new_customers": self.new_customers(rng.start, rng.end),
            "churned_customers": churned,
            "churn_rate": round(
                ratio(churned, (active_start + active_end) / 2) / (rng.days / 30.44), 2
            ),
            "conversion_rate": ratio(trials["converted"], trials["ended"]),
            "arpu": round(mrr / active_end, 2) if active_end else 0.0,
            "trialing": self.trialing_on(rng.end),
        }

    def kpis(self, rng: DateRange) -> dict:
        current = self.period_metrics(rng)
        previous = self.period_metrics(rng.previous())
        kpis = {
            key: {"value": value, "previous": previous[key], "change": pct_change(value, previous[key])}
            for key, value in current.items()
        }
        kpis["revenue_growth"] = kpis["total_revenue"]["change"]
        kpis["customer_growth"] = kpis["active_customers"]["change"]
        return kpis

    # ----------------------------------------------------------- time series
    def timeseries(self, rng: DateRange) -> dict:
        granularity, buckets = build_buckets(rng)
        locate = bucket_index(buckets)
        n = len(buckets)

        revenue = [0.0] * n
        for occurred, amount in Transaction.objects.filter(
            organization=self.organization,
            status=Transaction.Status.PAID,
            occurred_at__date__range=(rng.start, rng.end),
        ).values_list("occurred_at", "amount"):
            idx = locate(occurred.date())
            if idx is not None:
                revenue[idx] += float(amount)

        new_customers = [0] * n
        churned_customers = [0] * n
        for c in self.customers:
            if (idx := locate(c.joined)) is not None:
                new_customers[idx] += 1
            if c.was_paid and c.churned and (idx := locate(c.churned)) is not None:
                churned_customers[idx] += 1

        trials_started = [0] * n
        trials_converted = [0] * n
        for s in self.subs:
            if s.is_trial and (idx := locate(s.started)) is not None:
                trials_started[idx] += 1
            if s.is_trial and s.activated and (idx := locate(s.activated)) is not None:
                trials_converted[idx] += 1

        points = []
        prev_active = len(self.active_customer_ids(rng.start - timedelta(days=1)))
        for i, bucket in enumerate(buckets):
            active = len(self.active_customer_ids(bucket.end))
            moves = self.movements(bucket.start, bucket.end)
            points.append(
                {
                    "date": bucket.label,
                    "period_end": bucket.end.isoformat(),
                    "revenue": round(revenue[i], 2),
                    "mrr": self.mrr_at(bucket.end),
                    "active_customers": active,
                    "new_customers": new_customers[i],
                    "churned_customers": churned_customers[i],
                    "churn_rate": ratio(churned_customers[i], prev_active),
                    "trials_started": trials_started[i],
                    "trials_converted": trials_converted[i],
                    "new_mrr": moves["new"],
                    "expansion_mrr": moves["expansion"],
                    "contraction_mrr": moves["contraction"],
                    "churned_mrr": moves["churned"],
                    "net_new_mrr": moves["net_new"],
                }
            )
            prev_active = active
        return {"granularity": granularity, "points": points}

    # --------------------------------------------------------------- plans
    def plan_breakdown(self, day: date) -> list[dict]:
        mrr = defaultdict(float)
        count = Counter()
        monthly = Counter()
        for s in self.subs:
            if s.paid_on(day):
                mrr[s.plan_id] += s.mrr
                count[s.plan_id] += 1
                if s.cycle == Subscription.Cycle.MONTHLY:
                    monthly[s.plan_id] += 1
        total = sum(mrr.values())
        return [
            {
                "plan_id": plan.id,
                "plan": plan.name,
                "slug": plan.slug,
                "mrr": round(mrr[plan.id], 2),
                "subscriptions": count[plan.id],
                "monthly": monthly[plan.id],
                "annual": count[plan.id] - monthly[plan.id],
                "share": ratio(mrr[plan.id], total),
            }
            for plan in self.plans
        ]

    def plan_performance(self, rng: DateRange) -> list[dict]:
        revenue_rows = (
            Transaction.objects.filter(
                organization=self.organization,
                status=Transaction.Status.PAID,
                occurred_at__date__range=(rng.start, rng.end),
                subscription__isnull=False,
            )
            .values("subscription__plan_id")
            .annotate(total=Sum("amount"))
        )
        revenue = {row["subscription__plan_id"]: money(row["total"]) for row in revenue_rows}
        prev_end = rng.start - timedelta(days=1)

        result = []
        for plan in self.plans:
            plan_subs = [s for s in self.subs if s.plan_id == plan.id]
            active_end = [s for s in plan_subs if s.paid_on(rng.end)]
            active_start = sum(1 for s in plan_subs if s.paid_on(prev_end))
            new = sum(1 for s in plan_subs if s.activated and rng.contains(s.activated))
            churned = sum(
                1
                for s in plan_subs
                if s.cancelled and rng.contains(s.cancelled) and s.was_paid and not s.has_successor
            )
            trials = [s for s in plan_subs if s.is_trial and rng.contains(s.trial_ends)]
            mrr = round(sum(s.mrr for s in active_end), 2)
            result.append(
                {
                    "plan_id": plan.id,
                    "plan": plan.name,
                    "slug": plan.slug,
                    "monthly_price": money(plan.monthly_price),
                    "subscribers": len(active_end),
                    "previous_subscribers": active_start,
                    "subscriber_change": pct_change(len(active_end), active_start),
                    "mrr": mrr,
                    "arpa": round(mrr / len(active_end), 2) if active_end else 0.0,
                    "revenue": revenue.get(plan.id, 0.0),
                    "new_subscriptions": new,
                    "churned_subscriptions": churned,
                    "churn_rate": round(
                        ratio(churned, (active_start + len(active_end)) / 2) / (rng.days / 30.44), 2
                    ),
                    "trial_conversion": ratio(sum(1 for s in trials if s.activated), len(trials)),
                }
            )
        return result

    # -------------------------------------------------------- acquisition
    def acquisition_by_channel(self, rng: DateRange) -> list[dict]:
        converted_customers = {s.customer_id for s in self.subs if s.activated and s.activated <= rng.end}
        joined = Counter()
        converted = Counter()
        for c in self.customers:
            if rng.contains(c.joined):
                joined[c.channel] += 1
                if c.id in converted_customers:
                    converted[c.channel] += 1
        labels = dict(Customer.Channel.choices)
        rows = [
            {
                "channel": code,
                "label": labels[code],
                "customers": joined[code],
                "converted": converted[code],
                "conversion_rate": ratio(converted[code], joined[code]),
            }
            for code in labels
        ]
        return sorted(rows, key=lambda row: row["customers"], reverse=True)

    def funnel(self, rng: DateRange) -> list[dict]:
        signups = [c for c in self.customers if rng.contains(c.joined)]
        signup_ids = {c.id for c in signups}
        trial_subs = [s for s in self.subs if s.is_trial and s.customer_id in signup_ids]
        paid_ids = {s.customer_id for s in self.subs if s.customer_id in signup_ids and s.activated}
        retained_ids = self.active_customer_ids(rng.end) & signup_ids
        steps = [
            ("Sign-ups", len(signups)),
            ("Started trial", len({s.customer_id for s in trial_subs})),
            ("Converted to paid", len(paid_ids)),
            ("Still active", len(retained_ids)),
        ]
        top = steps[0][1]
        return [{"stage": name, "count": value, "rate": ratio(value, top)} for name, value in steps]

    def retention_cohorts(self, end: date, cohorts: int = 6) -> list[dict]:
        end_month = month_start(end)
        rows = []
        for back in range(cohorts - 1, -1, -1):
            cohort_month = add_months(end_month, -back)
            members = [c for c in self.customers if month_start(c.joined) == cohort_month]
            values = []
            for offset in range(cohorts):
                check_month = add_months(cohort_month, offset)
                if check_month > end_month or not members:
                    values.append(None)
                    continue
                check_day = min(month_end(check_month), end)
                retained = sum(1 for c in members if c.churned is None or c.churned > check_day)
                values.append(ratio(retained, len(members)))
            rows.append({"cohort": cohort_month.isoformat(), "size": len(members), "retention": values})
        return rows

    # ------------------------------------------------------------ activity
    def activity(self, end: date, limit: int = 8) -> list[dict]:
        plan_names = {p.id: p.name for p in self.plans}
        events = []

        def name(customer_id):
            customer = self.customer_by_id.get(customer_id)
            return customer.name if customer else "Unknown customer"

        for s in self.subs:
            plan = plan_names.get(s.plan_id, "")
            if s.is_trial and s.started <= end:
                events.append((s.started, 1, "trial_started", s.customer_id, f"started a {plan} trial", s.mrr))
            if s.activated and s.activated <= end:
                prev = self.sub_by_id.get(s.previous_id) if s.previous_id else None
                if prev:
                    kind = "upgraded" if s.mrr >= prev.mrr else "downgraded"
                    text = f"{kind} from {plan_names.get(prev.plan_id, '')} to {plan}"
                elif s.trial_ends:
                    kind, text = "converted", f"converted to the {plan} plan"
                else:
                    kind, text = "subscribed", f"subscribed to {plan}"
                events.append((s.activated, 2, kind, s.customer_id, text, s.mrr))
            if s.cancelled and s.cancelled <= end and not s.has_successor:
                kind = "cancelled" if s.was_paid else "trial_expired"
                text = f"cancelled {plan}" if s.was_paid else f"let the {plan} trial expire"
                events.append((s.cancelled, 3, kind, s.customer_id, text, s.mrr))

        for occurred, customer_id, amount in (
            Transaction.objects.filter(
                organization=self.organization,
                status=Transaction.Status.FAILED,
                occurred_at__date__lte=end,
            )
            .order_by("-occurred_at")
            .values_list("occurred_at", "customer_id", "amount")[:limit]
        ):
            events.append((occurred.date(), 4, "payment_failed", customer_id, "had a payment fail", float(amount)))

        events.sort(key=lambda e: (e[0], e[1]), reverse=True)
        return [
            {
                "date": day.isoformat(),
                "type": kind,
                "customer_id": customer_id,
                "customer": name(customer_id),
                "description": text,
                "amount": round(amount, 2),
            }
            for day, _prio, kind, customer_id, text, amount in events[:limit]
        ]

    # ------------------------------------------------------------ headline
    def health(self, rng: DateRange) -> dict:
        moves = self.movements(rng.start, rng.end)
        start_mrr = self.mrr_at(rng.start - timedelta(days=1))
        end_metrics = self.period_metrics(rng)
        monthly_churn = end_metrics["churn_rate"]
        nrr = (
            (start_mrr + moves["expansion"] - moves["contraction"] - moves["churned"]) / start_mrr * 100
            if start_mrr
            else None
        )
        losses = moves["churned"] + moves["contraction"]
        return {
            "start_mrr": start_mrr,
            "end_mrr": end_metrics["mrr"],
            "mrr_growth": pct_change(end_metrics["mrr"], start_mrr),
            "net_revenue_retention": round(nrr, 1) if nrr is not None else None,
            "quick_ratio": round((moves["new"] + moves["expansion"]) / losses, 2) if losses else None,
            "monthly_churn": round(monthly_churn, 2),
            "ltv": round(end_metrics["arpu"] / (monthly_churn / 100), 2) if monthly_churn else None,
            "movements": moves,
        }


# ---------------------------------------------------------------- snapshots
def refresh_snapshots(organization, months: int = 24, engine: MetricsEngine | None = None) -> int:
    """Recompute month-end snapshots for the trailing `months` months."""
    from django.utils import timezone

    engine = engine or MetricsEngine(organization)
    today = timezone.localdate()
    first = add_months(month_start(today), -(months - 1))
    written = 0
    for i in range(months):
        start = add_months(first, i)
        end = min(month_end(start), today)
        moves = engine.movements(start, end)
        trials = engine.trial_stats(start, end)
        MetricSnapshot.objects.update_or_create(
            organization=organization,
            month=start,
            defaults={
                "revenue": Decimal(str(engine.revenue_between(start, end))),
                "mrr": Decimal(str(engine.mrr_at(end))),
                "new_mrr": Decimal(str(moves["new"])),
                "expansion_mrr": Decimal(str(moves["expansion"])),
                "contraction_mrr": Decimal(str(moves["contraction"])),
                "churned_mrr": Decimal(str(moves["churned"])),
                "active_customers": len(engine.active_customer_ids(end)),
                "new_customers": engine.new_customers(start, end),
                "churned_customers": engine.churned_customers(start, end),
                "trials_started": trials["started"],
                "trials_converted": trials["converted"],
            },
        )
        written += 1
    return written

