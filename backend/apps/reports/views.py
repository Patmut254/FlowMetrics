import csv

from django.http import HttpResponse
from django.utils.text import slugify
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.dates import MAX_RANGE_DAYS, DateRange
from apps.core.mixins import OrganizationScopedMixin

from .generators import build_report
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    created_by = serializers.CharField(source="created_by.full_name", read_only=True, default=None)
    report_type_label = serializers.CharField(source="get_report_type_display", read_only=True)

    class Meta:
        model = Report
        fields = [
            "id",
            "name",
            "report_type",
            "report_type_label",
            "period_start",
            "period_end",
            "created_by",
            "created_at",
            "data",
        ]
        read_only_fields = ["id", "created_by", "created_at", "data", "report_type_label"]

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Report name must be at least 3 characters.")
        return value

    def validate(self, attrs):
        start, end = attrs["period_start"], attrs["period_end"]
        if start > end:
            raise serializers.ValidationError({"period_end": ["End date must be after the start date."]})
        if (end - start).days + 1 > MAX_RANGE_DAYS:
            raise serializers.ValidationError({"period_start": ["Reports can cover at most three years."]})
        return attrs


class ReportListSerializer(ReportSerializer):
    class Meta(ReportSerializer.Meta):
        fields = [f for f in ReportSerializer.Meta.fields if f != "data"]


class ReportViewSet(
    OrganizationScopedMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Report.objects.select_related("created_by")

    def get_serializer_class(self):
        return ReportListSerializer if self.action == "list" else ReportSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if report_type := self.request.query_params.get("type"):
            queryset = queryset.filter(report_type=report_type)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        rng = DateRange(data["period_start"], data["period_end"])
        organization = self.get_organization()
        report = serializer.save(
            organization=organization,
            created_by=request.user,
            data=build_report(organization, data["report_type"], rng),
        )
        return Response(ReportSerializer(report).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def export(self, request, pk=None):
        report = self.get_object()
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{slugify(report.name) or "report"}.csv"'
        writer = csv.writer(response)
        writer.writerow([report.name])
        writer.writerow([f"{report.get_report_type_display()}", f"{report.period_start} to {report.period_end}"])
        writer.writerow([])
        writer.writerow(["Summary"])
        for item in report.data.get("summary", []):
            writer.writerow([item["label"], item["value"]])
        for table in report.data.get("tables", []):
            writer.writerow([])
            writer.writerow([table["title"]])
            writer.writerow([c["label"] for c in table["columns"]])
            for row in table["rows"]:
                writer.writerow([row.get(c["key"], "") for c in table["columns"]])
        return response
