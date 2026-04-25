"""
Import Celery app so Django loads it on startup.
"""

try:
    from .celery import app as celery_app
    __all__ = ('celery_app',)
except Exception as e:
    import logging
    logging.warning(f"Celery initialization failed: {e}. Running without Celery.")
    celery_app = None
    __all__ = ()