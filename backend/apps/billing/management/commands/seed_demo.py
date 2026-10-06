"""
Seed a realistic demo workspace.

Simulates ~24 months of a growing B2B SaaS business: customers sign up through
different channels, run trials, convert (or not), pay monthly or annually,
upgrade, fail payments and churn. All dashboard metrics are later derived
from these rows - nothing is pre-aggregated except month-end snapshots.

    python manage.py seed_demo            # create the demo workspace
    python manage.py seed_demo --reset    # wipe and recreate it
"""
from __future__ import annotations

import math
import random
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Membership, Organization, User, UserPreferences
from apps.analytics.services import MetricsEngine, refresh_snapshots
from apps.billing.models import Customer, Plan, Subscription, Transaction
from apps.core.dates import DateRange, add_months, month_start
from apps.reports.generators import build_report
from apps.reports.models import Report

DEMO_EMAIL = "demo@flowmetrics.io"
DEMO_PASSWORD = "FlowMetrics2026!"
DEMO_ORG_SLUG = "lumina-cloud"
HISTORY_DAYS = 730
TRIAL_DAYS = 14

PLANS = [
    # name, description, monthly, annual, features, pick weight, monthly churn
    ("Starter", "For small teams getting started with analytics.", 29, 290,
     ["Up to 3 seats", "5 dashboards", "7-day data retention", "Email support"], 0.42, 0.048),
    ("Growth", "For scaling teams that need deeper insight.", 79, 790,
     ["Up to 10 seats", "Unlimited dashboards", "90-day retention", "Integrations", "Priority email support"], 0.33, 0.031),
    ("Scale", "Advanced analytics for data-driven companies.", 199, 1990,
     ["Up to 40 seats", "Custom metrics", "1-year retention", "SSO", "Chat support"], 0.19, 0.019),
    ("Enterprise", "Security, control and support for large organisations.", 499, 4990,
     ["Unlimited seats", "Dedicated CSM", "Unlimited retention", "Audit logs", "99.9% SLA"], 0.06, 0.009),
]

CHANNELS = [
    # code, weight, trial conversion probability, plan tier bias
    ("organic", 0.34, 0.58, 0),
    ("paid", 0.22, 0.47, 0),
    ("referral", 0.18, 0.71, 0),
    ("partner", 0.12, 0.66, 1),
    ("outbound", 0.14, 0.62, 2),
]

PREFIXES = [
    "Blue", "North", "Bright", "Silver", "Quantum", "Nimbus", "Atlas", "Vertex", "Cobalt", "Ember",
    "Lumen", "Harbor", "Summit", "Pioneer", "Cedar", "Orbit", "Nova", "Polar", "Crest", "Echo",
    "Falcon", "Granite", "Helix", "Iris", "Juniper", "Keystone", "Lattice", "Meridian", "Nexa", "Onyx",
    "Prism", "Quill", "Redwood", "Sable", "Tidal", "Umbra", "Vanta", "Willow", "Zenith", "Aurora",
    "Beacon", "Canopy", "Delta", "Elevate", "Fathom", "Glacier", "Horizon", "Indigo", "Kinetic", "Lark",
    "Mosaic", "Northstar", "Opal", "Paragon", "Radiant", "Solstice", "Tandem", "Upland", "Vivid", "Wavelength",
]
SUFFIXES = [
    "Labs", "Analytics", "Health", "Logistics", "Systems", "Studio", "Software", "Partners", "Retail",
    "Finance", "Robotics", "Media", "Energy", "Bio", "Commerce", "Cloud", "Security", "Learning",
    "Mobility", "Foods", "Ventures", "Networks", "Digital", "Works", "Group", "Data", "AI", "Travel",
]
INDUSTRY_BY_SUFFIX = {
    "Health": "Healthcare", "Bio": "Healthcare", "Logistics": "Logistics", "Mobility": "Logistics",
    "Retail": "E-commerce", "Commerce": "E-commerce", "Foods": "E-commerce", "Finance": "Fintech",
    "Ventures": "Fintech", "Media": "Media", "Studio": "Media", "Energy": "Energy",
    "Learning": "Education", "Travel": "Travel", "Security": "Cybersecurity",
}
FIRST_NAMES = [
    "Amara", "Liam", "Sofia", "Noah", "Wanjiru", "Mateo", "Aisha", "Lucas", "Priya", "Ethan",
    "Zara", "Oliver", "Chloe", "Kwame", "Mia", "Hiro", "Elena", "Daniel", "Fatima", "Jonas",
    "Grace", "Arjun", "Leila", "Samuel", "Nia", "Tomás", "Ingrid", "Omar", "Hannah", "Diego",
]
LAST_NAMES = [
    "Okafor", "Bennett", "Rossi", "Kimani", "Schmidt", "Nakamura", "Haddad", "Silva", "Patel", "Novak",
    "Laurent", "Mensah", "Andersen", "García", "Cohen", "Mwangi", "Fischer", "Tanaka", "Moreau", "Osei",
    "Johansson", "Reyes", "Kowalski", "Adeyemi", "Murphy", "Chen", "Dubois", "Otieno", "Lindqvist", "Costa",
]
COUNTRIES = [
    ("United States", 0.30), ("United Kingdom", 0.12), ("Germany", 0.10), ("Canada", 0.07),
    ("Netherlands", 0.06), ("France", 0.06), ("Kenya", 0.05), ("Australia", 0.05), ("Sweden", 0.04),
    ("Nigeria", 0.04), ("Spain", 0.04), ("Singapore", 0.04), ("Brazil", 0.03),
]
SIZES = [("1-10", 0.22), ("11-50", 0.36), ("51-200", 0.24), ("201-1000", 0.12), ("1000+", 0.06)]
CANCEL_REASONS = [
    "Too expensive", "Switched to a competitor", "Missing features", "No longer needed",
    "Budget cuts", "Company closed", "Poor onboarding experience",
]
METHODS = [("card", 0.78), ("bank_transfer", 0.12), ("paypal", 0.10)]


