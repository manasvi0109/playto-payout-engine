"""
Base settings shared between all environments.
This file contains everything that doesn't change between dev and production.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Build paths: BASE_DIR points to the 'backend/' directory
# Path(__file__) = this file (base.py)
# .resolve() = absolute path
# .parent = config/settings/ → .parent = config/ → .parent = backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load .env file from backend/ directory
load_dotenv(BASE_DIR / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
# os.getenv reads from environment variables (which .env populates)
SECRET_KEY = os.getenv('SECRET_KEY', 'fallback-insecure-key-for-dev-only')

# Application definition
# These are Django's built-in apps + third-party + our custom apps
INSTALLED_APPS = [
    # Django built-in apps
    'django.contrib.admin',       # Admin panel at /admin/
    'django.contrib.auth',        # User authentication system
    'django.contrib.contenttypes',# Content type framework
    'django.contrib.sessions',    # Session framework
    'django.contrib.messages',    # Messaging framework
    'django.contrib.staticfiles', # Serves static files (CSS, JS)
    
    # Third-party apps
    'rest_framework',             # Django REST Framework for API
    'corsheaders',                # Handle CORS (Cross-Origin Resource Sharing)
    'django_celery_beat',         # Periodic task scheduler
    
    # Our apps (the ones we created)
    'apps.merchants',
    'apps.ledger',
    'apps.payouts',
]

# Middleware = code that runs on EVERY request/response
# Think of it as a pipeline: Request → Middleware1 → Middleware2 → View → Response
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',       # MUST be before CommonMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# URL configuration - points to our root urls.py
ROOT_URLCONF = 'config.urls'

# Template settings (for admin panel mostly)
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# WSGI application path (for production server)
WSGI_APPLICATION = 'config.wsgi.application'

# Password validation (Django default, not important for our API)
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'  # Always use UTC for fintech!
USE_I18N = True
USE_TZ = True  # Store aware datetimes

# Static files (CSS, JavaScript, Images for admin)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ============================================================
# Django REST Framework Configuration
# ============================================================
REST_FRAMEWORK = {
    # Default pagination: return 20 items per page
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    
    # Default renderer: JSON (no browsable API in production)
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    
    # Default permission: allow any (we'll handle auth per-view if needed)
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    
    # Exception handling
    'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
}

# ============================================================
# Celery Configuration (Background Job Processing)
# ============================================================
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']           # Only accept JSON serialized tasks
CELERY_TASK_SERIALIZER = 'json'            # Serialize task data as JSON
CELERY_RESULT_SERIALIZER = 'json'          # Serialize results as JSON
CELERY_TIMEZONE = 'UTC'                    # Use UTC for task scheduling
CELERY_TASK_TRACK_STARTED = True           # Track when tasks start
CELERY_TASK_TIME_LIMIT = 120               # Kill task after 2 minutes

# Celery Beat Schedule (periodic tasks)
CELERY_BEAT_SCHEDULE = {
    'retry-stuck-payouts': {
        'task': 'apps.payouts.tasks.retry_stuck_payouts',
        'schedule': 30.0,  # Run every 30 seconds
    },
}