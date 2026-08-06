# Backend

FastAPI backend for business data, recommendations, weather, and push.

## Run Locally With Docker

From the repo root:

```bash
cp backend/.env.example backend/.env
docker compose up backend
```

Health:

```bash
curl http://localhost:8000/health
```

## Run Locally Without Docker

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

