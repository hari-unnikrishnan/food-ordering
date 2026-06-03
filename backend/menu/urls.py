from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, ItemViewSet, OrderViewSet

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="categories")
router.register(r"items", ItemViewSet, basename="items")
router.register(r"orders", OrderViewSet, basename="orders")

urlpatterns = [
    path("", include(router.urls)),
]

