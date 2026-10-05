from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Membership, Organization, User
from apps.analytics.services import MetricsEngine
from apps.billing.models import Customer, Plan, Subscription, Transaction
from apps.core.dates import DateRange, build_buckets


def make_workspace(name: str, email: str):
    org = Organization.objects.create(name=name, slug=Organization.unique_slug_for(name))
    user = User.objects.create_user(email=email, password="S3cure-pass!", first_name="Test", last_name="User")
    Membership.objects.create(user=user, organization=org, role=Membership.Role.OWNER)
    plan = Plan.objects.create(
        organization=org, name="Growth", slug="growth", monthly_price=Decimal("100"), annual_price=Decimal("1200")
    )
    return org, user, plan


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_creates_user_workspace_and_token(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "first_name": "Ada",
                "last_name": "Lovelace",
                "email": "ada@example.com",
                "password": "Analytical-Engine-1843",
                "organization_name": "Engine Co",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["organization"]["name"], "Engine Co")
        self.assertEqual(response.data["user"]["role"], "owner")

    def test_register_rejects_weak_password(self):
        response = self.client.post(
            "/api/auth/register/",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "password": "12345678", "organization_name": "Co"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["errors"])

    def test_login_and_protected_route(self):
        make_workspace("Acme", "owner@acme.com")
        self.assertEqual(self.client.get("/api/dashboard/").status_code, 401)
        login = self.client.post(
            "/api/auth/login/", {"email": "owner@acme.com", "password": "S3cure-pass!"}, format="json"
        )
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {login.data['token']}")
        self.assertEqual(self.client.get("/api/dashboard/").status_code, 200)
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_login_with_wrong_password(self):
        make_workspace("Acme", "owner@acme.com")
        response = self.client.post(
            "/api/auth/login/", {"email": "owner@acme.com", "password": "nope"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "Invalid email or password.")


class TenantIsolationTests(TestCase):
    def test_users_only_see_their_workspace_customers(self):
        org_a, user_a, _ = make_workspace("Alpha", "a@alpha.com")
        org_b, _, _ = make_workspace("Beta", "b@beta.com")
        today = timezone.localdate()
        Customer.objects.create(organization=org_a, company_name="Alpha Client", contact_name="X", email="x@a.com", country="Kenya", joined_at=today)
        other = Customer.objects.create(organization=org_b, company_name="Beta Client", contact_name="Y", email="y@b.com", country="Kenya", joined_at=today)

        client = APIClient()
        client.force_authenticate(user_a)
        listing = client.get("/api/customers/")
        self.assertEqual([c["company_name"] for c in listing.data["results"]], ["Alpha Client"])
        self.assertEqual(client.get(f"/api/customers/{other.id}/").status_code, 404)


class MetricsTests(TestCase):
    def setUp(self):
        self.org, self.user, self.plan = make_workspace("Metrics", "m@metrics.com")
        self.today = timezone.localdate()

    def customer(self, name: str, joined: date) -> Customer:
        return Customer.objects.create(
            organization=self.org, company_name=name, contact_name=name, email=f"{name}@x.com",
            country="Kenya", joined_at=joined,
        )

    def subscription(self, customer, activated, cancelled=None, cycle="monthly", price="100"):
        return Subscription.objects.create(
            organization=self.org, customer=customer, plan=self.plan, billing_cycle=cycle,
            price=Decimal(price), started_at=activated, activated_at=activated, cancelled_at=cancelled,
            status=Subscription.Status.CANCELLED if cancelled else Subscription.Status.ACTIVE,
        )

    def test_mrr_normalises_annual_plans_and_respects_cancellation(self):
        start = self.today - timedelta(days=60)
        self.subscription(self.customer("a", start), start)
        self.subscription(self.customer("b", start), start, cycle="annual", price="1200")
        self.subscription(self.customer("c", start), start, cancelled=self.today - timedelta(days=10))
        engine = MetricsEngine(self.org)
        self.assertEqual(engine.mrr_at(self.today), 200.0)
        self.assertEqual(engine.mrr_at(self.today - timedelta(days=20)), 300.0)

    def test_revenue_counts_only_paid_transactions(self):
        c = self.customer("a", self.today)
        for status, amount in [("paid", "50"), ("failed", "70"), ("refunded", "30"), ("paid", "25")]:
            Transaction.objects.create(
                organization=self.org, customer=c, reference=f"T-{status}-{amount}", amount=Decimal(amount),
                status=status, occurred_at=timezone.now(),
            )
        engine = MetricsEngine(self.org)
        self.assertEqual(engine.revenue_between(self.today, self.today), 75.0)

    def test_upgrade_counts_as_expansion_not_churn(self):
        start = self.today - timedelta(days=90)
        change = self.today - timedelta(days=5)
        customer = self.customer("a", start)
        old = self.subscription(customer, start, cancelled=change)
        new = self.subscription(customer, change, price="250")
        new.previous = old
        new.save()
        moves = MetricsEngine(self.org).movements(self.today - timedelta(days=29), self.today)
        self.assertEqual(moves["expansion"], 150.0)
        self.assertEqual(moves["churned"], 0.0)
        self.assertEqual(moves["new"], 0.0)

    def test_dashboard_endpoint_shape(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get("/api/dashboard/", {"start": "2026-01-01", "end": "2026-03-31"})
        self.assertEqual(response.status_code, 200)
        for key in ["kpis", "series", "plan_breakdown", "top_plans", "recent_transactions", "activity"]:
            self.assertIn(key, response.data)
        self.assertEqual(response.data["series"]["granularity"], "week")

    def test_invalid_range_is_rejected(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get("/api/dashboard/", {"start": "2026-05-01", "end": "2026-01-01"})
        self.assertEqual(response.status_code, 400)


class BucketTests(TestCase):
    def test_granularity_switches_with_range_length(self):
        self.assertEqual(build_buckets(DateRange(date(2026, 1, 1), date(2026, 1, 7)))[0], "day")
        granularity, buckets = build_buckets(DateRange(date(2025, 1, 15), date(2025, 12, 31)))
        self.assertEqual(granularity, "month")
        self.assertEqual(len(buckets), 12)
        self.assertEqual(buckets[0].start, date(2025, 1, 15))


class EndpointSmokeTests(TestCase):
    """Every list/summary endpoint should respond 200 for a workspace member."""

    def test_endpoints_respond(self):
        _, user, _ = make_workspace("Smoke", "s@smoke.com")
        client = APIClient()
        client.force_authenticate(user)
        for url in [
            "/api/plans/", "/api/customers/", "/api/customers/summary/", "/api/subscriptions/",
            "/api/subscriptions/stats/", "/api/transactions/", "/api/transactions/summary/",
            "/api/analytics/", "/api/analytics/snapshots/", "/api/reports/", "/api/auth/me/preferences/",
        ]:
            self.assertEqual(client.get(url).status_code, 200, url)


class AccountDeletionTests(TestCase):
    def test_sole_member_can_delete_account_and_workspace(self):
        org, user, plan = make_workspace("Solo", "solo@x.com")
        today = timezone.localdate()
        customer = Customer.objects.create(organization=org, company_name="C", contact_name="C", email="c@c.com", country="Kenya", joined_at=today)
        Subscription.objects.create(organization=org, customer=customer, plan=plan, price=Decimal("10"), started_at=today, activated_at=today)
        client = APIClient()
        client.force_authenticate(user)
        response = client.delete("/api/auth/me/", {"password": "S3cure-pass!"}, format="json")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Organization.objects.filter(pk=org.pk).exists())


class SubscriptionLifecycleTests(TestCase):
    def test_plan_customer_trial_upgrade_cancel(self):
        _, user, _ = make_workspace("Flow", "f@flow.com")
        client = APIClient()
        client.force_authenticate(user)

        plan = client.post(
            "/api/plans/",
            {"name": "Scale", "monthly_price": "200.00", "annual_price": "2000.00", "features": ["SSO"]},
            format="json",
        )
        self.assertEqual(plan.status_code, 201, plan.data)
        bad_plan = client.post("/api/plans/", {"name": "Bad", "monthly_price": "10", "annual_price": "500"}, format="json")
        self.assertEqual(bad_plan.status_code, 400)

        customer = client.post(
            "/api/customers/",
            {"company_name": "Acme", "contact_name": "Ann", "email": "ann@acme.com", "country": "Kenya",
             "joined_at": timezone.localdate().isoformat()},
            format="json",
        )
        self.assertEqual(customer.status_code, 201, customer.data)
        cid = customer.data["id"]

        trial = client.post("/api/subscriptions/", {"customer_id": cid, "plan_id": plan.data["id"], "billing_cycle": "monthly"}, format="json")
        self.assertEqual(trial.status_code, 201)
        self.assertEqual(trial.data["status"], "trialing")
        self.assertEqual(client.get(f"/api/customers/{cid}/").data["status"], "trialing")

        duplicate = client.post("/api/subscriptions/", {"customer_id": cid, "plan_id": plan.data["id"], "billing_cycle": "monthly"}, format="json")
        self.assertEqual(duplicate.status_code, 400)

        changed = client.post(f"/api/subscriptions/{trial.data['id']}/change-plan/", {"plan_id": plan.data["id"], "billing_cycle": "annual"}, format="json")
        self.assertEqual(changed.status_code, 200)
        cancelled = client.post(f"/api/subscriptions/{changed.data['id']}/cancel/", {"reason": "Budget cuts"}, format="json")
        self.assertEqual(cancelled.data["status"], "cancelled")
        self.assertEqual(client.get(f"/api/customers/{cid}/").data["status"], "churned")
