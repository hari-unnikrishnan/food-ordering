from decimal import Decimal


from django.db import transaction

from rest_framework import status, viewsets
from rest_framework.response import Response

from .models import Category, Item, Order, OrderLine
from .serializers import (
    CategorySerializer,
    ItemSerializer,
    OrderSerializer,
    PlaceOrderSerializer,
)



class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    http_method_names = ["get", "post", "head", "options"]




class ItemViewSet(viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    queryset = Item.objects.select_related("category").all()

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        search = self.request.query_params.get("search")

        available_filter = self.request.query_params.get("available")
        if available_filter is not None:
            if available_filter.lower() in ("1", "true", "yes", "available"):
                qs = qs.filter(availability="available")
            elif available_filter.lower() in ("special",):
                qs = qs.filter(availability="special")


        if category:
            qs = qs.filter(category__name=category)

        if search:
            qs = qs.filter(name__icontains=search)

        return qs


import uuid
from django.utils import timezone


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer

    http_method_names = ["post", "get"]

    def _simulate_status(self, order: Order):
        """Simulate progression using elapsed time since creation.

        Dine-in: PLACED -> CONFIRMED -> PREPARING -> READY
        Delivery: PLACED -> CONFIRMED -> PREPARING -> READY ->
                  OUT_FOR_DELIVERY -> DELIVERED
        """
        # If the order is already in a later stage, keep it there.
        if order.status in {
            Order.OrderStatus.DELIVERED,
            Order.OrderStatus.OUT_FOR_DELIVERY,
        }:
            return order.status


        elapsed = timezone.now() - order.created_at
        seconds = int(elapsed.total_seconds())


        # Dine in (timed simulation):
        #   0-1s   -> PLACED
        #   1-3s   -> CONFIRMED
        #   3-6s   -> PREPARING
        #   6-10s  -> READY
        # NOTE: For this simulation, dine-in transitions to READY (no OUT_FOR_DELIVERY state for dine-in).
        if order.order_type == Order.OrderType.DINE_IN:
            if seconds < 1:
                return Order.OrderStatus.PLACED
            if seconds < 3:
                return Order.OrderStatus.CONFIRMED
            if seconds < 6:
                return Order.OrderStatus.PREPARING
            return Order.OrderStatus.READY

        # Delivery (seconds-based simulation)
        # Requested timeline for Delivery Home:
        #   < 1s  -> PLACED
        #   < 3s  -> CONFIRMED
        #   < 6s  -> OUT_FOR_DELIVERY
        #   >= 6s -> DELIVERED
        if seconds < 1:
            return Order.OrderStatus.PLACED
        if seconds < 3:
            return Order.OrderStatus.CONFIRMED
        if seconds < 6:
            return Order.OrderStatus.OUT_FOR_DELIVERY
        return Order.OrderStatus.DELIVERED

    def create(self, request, *args, **kwargs):
        serializer = PlaceOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tax_rate = serializer.validated_data.get("tax_rate", Decimal("10.00"))
        lines = serializer.validated_data["lines"]

        order_type = serializer.validated_data.get("order_type", Order.OrderType.DINE_IN)
        table_number = serializer.validated_data.get("table_number")
        delivery_address = serializer.validated_data.get("delivery_address")

        if order_type == Order.OrderType.DINE_IN:
            if not table_number or not str(table_number).strip():
                return Response(
                    {"detail": "table_number is required for dine-in"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if order_type == Order.OrderType.DELIVERY:
            if not delivery_address or not str(delivery_address).strip():
                return Response(
                    {"detail": "delivery_address is required for delivery"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            subtotal = Decimal("0.00")
            item_map = {}
            for line in lines:
                item_id = line["item_id"]
                qty = line["quantity"]
                item_map.setdefault(item_id, 0)
                item_map[item_id] += qty

            items = Item.objects.select_for_update().filter(id__in=item_map.keys())
            items_by_id = {i.id: i for i in items}

            missing = [
                str(iid)
                for iid in item_map.keys()
                if str(iid) not in [str(k) for k in items_by_id.keys()]
            ]
            if missing:
                return Response(
                    {"detail": f"Items not found: {', '.join(missing)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            order = Order(
                tax_rate=tax_rate,
                order_type=order_type,
                table_number=(str(table_number).strip() if table_number else None),
                delivery_address=(str(delivery_address).strip() if delivery_address else None),
                status=Order.OrderStatus.PLACED,
                tracking_code=str(uuid.uuid4()).split("-")[0].upper(),
            )
            order.save()

            order_details = {"lines": []}

            for item_id, qty in item_map.items():
                item = items_by_id[item_id]
                unit_price = item.price
                line_total = unit_price * qty
                subtotal += line_total

                OrderLine.objects.create(
                    order=order,
                    item=item,
                    quantity=qty,
                    unit_price=unit_price,
                    line_total=line_total,
                )

                order_details["lines"].append(
                    {
                        "item_id": item_id,
                        "quantity": qty,
                        "unit_price": str(unit_price),
                        "line_total": str(line_total),
                    }
                )

            tax_amount = (subtotal * tax_rate) / Decimal("100.00")
            total = subtotal + tax_amount

            order.subtotal = subtotal
            order.tax_amount = tax_amount
            order.total = total
            order.details_json = order_details
            order.save()

        # Refresh status once so frontend immediately sees correct step.
        order.status = self._simulate_status(order)
        order.save(update_fields=["status", "status_updated_at"])

        out = OrderSerializer(order, context={"request": request}).data
        return Response(out, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        new_status = self._simulate_status(instance)
        if new_status != instance.status:
            instance.status = new_status
            instance.save(update_fields=["status", "status_updated_at"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


