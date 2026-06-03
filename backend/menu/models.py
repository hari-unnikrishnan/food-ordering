from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Item(models.Model):
    STATUS_CHOICES = (
        ("available", "Available"),
        ("unavailable", "Unavailable"),
        ("special", "Special"),
    )

    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    # 3-state availability (replaces boolean is_available)
    availability = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="available",
    )

    image = models.ImageField(upload_to="menu_items/", blank=True, null=True)



    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
        ]

    def __str__(self) -> str:
        return self.name


class Order(models.Model):
    class OrderType(models.TextChoices):
        DINE_IN = "DINE_IN", "Dine In"
        DELIVERY = "DELIVERY", "Delivery"

    class OrderStatus(models.TextChoices):
        PLACED = "PLACED", "Placed"
        CONFIRMED = "CONFIRMED", "Confirmed"
        PREPARING = "PREPARING", "Preparing"
        READY = "READY", "Ready"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out for delivery"
        DELIVERED = "DELIVERED", "Delivered"

    created_at = models.DateTimeField(auto_now_add=True)

    # Stored for convenience at placement time
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=6, decimal_places=2, default=10)  # percent
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    order_type = models.CharField(
        max_length=20,
        choices=OrderType.choices,
        default=OrderType.DINE_IN,
    )

    table_number = models.CharField(max_length=20, blank=True, null=True)
    delivery_address = models.CharField(max_length=250, blank=True, null=True)

    status = models.CharField(max_length=30, choices=OrderStatus.choices, default=OrderStatus.PLACED)
    # Must be unique per order; value is generated at order creation.
    tracking_code = models.CharField(max_length=40, unique=True, db_index=True)

    # For simulated progression

    status_updated_at = models.DateTimeField(auto_now=True)

    # Optional: persist cart lines for audit
    details_json = models.JSONField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]



class OrderLine(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT)

    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    def save(self, *args, **kwargs):
        self.line_total = self.unit_price * self.quantity
        super().save(*args, **kwargs)

