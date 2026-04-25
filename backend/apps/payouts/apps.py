from django.apps import AppConfig


class PayoutsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.payouts'  # Changed from 'payouts' to 'apps.payouts'
    verbose_name = 'Payouts'