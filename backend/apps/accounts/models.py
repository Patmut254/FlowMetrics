from functools import cached_property

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Application user. Authenticates with email instead of a username."""

    username = None
    email = models.EmailField(unique=True)
    job_title = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    timezone = models.CharField(max_length=64, default="UTC")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        ordering = ["first_name", "last_name"]

    def __str__(self) -> str:
        return self.email

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.email

    @cached_property
    def membership(self) -> "Membership | None":
        return self.memberships.select_related("organization").first()

    @property
    def organization(self) -> "Organization | None":
        membership = self.membership
        return membership.organization if membership else None


class Organization(TimeStampedModel):
    """A workspace. All business data is scoped to an organization."""

    class Currency(models.TextChoices):
        USD = "USD", "US Dollar"
        EUR = "EUR", "Euro"
        GBP = "GBP", "British Pound"

    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, unique=True)
    industry = models.CharField(max_length=120, blank=True)
    website = models.URLField(blank=True)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.USD)
    timezone = models.CharField(max_length=64, default="UTC")
    fiscal_year_start = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @classmethod
    def unique_slug_for(cls, name: str) -> str:
        base = slugify(name)[:150] or "workspace"
        slug, counter = base, 2
        while cls.objects.filter(slug=slug).exists():
            slug = f"{base}-{counter}"
            counter += 1
        return slug


class Membership(TimeStampedModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "organization"], name="unique_membership"),
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.organization} ({self.role})"


class UserPreferences(TimeStampedModel):
    """Per-user notification and appearance preferences."""

    class Theme(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
        SYSTEM = "system", "System"

    class DefaultRange(models.TextChoices):
        LAST_7 = "7d", "Last 7 days"
        LAST_30 = "30d", "Last 30 days"
        LAST_90 = "90d", "Last 90 days"
        LAST_12M = "12m", "Last 12 months"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="preferences")
    theme = models.CharField(max_length=10, choices=Theme.choices, default=Theme.SYSTEM)
    compact_tables = models.BooleanField(default=False)
    default_date_range = models.CharField(
        max_length=4, choices=DefaultRange.choices, default=DefaultRange.LAST_30
    )
    notify_weekly_digest = models.BooleanField(default=True)
    notify_payment_failed = models.BooleanField(default=True)
    notify_new_customer = models.BooleanField(default=False)
    notify_churn_alert = models.BooleanField(default=True)
    notify_product_updates = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"Preferences for {self.user}"
