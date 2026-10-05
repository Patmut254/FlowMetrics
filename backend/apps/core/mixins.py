class OrganizationScopedMixin:
    """
    Restricts a view's queryset to the requesting user's workspace and stamps
    the workspace on newly created objects. Prevents cross-tenant data access.
    """

    def get_organization(self):
        return self.request.user.organization

    def get_queryset(self):
        return super().get_queryset().filter(organization=self.get_organization())

    def perform_create(self, serializer):
        serializer.save(organization=self.get_organization())

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context
