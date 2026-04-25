#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "=== Installing dependencies ==="
pip install -r requirements.txt

echo "=== Collecting static files ==="
python manage.py collectstatic --no-input

echo "=== Running migrations ==="
python manage.py migrate --no-input

echo "=== Seeding data (if empty) ==="
python manage.py seed_data || echo "Seed data already exists or failed — continuing"

echo "=== Build complete ==="