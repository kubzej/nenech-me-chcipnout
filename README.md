# Nenech mě chcípnout!

A plant-care PWA for people who cannot be trusted to keep a plant alive on
their own. Tracks plants, care history, weather, and photos, and tells you
each day what actually needs doing — instead of relying on memory.

## Quick start

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend (Docker):

```bash
cp backend/.env.example backend/.env
docker compose up backend
```

Full setup and environment variables: [docs/local-development.md](docs/local-development.md).

## Docs

- [docs/features.md](docs/features.md) — what the app does, by feature.
- [docs/architecture.md](docs/architecture.md) — how it's put together.
- [docs/local-development.md](docs/local-development.md) — local dev setup.
