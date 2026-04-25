"""
This file makes config/ a Python package.
We also import the Celery app here so Django loads it on startup.
"""

# This ensures Celery is loaded when Django starts
from .celery import app as celery_app

__all__ = ('celery_app',)