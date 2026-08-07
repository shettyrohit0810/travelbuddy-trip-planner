# Kickoff Prompt — Rebuilding TravelBuddy into a Real Agentic Trip Planner

**Read this whole document before writing any code.** It replaces the project's own docs
(`docs/PRD/`, `docs/Architecture/`) as the source of truth for what actually exists —
those docs describe an aspirational system that was never fully built. Sections 2-3 below
are a verified, file-and-line audit of the real codebase, not a summary of the README.

---

## 0. Role

You are the engineer taking ownership of this codebase end to end. Not a contractor
bolting on one feature — you're expected to understand every module well enough to
explain why it exists, decide what's worth keeping vs. rewriting, and be honest in
writing about the gap between what the docs claim and what the code does. Where the
existing code is already good (see §2), reuse and extend it. Where it's decorative,
say so and replace it — don't build new features on top of a fake foundation.

---

## 1. Technology Stack (as currently declared in the repo)

**Frontend** (`frontend/`)
- Next.js 16.2.9 (App Router), React 19.2.4, TypeScript 5
- Tailwind CSS 4, shadcn/ui + Radix UI, `lucide-react` icons
- `leaflet` (maps), `jspdf` + `html2canvas` (client-side PDF export)
- No test runner configured (no Jest/Vitest/Playwright present)

**Backend** (`backend/`)
- FastAPI 0.110+, Python 3.10+, Pydantic v2 (`pydantic-settings`)
- SQLAlchemy 2.x + `psycopg2-binary`, Alembic (installed but unused — see §2.5)
- `pyjwt` + `bcrypt` for auth
- LLM SDKs: `google-generativeai` (Gemini), `openai` (also used against Groq's
  OpenAI-compatible endpoint — see `Settings.IS_GROQ`)
- `langgraph>=0.2.0`

**MCP server** (`mcp_server/`) — a **separate, disconnected** Python package (`mcp`,
`pydantic`) that is never imported by the backend. Currently dead code (§2.3).

**Data**
- PostgreSQL 16 (via Docker Compose, host port 5433→container 5432)
- **No Redis** — despite the PRD's entire "Caching Architecture" section, there is no
  Redis service in `docker-compose.yml`, no `redis` dependency in either
  `requirements.txt`, and zero references to it in code.

**Infra**
- Docker + Docker Compose (`db`, `backend`, `frontend` services only)
- **No CI** — no `.github/workflows/` directory exists at all.

---

## 2. What Actually Exists (verified by reading the code, not the docs)

### 2.1 The real part: `backend/app/agents/orchestrator.py`

This is the one genuinely solid piece of engineering in the repo, and the foundation
to build on:
- A real LangGraph `StateGraph` over `TripPlanningState`, wired via
  `workflow.set_conditional_entry_point(replan_entry_router, {...})` and
  `workflow.add_conditional_edges("node_budget", budget_router, {...})` —
  actual conditional routing, not just a linear chain.
- A real retry wrapper, `run_node_with_retry()`, retrying each node up to 3 times.
- 7 nodes wired end to end: understanding → destination/recommendation → weather →
  transport → accommodation → budget → itinerary → planner.

Its limitations, precisely:
- **No parallelism anywhere.** The PRD claims `asyncio.gather()` fan-out for
  Destination/Weather/Transport; the actual graph runs every node strictly sequentially
  via `add_edge`. There is no `async def` or `asyncio.gather` anywhere under
  `backend/app/agents/`.
- **No dedicated `ReplanningAgent` node.** "Replanning" is the same graph re-entering
  itself at a different conditional-entry point — there's no agent whose job is
  specifically to diff old-vs-new plan and explain changes.
- **The "agents" aren't agentic.** `weather.py`, `accommodation.py`, `budget.py`,
  `itinerary.py`, `recommendation.py`, `transport.py` are each: try Gemini structured
  output → try OpenAI/Groq structured output → fall back to hardcoded/rule-based logic.
  No tool-calling loop, no reasoning trace, no memory of intermediate steps.

### 2.2 The second graph is decorative: `backend/app/agents/travel_intelligence/`

A completely separate LangGraph (`TravelIntelligenceState`, unrelated to
`TripPlanningState`) for a YouTube-travel-vlog pipeline. `graph.py` is nothing but
`workflow.add_edge(a, b)` calls chained straight to `END` — no conditional edges, no
cycles, despite this being the flagship example the architecture docs point to for
"why LangGraph." Its `verification_node` doesn't verify anything: it reformats
extracted data with a hardcoded heuristic (`"High" if "6 AM" in detail else "Medium"`)
and always logs a fake `"confidence score: 95%"` regardless of input. This entire
subsystem needs to either become real or be removed — a fake verifier that always
reports success is worse than no verifier, because it actively misrepresents quality.

### 2.3 MCP server: dead code, and even if wired up, 100% hardcoded

