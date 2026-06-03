from django.contrib import admin
from .models import Category, Item, Order, OrderLine


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "price", "availability")
    list_filter = ("category", "availability")
    search_fields = ("name", "description")



class OrderLineInline(admin.TabularInline):
    model = OrderLine
    readonly_fields = ("item", "quantity", "unit_price", "line_total")
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "subtotal", "tax_rate", "tax_amount", "total")
    readonly_fields = ("created_at", "subtotal", "tax_rate", "tax_amount", "total", "details_json")
    inlines = (OrderLineInline,)

