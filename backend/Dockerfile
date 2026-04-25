# =====================================================
# Dockerfile for Django backend
# 
# Multi-stage build:
# 1. Install Python dependencies
# 2. Copy app code
# 3. Collect static files
# =====================================================

FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr
# (so we see logs in real-time in Docker)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Set working directory
WORKDIR /app

# Install system dependencies
# libpq-dev is needed for psycopg2
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Collect static files (for Django admin)
RUN DJANGO_SETTINGS_MODULE=config.settings.production \
    SECRET_KEY=dummy-key-for-collectstatic \
    python manage.py collectstatic --noinput 2>/dev/null || true

# Expose port
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]