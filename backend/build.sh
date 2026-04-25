#!/usr/bin/env bash
set -o errexit

echo "=== Python version ==="
python --version

echo "=== Current directory ==="
pwd
ls -la

echo "=== Installing dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Running migrations ==="
python manage.py migrate --no-input
echo "Migration complete!"

echo "=== Checking database tables ==="
python manage.py showmigrations --list | head -30

echo "=== Seeding data ==="
python manage.py seed_data 2>&1 || echo "Seed data may already exist"

echo "=== Verifying data ==="
python -c "
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
django.setup()
from apps.merchants.models import Merchant
count = Merchant.objects.count()
print(f'Merchants in database: {count}')
if count == 0:
    print('WARNING: No merchants found!')
else:
    for m in Merchant.objects.all():
        print(f'  - {m.name} (ID: {m.id})')
"

echo "=== Collecting static files ==="
python manage.py collectstatic --no-input 2>/dev/null || echo "Collectstatic skipped"

echo "=== Build complete! ==="