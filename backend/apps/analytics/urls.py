from django.urls import path

from .views import AnalyticsView, DashboardView, SnapshotListView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("analytics/", AnalyticsView.as_view(), name="analytics"),
    path("analytics/snapshots/", SnapshotListView.as_view(), name="snapshots"),
]
