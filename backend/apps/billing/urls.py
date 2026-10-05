from rest_framework.routers import DefaultRouter

from .views import CustomerViewSet, PlanViewSet, SubscriptionViewSet, TransactionViewSet

router = DefaultRouter()
router.register("plans", PlanViewSet, basename="plan")
router.register("customers", CustomerViewSet, basename="customer")
router.register("subscriptions", SubscriptionViewSet, basename="subscription")
router.register("transactions", TransactionViewSet, basename="transaction")

urlpatterns = router.urls
