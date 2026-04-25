"""
Local development settings.
Usage: DJANGO_SETTINGS_MODULE=config.settings.local python manage.py runserver
"""

from .base import *  # noqa: F401,F403 — import everything from base
import dj_database_url

# SECURITY: Debug mode ON for development (shows detailed errors)
DEBUG = True

# Allow local connections
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

# CORS: Allow React dev server to call our API
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',    # Vite default port
    'http://127.0.0.1:5173',
    'http://localhost:3000',    # CRA default port (just in case)
]
CORS_ALLOW_CREDENTIALS = True

# Database: PostgreSQL for local development
# dj_database_url.config() reads DATABASE_URL env variable and converts it
# to Django's DATABASES format
DATABASES = {
    'default': dj_database_url.config(
        default='postgres://playto_user:playto_pass_123@localhost:5432/playto_payout',
        conn_max_age=600,  # Reuse DB connections for 10 minutes
    )
}

# In development, also show the browsable API (nice HTML interface)
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # Inherit base settings
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',  # HTML API browser
    ],
}

# Print emails to console instead of sending them
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Logging: show SQL queries in development (helps debug)
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django.db.backends': {
            'level': 'WARNING',  # Change to 'DEBUG' to see all SQL queries
            'handlers': ['console'],
        },
        'apps': {
            'level': 'DEBUG',
            'handlers': ['console'],
        },
    },
}