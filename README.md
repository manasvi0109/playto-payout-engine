# 💸 Playto Payout Engine

A production-grade payout engine for Playto Pay — enabling Indian freelancers and agencies to receive international payments via INR bank transfers.

## 🌐 Live Demo

- **Frontend:** https://playto-payout-engine-woad.vercel.app
- **Backend API:** https://playto-payout-engine-9smc.onrender.com/api/v1/
- **Admin Panel:** https://playto-payout-engine-9smc.onrender.com/admin/

> **Note:** Backend runs on Render free tier. First request after 15 minutes of inactivity takes ~30-60 seconds (cold start). Subsequent requests are fast.

## 🏗 Architecture

```
┌────────────┐     ┌──────────────┐     ┌───────────┐
│   React    │────▶│  Django DRF  │────▶│ PostgreSQL│
│  (Vercel)  │◀────│  (Render)    │◀────│ (Render)  │
└────────────┘     └──────┬───────┘     └───────────┘
                          │
                          ▼
                    ┌───────────┐
                    │  Celery   │ (eager mode on free tier,
                    │  Worker   │  real workers locally)
                    └───────────┘
```

## 🚀 Local Development Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Redis 7+ (for Celery worker mode)
- Node.js 18+

### Database Setup

```sql
-- Connect to PostgreSQL
sudo -u postgres psql

-- Create database and user
CREATE DATABASE playto_payout;
CREATE USER playto_user WITH PASSWORD 'playto_pass_123';
ALTER ROLE playto_user SET client_encoding TO 'utf8';
ALTER ROLE playto_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE playto_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE playto_payout TO playto_user;
\c playto_payout
GRANT ALL ON SCHEMA public TO playto_user;
\q
```

### Backend Setup

```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
SECRET_KEY=django-insecure-dev-key-change-in-production
DEBUG=True
DATABASE_URL=postgres://playto_user:playto_pass_123@localhost:5432/playto_payout
REDIS_URL=redis://localhost:6379/0
EOF

# Run migrations
python manage.py migrate

# Seed test data (3 merchants with credit history)
python manage.py seed_data

# Create admin superuser
python manage.py createsuperuser

# Start Django server
python manage.py runserver
```

### Celery Worker (separate terminal)

```bash
cd backend
source ../venv/bin/activate
celery -A config worker --loglevel=info
```

### Celery Beat — Periodic Tasks (separate terminal)

```bash
cd backend
source ../venv/bin/activate
celery -A config beat --loglevel=info
```

### Frontend Setup (separate terminal)

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

## 🐳 Docker Setup

```bash
docker-compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:8000/api/v1/
# Admin:    http://localhost:8000/admin/
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/` | API root with all endpoints |
| GET | `/api/v1/merchants/` | List all merchants |
| GET | `/api/v1/merchants/{id}/` | Merchant details with balance |
| GET | `/api/v1/merchants/{id}/balance/` | Detailed balance breakdown |
| GET | `/api/v1/merchants/{id}/bank-accounts/` | Merchant's bank accounts |
| GET | `/api/v1/merchants/{id}/ledger/` | Paginated transaction ledger |
| POST | `/api/v1/payouts/` | Create payout (requires `Idempotency-Key` header) |
| GET | `/api/v1/payouts/list/?merchant_id=X` | List payouts for merchant |
| GET | `/api/v1/payouts/{id}/` | Single payout details |

### Create Payout Example

```bash
curl -X POST https://playto-payout-engine-9smc.onrender.com/api/v1/payouts/ \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(python3 -c 'import uuid; print(uuid.uuid4())')" \
  -d '{
    "merchant_id": 1,
    "amount_paise": 50000,
    "bank_account_id": 1
  }'
```

## 🧪 Running Tests

```bash
cd backend
python manage.py test apps.payouts.tests --verbosity=2
```

Tests include:
- **Concurrency test:** Two simultaneous ₹600 payouts on ₹1000 balance → exactly one succeeds
- **Idempotency test:** Same key twice → same response, one payout in DB
- **State machine tests:** All valid transitions allowed, all invalid transitions blocked

## 🔑 Key Technical Decisions

| Decision | Reasoning |
|----------|-----------|
| **Paise as BigIntegerField** | No floating-point errors. ₹500.00 = 50000 paise |
| **Balance from ledger SUM** | No stored balance column — eliminates race conditions, provides audit trail |
| **SELECT FOR UPDATE NOWAIT** | DB-level locking for concurrent payout prevention. Fails fast instead of queuing |
| **Idempotency keys per merchant** | UUID scoped to merchant, 24-hour expiry, handles in-flight duplicates |
| **Optimistic locking for state machine** | `UPDATE WHERE status = expected` prevents concurrent state transitions |
| **Celery eager mode on Render** | Free tier has no background workers. Tasks run synchronously during API call |

## 📁 Project Structure

```
playto-payout-engine/
├── backend/
│   ├── config/           # Django settings, Celery config, URLs
│   ├── apps/
│   │   ├── merchants/    # Merchant & BankAccount models, APIs
│   │   ├── ledger/       # LedgerEntry model, balance calculation
│   │   └── payouts/      # Payout, IdempotencyKey, state machine, Celery tasks
│   ├── build.sh          # Render build script
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios client
│   │   ├── components/   # React components
│   │   └── utils/        # Formatting utilities
│   └── package.json
├── docker-compose.yml
├── README.md
└── EXPLAINER.md
```