No file under `backend/app/agents/` imports an MCP client — `mcp_server/` is never
called by the running application. Even taken on its own terms, it's not real:
- `destination_search.py` returns a fixed 4-item Kyoto attraction list regardless of
  the query.
- `hotel_search.py` returns a fixed 3-item Kyoto hotel list regardless of location.
- `weather_lookup.py` fabricates a forecast via `22 + (i % 3)` — no API call.
- `budget_estimator.py` does arithmetic on a hardcoded rate table — no live pricing.
- 6 of the PRD's 11 documented tools (`search_flights`, `generate_pdf`,
  `send_trip_email`, `get_user_memories`, `save_user_memory`, `get_local_transport`)
  **do not exist anywhere in the codebase.**
- No file in `mcp_server/` imports `requests`/`httpx`/`aiohttp` or references any
  external API key. Zero network I/O.

### 2.4 Auth: the mechanism is real, the enforcement is not

`backend/app/core/security.py` and `deps.py` are correctly implemented — real bcrypt
hashing, real JWT sign/verify with separate access/refresh secrets and expiry. But
`Depends(get_current_user)` is used on **exactly one route**: `GET /users/me`. Every
other endpoint — trip save/list/get/update/delete, `/replan`, `/replan-selective`,
memory read/write, email send, ai-chat, and the tool registry — takes `user_id`/
`trip_id` as unauthenticated input. This is a full authorization gap (IDOR on every
resource), not a partial one.

**Separately, and more urgently:** `POST /api/v1/tools/register` in
`backend/app/api/v1/endpoints/tools.py` accepts a `code: str` field that
`backend/app/core/registry.py` `compile()`s and `exec()`s server-side to build a
callable, later invoked via `POST /tools/execute` with arbitrary arguments — and this
route has no auth either. **This is unauthenticated remote code execution as an API
feature.** Treat this as a P0 security issue, not a backlog item — see §4.0.

### 2.5 Database: far smaller than the ERD, no migration history

Only 3 tables exist: `User`, `Trip`, `UserMemory`. There is no `hotels`,
`itineraries`, `agent_logs`, or `preferences` table — hotel/itinerary data lives as
opaque JSON inside `Trip.plan_data`. `backend/alembic/versions/` contains only
`.gitkeep` — Alembic is installed but has never generated a migration; schema
presumably comes from `Base.metadata.create_all()`.

### 2.6 Tests: zero

`backend/test_db.py` is a manual script with `print()` statements, not a test suite —
no assertions, not pytest-collectible. There is no other test file anywhere in the
repo, backend or frontend. Nothing here is regression-safe.

### 2.7 Frontend: real API wiring in some places, fabricated UI in others

- **Real:** `VoicePlanner.tsx` (genuine `SpeechRecognition`/`speechSynthesis` +
  authenticated fetch to `/orchestrator/plan`), `ReplanPanel.tsx` (real call to
  `/trips/{id}/replan-selective`).
- **Fake:** `BudgetSimulator.tsx` shows static hardcoded numbers (₹35,000 / ₹21,300 /
  "Over Budget by ₹450") regardless of any real trip data — not wired to props or
  state at all. `WeatherRadarMap.tsx` is decorative SVG with no weather data
  whatsoever. `TravelIntelligenceConsole.tsx` mixes real LLM-sourced fields with
  hardcoded canned text that doesn't change per video.

---

## 3. Net Assessment

