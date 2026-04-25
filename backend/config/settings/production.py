"""
Production settings for Railway deployment.
"""

from .base import *  # noqa: F401,F403
import dj_database_url

DEBUG = False

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

# CORS for production
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')

# Database: Railway provides DATABASE_URL automatically
DATABASES = {
    'default': dj_database_url.config(
        conn_max_age=600,
        ssl_require=True,  # Railway requires SSL
    )
}

# Security settings for production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'

# Static files
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'