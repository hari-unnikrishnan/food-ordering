from decimal import Decimal

from rest_framework import serializers

from .models import Category, Item, Order, OrderLine


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


class ItemSerializer(serializers.ModelSerializer):
    # Accept category by name for POST/PUT.
    # For reads we also return the category name.
    category = serializers.SlugRelatedField(
        slug_field="name",
        queryset=Category.objects.all(),
    )

    # Frontend can use this directly to show the correct image.
    # Supports uploaded images; falls back to deterministic mapping from item name.
    image = serializers.ImageField(required=False, allow_null=True)
    image_url = serializers.SerializerMethodField()

    def get_image_url(self, obj: Item) -> str:
        request = self.context.get("request")

        if getattr(obj, "image", None):
            try:
                if obj.image.url:
                    # If we have request context, return an absolute URL so the React app can load it.
                    if request is not None:
                        return request.build_absolute_uri(obj.image.url)
                    return obj.image.url
            except Exception:
                pass

        name = (obj.name or "").strip().lower()

        placeholder_url = (
            "https://images.unsplash.com/photo-1525351484163-7529414344d8"
            "?q=80&w=1200&auto=format&fit=crop"
        )

        w = "?q=80&w=1200&auto=format&fit=crop"
        mapping = [
            (
                "egg",
                "https://images.unsplash.com/photo-1547592166-23ac45744acd" + w,
            ),
            (
                "salmon",
                "https://images.unsplash.com/photo-1553621042-f6e147245754" + w,
            ),
            (
                "bagel",
                "https://images.unsplash.com/photo-1528735602780-2552fd46c7af"
                "?auto=format&fit=crop&w=800&q=80" + w,
            ),
            (
                "pizza",
                "https://images.unsplash.com/photo-1513104890138-7c749659a591"
                "?auto=format&fit=crop&w=800&q=80" + w,
            ),
            (
                "burger",
                "https://images.unsplash.com/photo-1568901346375-23c9450c58cd"
                "?auto=format&fit=crop&w=800&q=80" + w,
            ),
            (
                "malabar",
                "https://images.unsplash.com/photo-1631452180519-c014fe946bc7"
                "?auto=format&fit=crop&w=800&q=80" + w,
            ),
            (
                "kitchen",
                "https://images.unsplash.com/photo-1604908176997-"
                "125f25cc500f" + w,
            ),
            (
                "kerala spice house",
                "https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg",
            ),
            (
                "coconut leaf",
                "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
            ),
            (
                "toddy flavors",
                "https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg",
            ),
            (
                "naadan taste",
                "https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg",
            ),
        ]


        for key, url in mapping:
            if key in name:
                return url

        return placeholder_url

    class Meta:
        model = Item
        fields = [
            "id",
            "name",
            "category",
            "description",
            "price",
            "availability",
            "image",
            "image_url",
        ]




class CartLineSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class PlaceOrderSerializer(serializers.Serializer):
    tax_rate = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        required=False,
        default=Decimal("10.00"),
    )
    lines = CartLineSerializer(many=True)

    order_type = serializers.ChoiceField(
        choices=Order.OrderType.choices,
        default=Order.OrderType.DINE_IN,
    )
    table_number = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=20,
    )
    delivery_address = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=250,
    )


class OrderLineSerializer(serializers.ModelSerializer):
    item = serializers.SlugRelatedField(slug_field="name", read_only=True)
    item_description = serializers.CharField(source="item.description", read_only=True)
    category_name = serializers.SlugRelatedField(
        source="item.category",
        slug_field="name",
        read_only=True,
    )

    class Meta:
        model = OrderLine
        fields = [
            "id",
            "item",
            "category_name",
            "item_description",
            "quantity",
            "unit_price",
            "line_total",
        ]


class OrderSerializer(serializers.ModelSerializer):
    lines = OrderLineSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "created_at",
            "subtotal",
            "tax_rate",
            "tax_amount",
            "total",
            "details_json",
            "lines",
            "order_type",
            "table_number",
            "delivery_address",
            "status",
            "tracking_code",
            "status_updated_at",
        ]

