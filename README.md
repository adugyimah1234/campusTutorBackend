# Backend (Node.js + Express + MySQL)

## Quick Start (Dev)

1. Create the database schema:

```
mysql -u root -p < ../database/schema.sql
```

1. Copy env:

```
cp .env.example .env
```

1. Install dependencies:

```
npm install
```

1. Run API:

```
npm run dev
```

## Migrations

Run the schema migration script (uses `database/migrations` if present, otherwise `database/schema.sql`):

```
npm run migrate
```

## Seed Data

Create demo users for development:

```
npm run seed
```

Demo users:

- `admin@campus.edu` / `Password123!`
- `tutor@campus.edu` / `Password123!`
- `tutee@campus.edu` / `Password123!`

## Health Check

- `GET /health`

## Dashboard Endpoints

- `GET /dashboard/tutee`
- `GET /dashboard/tutor`
- `GET /dashboard/admin`

All dashboard endpoints require `Authorization: Bearer <accessToken>`.
