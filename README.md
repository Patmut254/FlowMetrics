# FlowMetrics

**FlowMetrics** is a business intelligence dashboard for SaaS companies. It tracks revenue, customers, subscriptions and overall business performance. Every metric is calculated live from relational billing data; nothing is hard-coded.

![Stack](https://img.shields.io/badge/React-19-149eca) ![Stack](https://img.shields.io/badge/TypeScript-strict-3178c6) ![Stack](https://img.shields.io/badge/Django-5.2-0c4b33) ![Stack](https://img.shields.io/badge/PostgreSQL-18-336791)

## Highlights

- **Dashboard**: total revenue, MRR, ARR, active and new customers, churn, trial conversion, ARPU, and revenue and customer growth against the previous period. Also includes revenue and MRR trends, customer growth, revenue by plan, top plans, recent transactions and a customer activity feed, all filtered by date range.
- **Analytics**: MRR movements (new, expansion, churn and contraction), net revenue retention, SaaS quick ratio, LTV, acquisition by channel, a conversion funnel, retention cohorts and plan economics.
- **Customers**: searchable, filterable and sortable list, plus a detail page with revenue history, subscription timeline, transactions, and plan change and cancellation actions.
- **Subscriptions**: plan management (pricing, trials, features), lifecycle stats, monthly vs annual mix, and a filterable subscription list.
- **Transactions**: payment history with status summaries, filters, success rate and CSV export.
- **Reports**: generate executive, revenue, customer and subscription reports. They are stored as point-in-time snapshots and can be printed or exported to CSV.
- **Settings**: profile, workspace, notification preferences, appearance (light, dark or system, compact tables, default range) and account security.
- **Auth and multi-tenancy**: registration creates a workspace. Login, logout and protected routes are included, and every query is scoped to the user's organization.
- Accessible, responsive UI with loading, empty and error states, toasts, modals with focus trapping, and a chart palette validated for colour-blind readers in both themes.

## Project structure

```
FlowMetrics/
├── backend/            # Django + Django REST Framework API
│   ├── config/         # settings, urls, wsgi
│   └── apps/
│       ├── core/       # shared base model, permissions, pagination, date ranges, tests
│       ├── accounts/   # User, Organization, Membership, UserPreferences, auth endpoints
│       ├── billing/    # Plan, Customer, Subscription, Transaction (+ seed_demo command)
│       ├── analytics/  # metrics engine, MetricSnapshot, dashboard/analytics endpoints
│       └── reports/    # Report model, report generators, CSV export
└── frontend/           # React + TypeScript + Vite + Tailwind CSS + Recharts
    └── src/
        ├── components/ # ui kit, layout, charts, dashboard widgets, modals
        ├── context/    # auth, theme, toasts, shared date range
        ├── hooks/      # data fetching, URL-synced list filters, debounce
        ├── lib/        # API client, formatters, dates, CSV
        ├── pages/      # one file per route
        └── types/      # API types
```

## Data model

```
Organization ─┬─< Membership >── User ── UserPreferences
              ├─< Plan
              ├─< Customer ─┬─< Subscription (plan, previous → upgrade chain)
              │             └─< Transaction (subscription)
              ├─< MetricSnapshot   (derived month-end metrics)
              └─< Report           (generated report data)
```

Subscription lifecycle dates (`started_at`, `trial_ends_at`, `activated_at`, `cancelled_at`) drive every metric. The definitions are documented in [`backend/apps/analytics/services.py`](backend/apps/analytics/services.py).

## Getting started

### Prerequisites

Python 3.12+, Node 20+, PostgreSQL 14+.

### 1. Database

```bash
psql -U postgres -c "CREATE DATABASE flowmetrics;"
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then set DB_PASSWORD, DB_PORT, DJANGO_SECRET_KEY
python manage.py migrate
python manage.py seed_demo      # realistic demo workspace (~2 years of data)
python manage.py runserver
```

The API runs at `http://localhost:8000/api/`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env            # VITE_API_URL=http://localhost:8000/api
npm run dev
```

Open `http://localhost:5173` and click **Continue with the demo workspace**, or sign in with:

| Email                   | Password             |
| ----------------------- | -------------------- |
| `demo@flowmetrics.io` | `FlowMetrics2026!` |

## API overview

| Method           | Endpoint                                                                              | Purpose                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| POST             | `/api/auth/register/` · `/login/` · `/logout/`                                | Authentication (token)                                                                   |
| GET/PATCH/DELETE | `/api/auth/me/`                                                                     | Current user profile / delete account                                                    |
| POST             | `/api/auth/me/password/`                                                            | Change password (rotates token)                                                          |
| GET/PATCH        | `/api/auth/me/preferences/` · `/api/auth/organization/`                          | Preferences, workspace                                                                   |
| GET              | `/api/dashboard/?start=&end=`                                                       | All dashboard data for a range                                                           |
| GET              | `/api/analytics/?start=&end=`                                                       | Deep analytics for a range                                                               |
| CRUD             | `/api/plans/` · `/api/customers/`                                                | Plans, customers (`search`, `status`, `plan`, `channel`, `ordering`, `page`) |
| GET/POST         | `/api/subscriptions/` · `/{id}/cancel/` · `/{id}/change-plan/` · `/stats/` | Subscription lifecycle                                                                   |
| GET              | `/api/transactions/` · `/summary/` · `/export/`                               | Payments, summaries, CSV                                                                 |
| CRUD             | `/api/reports/` · `/{id}/export/`                                                | Generated reports                                                                        |

Errors always use the shape `{"detail": "...", "errors": {"field": ["..."]}}`.

## Tests and checks

```bash
cd backend && python manage.py test apps     # auth, tenant isolation, metric definitions, lifecycle
cd frontend && npm run build                 # strict TypeScript + production build
```

## Configuration

All secrets and environment-specific values come from environment variables. See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example). `.env` files are git-ignored.
