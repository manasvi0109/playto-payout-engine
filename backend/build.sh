#!/usr/bin/env bash
set -o errexit

echo "=== Current directory: $(pwd) ==="
echo "=== Directory listing ==="
ls -la

echo "=== Installing dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Collecting static files ==="
python manage.py collectstatic --no-input || echo "Collectstatic failed — continuing"

echo "=== Running migrations ==="
python manage.py migrate --no-input

echo "=== Seeding data ==="
python manage.py seed_data || echo "Seed data skipped — may already exist"

echo "=== Build complete! ==="