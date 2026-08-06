# Architecture

## Runtime Split

- `frontend/`: installed PWA, Supabase Auth session, UI, camera/photo capture.
- `backend/`: FastAPI API, workspace authorization, care logic, weather, push.
- `supabase/`: Postgres/Auth/Storage; SQL migrations are tracked in repo.

## Data Access

The frontend can use Supabase for auth/session handling. Business data should go
through FastAPI so recommendation logic and workspace checks stay in one place.

Photo upload may start with the validated Supabase Storage browser flow, then
tighten through backend-issued paths or signed URLs when the real policies are
written.

## First Real Slice

```text
login
  -> backend auth check
  -> active workspace
  -> location
  -> zone
  -> container
  -> care profile
  -> Kytka detail
```

