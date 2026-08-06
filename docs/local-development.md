# Local Development

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Default local URL: `http://localhost:5173`.

## Backend With Docker

From the repo root:

```bash
cp backend/.env.example backend/.env
docker compose up backend
```

Default local URL: `http://localhost:8000`.

The Docker backend still connects to Supabase/Postgres through `backend/.env`.
There is intentionally no local database container in the default compose file.

## Backend Without Docker

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

## Supabase

Keep schema changes in `supabase/migrations/` and apply them manually to the
Supabase project when ready.

