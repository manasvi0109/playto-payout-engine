"""
WSGI config for production deployment.
"""
import os
from django.core.wsgi import get_wsgi_application

# Default to production on Render (gets overridden locally by manage.py)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')

application = get_wsgi_application()