def weighted(rng: random.Random, options):
    return rng.choices([o[0] for o in options], weights=[o[1] for o in options], k=1)[0]


def poisson(rng: random.Random, lam: float) -> int:
    threshold, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= threshold:
            return k
        k += 1


class Command(BaseCommand):
    help = "Create a demo workspace populated with realistic SaaS data."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete and recreate the demo workspace.")
        parser.add_argument("--seed", type=int, default=2026, help="Random seed for reproducible data.")

    def handle(self, *args, **options):
        existing = Organization.objects.filter(slug=DEMO_ORG_SLUG).first()
        if existing and not options["reset"]:
            raise CommandError("Demo workspace already exists. Re-run with --reset to recreate it.")

        with transaction.atomic():
            if existing:
                existing.delete()
            User.objects.filter(email=DEMO_EMAIL).delete()
            self.rng = random.Random(options["seed"])
            self.today = timezone.localdate()
            self.refs: set[str] = set()
            self.build()

        self.stdout.write(self.style.SUCCESS("Demo workspace ready."))
        self.stdout.write(f"  Login:    {DEMO_EMAIL}")
        self.stdout.write(f"  Password: {DEMO_PASSWORD}")

    # ------------------------------------------------------------------ build
    def build(self):
        org = Organization.objects.create(
            name="Lumina Cloud",
            slug=DEMO_ORG_SLUG,
            industry="B2B Software",
            website="https://lumina-cloud.example.com",
            currency="USD",
            timezone="UTC",
        )
        user = User.objects.create_user(
            email=DEMO_EMAIL,
            password=DEMO_PASSWORD,
            first_name="Alex",
            last_name="Morgan",
            job_title="Head of Revenue Operations",
            timezone="UTC",
        )
        Membership.objects.create(user=user, organization=org, role=Membership.Role.OWNER)
        UserPreferences.objects.create(user=user)

        plans = [
            Plan.objects.create(
                organization=org,
                name=name,
                slug=name.lower(),
                description=desc,
                monthly_price=Decimal(monthly),
                annual_price=Decimal(annual),
                features=features,
                trial_days=TRIAL_DAYS,
                is_featured=name == "Growth",
                sort_order=i,
            )
            for i, (name, desc, monthly, annual, features, _w, _c) in enumerate(PLANS)
        ]
        self.plans = plans
        self.plan_churn = {p.id: PLANS[i][6] for i, p in enumerate(plans)}

        customers = self.make_customers(org)
        Customer.objects.bulk_create(customers)
        customers = list(Customer.objects.filter(organization=org).order_by("joined_at", "id"))

        subs: list[Subscription] = []
        links: list[tuple[int, int]] = []  # (sub index, previous sub index)
        txns: list[Transaction] = []
        for customer in customers:
            self.simulate(org, customer, subs, links, txns)

        Subscription.objects.bulk_create(subs, batch_size=500)
        for idx, prev_idx in links:
            subs[idx].previous_id = subs[prev_idx].id
        Subscription.objects.bulk_update([subs[i] for i, _ in links], ["previous"], batch_size=500)

        for txn in txns:
            txn.subscription_id = txn.subscription.id
        Transaction.objects.bulk_create(txns, batch_size=1000)

        self.finalise_customers(customers, subs)
        Customer.objects.bulk_update(customers, ["status", "churned_at"], batch_size=500)

        engine = MetricsEngine(org)
        refresh_snapshots(org, engine=engine)
        self.make_reports(org, user)

        self.stdout.write(
            f"  {len(customers)} customers · {len(subs)} subscriptions · {len(txns)} transactions"
        )

    # -------------------------------------------------------------- customers
    def make_customers(self, org) -> list[Customer]:
        rng = self.rng
        names = [f"{p} {s}" for p in PREFIXES for s in SUFFIXES]
        rng.shuffle(names)
        start = self.today - timedelta(days=HISTORY_DAYS)
        customers = []
        for offset in range(HISTORY_DAYS + 1):
            day = start + timedelta(days=offset)
            progress = offset / HISTORY_DAYS
            weekday_factor = 0.55 if day.weekday() >= 5 else 1.1
            lam = (0.32 + 0.62 * progress) * weekday_factor
            for _ in range(poisson(rng, lam)):
                if not names:
                    break
                company = names.pop()
                first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
                domain = company.lower().replace(" ", "") + ".com"
                suffix = company.split(" ", 1)[1]
                customers.append(
                    Customer(
                        organization=org,
                        company_name=company,
                        contact_name=f"{first} {last}",
                        email=f"{first.lower()}.{last.lower()}@{domain}".encode("ascii", "ignore").decode(),
                        country=weighted(rng, COUNTRIES),
                        industry=INDUSTRY_BY_SUFFIX.get(suffix, "Technology"),
                        company_size=weighted(rng, SIZES),
                        channel=weighted(rng, [(c[0], c[1]) for c in CHANNELS]),
                        joined_at=day,
                        status=Customer.Status.TRIALING,
                    )
                )
        return customers

    # --------------------------------------------------------------- lifecycle
    def pick_plan(self, channel: str) -> int:
        bias = next(c[3] for c in CHANNELS if c[0] == channel)
        weights = [p[5] for p in PLANS]
        if bias:
            weights = [w * (1 + bias * 0.6 * i) for i, w in enumerate(weights)]
        return self.rng.choices(range(len(PLANS)), weights=weights, k=1)[0]

    def new_sub(self, org, customer, plan_index, cycle, started, **dates) -> Subscription:
        plan = self.plans[plan_index]
        price = plan.annual_price if cycle == "annual" else plan.monthly_price
        return Subscription(
            organization=org,
            customer=customer,
            plan=plan,
            billing_cycle=cycle,
            price=price,
            mrr=Subscription.normalise_mrr(price, cycle),
            started_at=started,
            status=Subscription.Status.ACTIVE,
            **dates,
        )

    def simulate(self, org, customer, subs, links, txns):
        rng, today = self.rng, self.today
        channel = next(c for c in CHANNELS if c[0] == customer.channel)
        plan_index = self.pick_plan(customer.channel)
        cycle = "annual" if rng.random() < (0.45 if plan_index == 3 else 0.26) else "monthly"
        start = customer.joined_at

        if rng.random() < 0.86:  # trial first
            trial_end = start + timedelta(days=TRIAL_DAYS)
            sub = self.new_sub(org, customer, plan_index, cycle, start, trial_ends_at=trial_end)
            subs.append(sub)
            if trial_end > today:
                sub.status = Subscription.Status.TRIALING
                sub.current_period_end = trial_end
                return
            if rng.random() > channel[2]:
                sub.status = Subscription.Status.CANCELLED
                sub.cancelled_at = trial_end
                sub.cancel_reason = "Trial expired"
                return
            sub.activated_at = trial_end
        else:
            sub = self.new_sub(org, customer, plan_index, cycle, start, activated_at=start)
            subs.append(sub)

        self.run_billing(org, customer, sub, plan_index, subs, links, txns)

    def run_billing(self, org, customer, sub, plan_index, subs, links, txns):
        rng, today = self.rng, self.today
        period_start = sub.activated_at
        months_live = 0
        while True:
            annual = sub.billing_cycle == "annual"
            period_end = period_start + timedelta(days=365 if annual else 30)
            is_latest = period_end > today
            self.invoice(org, customer, sub, period_start, txns, latest=is_latest)

            if is_latest:
                sub.current_period_end = period_end
                return

            months_live += 12 if annual else 1
            # Churn: monthly hazard (lower for long-tenured customers); annual at renewal.
            hazard = self.plan_churn[sub.plan_id] * (0.75 if months_live > 9 else 1.0)
            churn_p = min(0.6, hazard * 12 * 0.42) if annual else hazard
            if rng.random() < churn_p:
                sub.status = Subscription.Status.CANCELLED
                sub.cancelled_at = period_end
                sub.cancel_reason = rng.choice(CANCEL_REASONS)
                return

            # Plan changes happen at a period boundary and create a new subscription.
            roll = rng.random()
            new_index = None
            if roll < (0.06 if annual else 0.022) and plan_index < len(PLANS) - 1:
                new_index = plan_index + 1
            elif roll > 0.994 and plan_index > 0:
                new_index = plan_index - 1
            if new_index is not None:
                sub.status = Subscription.Status.CANCELLED
                sub.cancelled_at = period_end
                sub.cancel_reason = "Plan change"
                prev_idx = len(subs) - 1 if subs[-1] is sub else subs.index(sub)
                replacement = self.new_sub(
                    org, customer, new_index, sub.billing_cycle, period_end, activated_at=period_end
                )
                subs.append(replacement)
                links.append((len(subs) - 1, prev_idx))
                sub, plan_index = replacement, new_index

            period_start = period_end

    def invoice(self, org, customer, sub, on: date, txns, latest: bool):
        rng, today = self.rng, self.today

        def add(day: date, status: str):
            ref = f"TXN-{rng.getrandbits(40):010X}"
            while ref in self.refs:
                ref = f"TXN-{rng.getrandbits(40):010X}"
            self.refs.add(ref)
            occurred = datetime.combine(day, time(rng.randint(6, 21), rng.randint(0, 59)), tzinfo=dt_timezone.utc)
            txns.append(
                Transaction(
                    organization=org,
                    customer=customer,
                    subscription=sub,
                    reference=ref,
                    amount=sub.price,
                    currency="USD",
                    status=status,
                    method=weighted(rng, METHODS),
                    description=f"{sub.plan.name} · {sub.get_billing_cycle_display()}",
                    occurred_at=occurred,
                )
            )

        if on > today:
            return
        roll = rng.random()
        if latest and (today - on).days <= 2 and roll < 0.5:
            add(on, Transaction.Status.PENDING)
        elif latest and roll < 0.035:
            add(on, Transaction.Status.FAILED)
            sub.status = Subscription.Status.PAST_DUE
        elif roll < 0.045:
            add(on, Transaction.Status.FAILED)
            retry = on + timedelta(days=rng.randint(1, 4))
            add(min(retry, today), Transaction.Status.PAID)
        elif roll < 0.058:
            add(on, Transaction.Status.REFUNDED)
        else:
            add(on, Transaction.Status.PAID)

    def finalise_customers(self, customers, subs):
        by_customer: dict[int, list[Subscription]] = {}
        for sub in subs:
            by_customer.setdefault(sub.customer_id, []).append(sub)
        for customer in customers:
            own = by_customer.get(customer.id, [])
            live = [s for s in own if s.status != Subscription.Status.CANCELLED]
            if not live:
                customer.status = Customer.Status.CHURNED
                customer.churned_at = max((s.cancelled_at for s in own if s.cancelled_at), default=None)
            elif any(s.status == Subscription.Status.PAST_DUE for s in live):
                customer.status = Customer.Status.PAST_DUE
            elif any(s.status == Subscription.Status.ACTIVE for s in live):
                customer.status = Customer.Status.ACTIVE
            else:
                customer.status = Customer.Status.TRIALING

    def make_reports(self, org, user):
        this_month = month_start(self.today)
        quarter = self.last_quarter()
        quarter_name = f"Q{(quarter.start.month - 1) // 3 + 1} {quarter.start.year}"
        definitions = [
            ("Executive summary - last 12 months", "executive",
             DateRange(add_months(this_month, -12), this_month - timedelta(days=1))),
            (f"{quarter_name} revenue review", "revenue", quarter),
            ("Customer health - last 90 days", "customers",
             DateRange(self.today - timedelta(days=89), self.today)),
        ]
        for name, kind, rng in definitions:
            Report.objects.create(
                organization=org,
                created_by=user,
                name=name,
                report_type=kind,
                period_start=rng.start,
                period_end=rng.end,
                data=build_report(org, kind, rng),
            )

    def last_quarter(self) -> DateRange:
        quarter_start_month = ((self.today.month - 1) // 3) * 3 + 1
        current_q = date(self.today.year, quarter_start_month, 1)
        prev_q = add_months(current_q, -3)
        return DateRange(prev_q, current_q - timedelta(days=1))
