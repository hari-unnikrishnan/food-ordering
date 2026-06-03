from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("menu", "0002_order_delivery_address_order_order_type_order_status_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="menu_items/",
            ),
        ),

    ]

