from rest_framework.permissions import SAFE_METHODS, BasePermission


class HasOrganization(BasePermission):
    """Authenticated users must belong to a workspace to use the API."""

    message = "Your account is not associated with a workspace."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            # Let IsAuthenticated / AllowAny decide for anonymous requests.
            return True
        return user.organization is not None


class IsWorkspaceAdminOrReadOnly(BasePermission):
    """Only owners and admins may modify workspace-level resources."""

    message = "Only workspace owners and admins can make this change."

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        membership = request.user.membership
        return membership is not None and membership.role in {"owner", "admin"}
