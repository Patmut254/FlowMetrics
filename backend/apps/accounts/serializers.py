from django.contrib.auth import authenticate, password_validation
from django.db import transaction
from rest_framework import serializers

from .models import Membership, Organization, User, UserPreferences


class OrganizationSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "industry",
            "website",
            "currency",
            "timezone",
            "fiscal_year_start",
            "member_count",
            "created_at",
        ]
        read_only_fields = ["id", "slug", "member_count", "created_at"]

    def get_member_count(self, obj: Organization) -> int:
        return obj.memberships.count()

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Workspace name must be at least 2 characters.")
        return value

    def validate_fiscal_year_start(self, value: int) -> int:
        if not 1 <= value <= 12:
            raise serializers.ValidationError("Choose a month between 1 and 12.")
        return value


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    role = serializers.SerializerMethodField()
    organization = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "job_title",
            "phone",
            "timezone",
            "role",
            "organization",
            "date_joined",
        ]
        read_only_fields = ["id", "email", "full_name", "role", "organization", "date_joined"]

    def get_role(self, obj: User) -> str | None:
        return obj.membership.role if obj.membership else None

    def get_organization(self, obj: User):
        org = obj.organization
        return OrganizationSerializer(org).data if org else None

    def validate_first_name(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("First name is required.")
        return value.strip()


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    organization_name = serializers.CharField(max_length=150)

    def validate_email(self, value: str) -> str:
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_organization_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Workspace name must be at least 2 characters.")
        return value

    def validate(self, attrs):
        candidate = User(
            email=attrs["email"], first_name=attrs["first_name"], last_name=attrs["last_name"]
        )
        try:
            password_validation.validate_password(attrs["password"], user=candidate)
        except Exception as exc:  # django.core.exceptions.ValidationError
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs

    @transaction.atomic
    def create(self, validated_data) -> User:
        org_name = validated_data.pop("organization_name")
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"].strip(),
            last_name=validated_data["last_name"].strip(),
        )
        organization = Organization.objects.create(
            name=org_name, slug=Organization.unique_slug_for(org_name)
        )
        Membership.objects.create(user=user, organization=organization, role=Membership.Role.OWNER)
        UserPreferences.objects.create(user=user)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            email=attrs["email"].strip().lower(),
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated.")
        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    def validate_current_password(self, value: str) -> str:
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Your current password is incorrect.")
        return value

    def validate_new_password(self, value: str) -> str:
        user = self.context["request"].user
        try:
            password_validation.validate_password(value, user=user)
        except Exception as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value


class PreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = [
            "theme",
            "compact_tables",
            "default_date_range",
            "notify_weekly_digest",
            "notify_payment_failed",
            "notify_new_customer",
            "notify_churn_alert",
            "notify_product_updates",
        ]
