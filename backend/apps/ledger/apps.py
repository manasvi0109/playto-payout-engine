from django.apps import AppConfig


class LedgerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.ledger'  # Changed from 'ledger' to 'apps.ledger'
    verbose_name = 'Ledger'