This is not a fake project — the auth mechanism, the ORM layer, the LangGraph
conditional-routing graph in `orchestrator.py`, and some frontend components are
genuinely built. But the things that would make this a **serious agentic engineering
project** rather than an LLM-wrapper demo are the exact things that are currently
missing or faked: real external grounding (MCP layer is disconnected and hardcoded),
a real verify/replan loop (doesn't exist — replanning is one-shot graph re-entry), any
test coverage (zero), and access control (missing everywhere except one route). The
docs oversell a system that's maybe 35% of the way to what they describe.

---

## 4. Aim: What "Perfect" Means Here

Not "match the PRD's prose." The PRD itself describes a fairly shallow architecture
(single-LLM-call agents with try/except fallbacks, no real verifier). The actual bar,
per the earlier design discussion this project came out of:

- A **planner → specialist agents → verifier** loop, where the verifier checks the
  assembled plan against *hard, programmatically-enforced* constraints (budget cap,
  date range, opening hours) — not an LLM asked to "double check."
- A **deterministic scheduling core** for day-by-day sequencing (travel time, opening
  hours, budget) that the LLM's output must satisfy, not something the LLM freehands.
- **Every concrete fact grounded in a real tool call** — flight numbers, prices, hotel
  names, opening hours never come from unconstrained LLM generation. This means the
  MCP tools need real backing APIs (see §4.2), not hardcoded Kyoto data.
- A **bounded replan loop**: verifier finds a violation → replanner gets the specific
  failure reason → targeted fix or escalation to an explicit failure state, capped at
  N iterations. This is what makes "agentic" a true claim instead of a buzzword.
- **Access control on every resource**, and the RCE endpoint gone or locked down.

---

## 4.0 P0 — Before Anything Else

1. **Remove or fully sandbox `POST /tools/register` + `/tools/execute`.** If dynamic
   tool registration isn't a real product requirement, delete the `compile()`/`exec()`
   path entirely rather than trying to "secure" arbitrary code execution. Confirm with
   the user before deleting in case there's a reason it's there.
2. **Add `Depends(get_current_user)` + ownership checks to every route** that touches
   `trip_id`/`user_id` — trips, replanner, memory, email, ai-chat, orchestrator. A
   trip/memory read must verify `trip.user_id == current_user.id`, not just that a
   `user_id` was supplied.

Do not build new agent features on top of an app with an open RCE endpoint and no
access control — fix these first, verify with real requests (not just code review),
then proceed.

---

## 4.1 Phase Plan

Work phase-by-phase. **Stop at the end of each phase**, summarize what changed and
what you found, and wait for confirmation before starting the next one — same
discipline as prior projects on this machine. Keep a `DECISIONS.md` in the repo root
as the running log (one entry per phase: what was built, what was found, what was
explicitly cut and why).

- **Phase 0 — Security lockdown.** §4.0 items. Verify live: an unauthenticated
  request to a protected route now gets 401; the RCE endpoint is gone or provably
  sandboxed.
- **Phase 1 — Decide the MCP layer's fate.** Either (a) wire the backend agents to
  actually call `mcp_server/` over the MCP protocol as designed, or (b) delete
  `mcp_server/` and move tool logic directly into the backend — don't leave a second,
  disconnected implementation sitting in the repo. Pick real external APIs for at
  least weather (e.g. Open-Meteo, no key required) and one of hotels/flights
  (Amadeus has a usable free/dev tier); cache responses.
- **Phase 2 — Ground the tools in real data.** Replace the hardcoded Kyoto-only
  responses with real API calls per tool, each traceable: log which API call produced
  which fact in the final plan.
- **Phase 3 — Deterministic scheduling core.** Pull day-by-day sequencing out of the
  `itinerary`/`planner` LLM calls into a real scheduler function: input is the
  gathered facts (attractions + hours + travel times + budget), output is a
  day-by-day slot assignment the LLM narrates but does not invent. Unit-testable with
  fixed inputs and known-correct outputs.
- **Phase 4 — Real verifier + bounded replan loop.** Add an actual verification node
  to `orchestrator.py`'s graph that checks the assembled plan against hard
  constraints (budget total, date range, no double-booked time slots) and routes back
  to a replanner with the specific violation, capped at a small iteration count with
  an explicit failure state if unresolved. Delete or rebuild
  `travel_intelligence/nodes/verification.py` — a verifier that can't fail isn't one.
- **Phase 5 — Database + migrations.** Decide whether `hotels`/`itineraries` deserve
  real normalized tables (recommended, since the current JSON blob makes anything
  beyond "read the whole plan" hard) or if JSON-in-`Trip.plan_data` is an accepted
  tradeoff — either way, generate real Alembic migrations from this point forward
  instead of leaving `versions/` empty.
- **Phase 6 — Tests.** Real pytest coverage for the scheduler (Phase 3, pure logic,
  highest value), the verifier (Phase 4), and an integration test per critical
  endpoint with mocked LLM calls. Zero to meaningful coverage, not zero to 80% —
  pick real, defensible targets per module rather than a vanity percentage.
- **Phase 7 — Frontend truth.** Fix or remove `BudgetSimulator.tsx` and
  `WeatherRadarMap.tsx` — wire them to real trip data or delete the fake UI; a
  dashboard showing invented numbers is worse than an empty state.
- **Phase 8 — Eval harness.** A small benchmark set of trip requests (including
  deliberately infeasible ones) measuring constraint-satisfaction rate, replan
  iteration count, latency, and cost per trip. Report real numbers, including where
  something performs badly.

Reorder or split phases if you find something during the work that changes the
picture — flag it transparently rather than silently deviating.

## 4.2 Requirements & Constraints

- Ask before adding any dependency beyond what's already in `requirements.txt`/
  `package.json`, and before choosing a specific external API provider.
- No secrets committed, ever — `.env` stays gitignored, `secrets.example`-style
  placeholders only.
- One feature per commit.
- Every claim of "this works" must be backed by a real, live-executed check (a real
  HTTP request, a real test run) — not "the code looks right." If something can't be
  verified in this environment (e.g. a real microphone for voice input), say so
  explicitly rather than asserting it works.
- When docs (`docs/PRD/`, `docs/Architecture/`) and code disagree, code is the truth;
  update the docs to match reality as part of the relevant phase rather than leaving
  them describing a system that doesn't exist.
