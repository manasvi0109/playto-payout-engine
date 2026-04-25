"""
Celery configuration for the Playto Payout Engine.

Celery is a background task queue. Think of it like this:
- Django handles HTTP requests (synchronous, fast)
- Celery handles background jobs (asynchronous, can be slow)

For our payout engine:
- Django API receives payout request → creates it in DB
- Celery worker picks it up → talks to bank (simulated) → updates status

Why not just do it in the Django view?
- Bank API calls are slow (2-30 seconds)
- You can't make a user wait that long
- If the server crashes mid-request, the payout state is unknown
- Background workers can retry failed jobs automatically
"""

import os
from celery import Celery

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')

# Create the Celery application
# 'config' is just a name — it appears in logs
app = Celery('config')

# Load Celery config from Django settings
# namespace='CELERY' means all Celery settings in settings.py start with CELERY_
# e.g., CELERY_BROKER_URL, CELERY_RESULT_BACKEND
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed apps
# This looks for a `tasks.py` file in each app directory
# So apps/payouts/tasks.py will be found automatically
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """A test task to verify Celery is working."""
    print(f'Request: {self.request!r}')