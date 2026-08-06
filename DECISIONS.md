# Decisions Log

Running log of what was built, what was found, and what was explicitly cut, one entry
per phase of [KICKOFF_PROMPT.md](KICKOFF_PROMPT.md).

## Phase 0 — Security lockdown

**Built:**
- Deleted the dynamic tool-registration feature entirely: `backend/app/api/v1/endpoints/tools.py`,
  `backend/app/core/registry.py`, `backend/app/schemas/tool.py`, and its mount in
  `backend/app/api/v1/api.py`. `POST /tools/register` accepted a `code: str` field that was
  `compile()`d and `exec()`d server-side with no auth — unauthenticated RCE. Confirmed with
  a grep sweep that nothing in the backend agents or the frontend called
  `/tools/register`/`/tools/execute` (or any `/tools` route) — it was dead weight exposing a
  P0 vuln, not a used feature. Confirmed by the user before deleting.
- Added `Depends(get_current_user)` + ownership checks (`trip.user_id == current_user.id`,
  404 on mismatch — not 403, to avoid confirming a trip ID exists for another user) to every
  route that touches a `trip_id` or `user_id` resource:
  - `trips.py`: save/list/get/update/delete/replan
  - `replanner.py`: replan-selective
  - `memory.py`: add/search — now derives `user_id` from the token, no longer accepts it as a
    client-supplied query param
  - `email.py`: send — ownership-checked before scheduling the background email task
  - `orchestrator.py` `/plan`: now requires auth and derives `user_id` from the token instead
    of trusting `OrchestratorRequest.user_id` from the request body (removed that field from
    the schema). This mattered because `plan_trip_workflow` reads/uses saved user memories for
    personalization — an unauthenticated caller could previously pass any `user_id` and have
    another user's travel preferences folded into their generated plan.
- Frontend already sent `Authorization: Bearer <token>` on every one of these calls (it was
  just being ignored server-side) — no frontend changes were needed for `trips`, `replanner`,
  `memory`, `email`, or `orchestrator/plan`.

**Explicitly NOT changed (scope decision):**
- `POST /api/v1/ai/ai-chat` was left open, unauthenticated. It doesn't read or write any
  `trip_id`/`user_id`-keyed resource (the client sends `plan_context` directly in the body),
  so there's no IDOR there. `/plan` (`frontend/src/app/plan/page.tsx`) explicitly supports a
  guest flow — unauthenticated visitors still see generated results and a working chat
  assistant, with a banner inviting them to sign in to save the trip. Gating `ai-chat` behind
  login would have silently broken that guest experience without fixing any access-control
  bug. Flagging as a **P1 cost/abuse consideration** (it's an unauthenticated proxy to a paid
  LLM API) rather than folding it into P0 — worth a rate limit, not an auth wall, if it's
  addressed later.
- `understanding.py`, `recommendation.py`, `weather.py`, `transport.py`, `accommodation.py`,
  `itinerary.py`, and `travel_intelligence.py`'s `/travel-intelligence` route were left
  unauthenticated. None of them look up a `trip_id`/`user_id`-owned DB row — they're stateless
  compute endpoints. `travel_intelligence.py` accepts a `user_id` field but never uses it
  (confirmed by reading `generate_travel_intelligence`'s call site — the field isn't passed
  through), so it's inert, not a vulnerability.

**Found, not fixed (out of scope for Phase 0, noted for later):**
- `docker-compose.yml`'s `backend` service sets `POSTGRES_PORT=5433`, but that's the
  **host-side** published port for `db` (`"5433:5432"`); Postgres inside the `db` container
  still listens on `5432`. Container-to-container traffic on the compose network should use
  `5432`, not the host-mapped port. This looks like a pre-existing bug — with the compose
  file as committed, `backend` would fail to connect to `db` at all. Discovered while trying
  to live-verify this phase; worked around it with a local, uncommitted compose override for
  testing only (not part of the repo). Worth a one-line fix (`POSTGRES_PORT=5432`) whenever
  someone next touches `docker-compose.yml`, but it's unrelated to security lockdown so I left
  it alone here.
- Same root cause blocked `BACKEND_CORS_ORIGINS` from parsing: `pydantic-settings` tries to
  JSON-decode env vars for `List[str]` fields before the custom
  `assemble_cors_origins` validator (which handles a plain comma-separated string) ever runs,
  so the compose file's `BACKEND_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`
  crashes app startup with `SettingsError` / `JSONDecodeError`. Also pre-existing, also
  unrelated to this phase, also worked around locally for verification only.

**Verified live** (via Docker Compose, `db` + `backend`, using a local uncommitted port
override to avoid colliding with another project's Postgres container already bound to
5433 on this machine — `docker-compose.yml` itself was never left changed):
- `POST /api/v1/tools` and `GET /api/v1/tools` → `404` (route no longer exists).
- Unauthenticated `GET /trips`, `POST /trips`, `GET /trips/{id}`, `POST /memory/add`,
  `POST /orchestrator/plan`, `POST /trips/{id}/email`, `POST /trips/{id}/replan-selective` →
  all `401`.
- Registered two real users (Alice, Bob) via `/auth/register` + `/auth/login`. Alice saved a
  trip; Bob's token got `404` reading/deleting Alice's trip by ID, and Bob's `GET /trips` list
  came back empty (didn't leak Alice's trip). Alice could still read/delete her own trip.
- Bob's `/memory/search` returned `[]` for Alice's saved memory even when the request still
  included the old `?user_id=1` query param — confirms the endpoint ignores client-supplied
  identity and scopes strictly to the bearer token now.
