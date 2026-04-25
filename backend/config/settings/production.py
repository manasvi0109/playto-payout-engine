"""
Production settings for Render deployment.
"""

import os
from .base import *  # noqa: F401,F403
import dj_database_url

DEBUG = False

# ──────────────────────────────────────────────
# THIS WAS THE BUG: using env() instead of os.getenv()
# env() is from django-environ package which we never installed
# os.getenv() is built into Python — no extra package needed
# ──────────────────────────────────────────────

# Render provides RENDER_EXTERNAL_HOSTNAME automatically
RENDER_EXTERNAL_HOSTNAME = os.getenv('RENDER_EXTERNAL_HOSTNAME')

# Parse ALLOWED_HOSTS from environment variable
allowed_hosts_str = os.getenv('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [h.strip() for h in allowed_hosts_str.split(',') if h.strip()]

# Add Render's hostname automatically
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# Always allow these
ALLOWED_HOSTS.extend(['localhost', '127.0.0.1'])

# CORS for production
cors_origins_str = os.getenv('CORS_ALLOWED_ORIGINS', '')
CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_origins_str.split(',') if o.strip()]
CORS_ALLOW_CREDENTIALS = True

# If no specific origins set, allow all (for initial testing — tighten later)
if not CORS_ALLOWED_ORIGINS:
    CORS_ALLOW_ALL_ORIGINS = True

# Database: Render provides DATABASE_URL
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
        )
    }
else:
    raise Exception("DATABASE_URL environment variable is required in production!")

# Security
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'

# Redis for Celery — make it optional so backend works without Celery
REDIS_URL = os.getenv('REDIS_URL')
if REDIS_URL:
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
else:
    # If no Redis, disable Celery beat schedule to prevent errors
    CELERY_BEAT_SCHEDULE = {}