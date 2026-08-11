# Nenech mě chcípnout!

Private plant-care PWA for Jakub and his girlfriend.

The app helps track real household plants, care history, weather context, photos,
and daily care tasks so the plants do not rely on heroic memory.

## Project Shape

```text
frontend/              React + Vite PWA
backend/               FastAPI business API
supabase/migrations/   SQL migrations, source of truth for schema
docs/                  operational project docs
```

## Local Development

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend with Docker:

```bash
cp backend/.env.example backend/.env
docker compose up backend
```

Backend without Docker:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Copy `.env.example` values into local env files before connecting to Supabase.

## Architecture Direction

- Supabase Auth stores users and sessions.
- FastAPI owns business data access and care logic.
- Supabase Storage stores plant photos.
- SQL migrations in `supabase/migrations/` are the database source of truth.
- Netlify hosts the PWA when deployed.
- Railway hosts the backend when deployed.

