# Decisions Log

Running log of what was built, what was found, and what was explicitly cut, one entry
per phase of [KICKOFF_PROMPT.md](KICKOFF_PROMPT.md).

## Part 1-3 — Real POI grounding, widened repair, and re-measurement

### Part 1 — POI grounding via OpenStreetMap Overpass (no API key)

Overpass was chosen over OpenTripMap/Geoapify because it needs **no account**, so a
fresh clone produces grounded itineraries out of the box. Obtaining an OpenTripMap key
would have required creating an account, which is the user's to do.

Four query iterations were needed, each failure found by running it, not by reading docs:
1. A single `out center N` cap truncated the union arbitrarily (Overpass emits nodes
   before ways), so **every Kyoto landmark lost to obscure municipal museums** —
   Kinkaku-ji, Fushimi Inari and Kiyomizu-dera are all ways.
2. `nwr` dragged relations into an already-expensive tag scan → server-side timeout.
3. An unfiltered `historic` sweep → server-side timeout. Overpass reports both as
   **HTTP 200 with a `remark` field**, not an error status, so "my query was too
   expensive" is indistinguishable from "this city has no attractions" unless you look.
4. A key-only `["tourism"]` filter matched `tourism=hotel`, putting **ANA Crowne Plaza
   and Mitsui Garden Hotel into a sightseeing list**.

Requiring a `wikidata` link fixed quality and cost simultaneously. Endpoints are tried
with a mirror plus a second round after backoff — the same query was observed returning
300 elements, a timeout remark, a 504, and 300 elements again with no change.

**Cost policy (explicitly decided, per the brief):** OSM's `fee` tag is *usually absent*,
so missing-cost is the common case, not an edge case. Absence maps to the category rate,
never to 0.0 — treating it as free is precisely the bug class the Hypothesis property
test already caught in the knapsack. Only explicit `fee=no` yields 0.0. The `charge` tag
is **ignored even when present**: its values carry mixed currencies ("500 JPY", "£3.50")
and converting them needs an FX source this project does not have; silently mixing
currencies into one budget total would be a correctness bug the verifier cannot catch.

### Part 2 — Widened repair levers

Repair now spends across `activities → food → lodging` in that order, each bounded by a
floor anchored to the original allocation. **Transport is deliberately not reducible:**
the transport agent picks a concrete mode at a concrete price, so writing that number
down would balance the budget by lying about it. A transport-dominated overrun is
partially absorbed and then honestly reported as unresolved.

Bug introduced and fixed during this work: floors computed as a fraction of the
*current* value let each pass shave another fraction, so a lever approached zero
without ever reaching a floor and `exhausted` never fired (Zeno-style non-termination,
bounded in practice only by the attempt cap). Floors are now anchored to a baseline
captured on the first repair pass, with a regression test.

### The most serious finding: the geocoder was planning the wrong city

An eval case scheduled stops it should not have. Tracing it showed Open-Meteo's
geocoding ranks by population, so **"Goa" resolved to Genoa, Italy** (pop 580k). Every
Goa case in the benchmark was building an itinerary from Italian churches — *Abbazia di
San Siro*, *Aquarium of Genoa* — while the plan claimed to be about Goa.

Exact-name matching is now preferred over population ranking. That is **not sufficient
on its own**: Open-Meteo has no entry for the Indian state of Goa at all, so an exact
match still lands on Goa, Philippines. Hence the resolved place is returned to the caller
and surfaced as an itinerary warning whenever it differs from the request. Naming which
place was planned is the only honest option when the geocoder cannot find the intended one.

### Part 3 — Re-measured with real data

| Metric | Cold cache | Warm cache |
|---|---|---|
| Cases run / crashes | 10 / **0** | 10 / **0** |
| Verifier agreed with expectation | **6/6** | **6/6** |
| Mean latency | **59.15 s** | **0.00 s** |
| p95 latency | **87.19 s** | **0.01 s** |
| Cases needing repair | 3/10 | 3/10 |
| Mean repair iterations | 0.30 | 0.30 |
| Cases with scheduled stops | 5/10 | 5/10 |
| Stops scheduled / grounded | **33 / 33** | 33 / 33 |

Latency is dominated entirely by cold Overpass lookups (60–100 s per unseen city);
cached lookups are effectively free. Only the warm figure describes steady state, and
only the cold figure describes a first-time visitor to a new city. Neither alone is
"the" latency.

**Cases that regressed versus the pre-fix run, and why — this matters more than the
totals.** The earlier run reported 138 stops across 8/10 cases. The corrected run
reports 33 across 5/10. That is not a regression in capability; the earlier number was
**inflated by planning the wrong city**. Goa now correctly resolves to Goa, Philippines,
a small town with zero Wikidata-linked POIs, so the Goa cases legitimately schedule
nothing instead of scheduling Genoa's landmarks under a Goa label. `gibberish_destination`
also correctly dropped from 6 stops to 0. **Fewer stops, all of them real.**

### Known quality limitation, not yet fixed

Every Wikidata-linked POI scores 4.0–4.5 on the notability proxy, so the knapsack's ties
break lexicographically. The sample Kyoto itinerary is consequently all alphabetically
early temples — *Awata-jinjya, Anyo Temple, Bishamondō, Chion-in* — while Kinkaku-ji and
Kiyomizu-dera sit in the candidate pool unselected. The scheduler is doing exactly what
it was told; the input signal is too coarse to rank landmarks against each other. Fixing
it properly needs a real popularity signal (Wikidata sitelink counts, or a provider that
ships importance scores). **Do not describe the current output as well-ranked.**

Sample real itinerary: [docs/samples/kyoto-3day-real-itinerary.md](docs/samples/kyoto-3day-real-itinerary.md)

## Phase 8 — Eval harness

`backend/evals/` (`cases.py`, `run_eval.py`). Ten benchmark cases across four
categories — ordinary, tight-but-repairable, genuinely infeasible, and
edge/adversarial (gibberish destination, no destination stated, 30-day upper bound).
The infeasible cases matter most: a harness that only measures happy paths cannot tell
you whether the verifier catches anything.

Measured (`python -m evals.run_eval`, no API keys configured):

| Metric | Result |
|---|---|
| Cases run / crashes | 10 / **0** |
| Constrained cases (budget stated) | 6 |
| Verifier agreed with expected outcome | **6/6 (100%)** |
| Mean latency | 0.93 s |
| p95 latency | 1.61 s |
| Total repair iterations across all cases | 3 |
| Stops scheduled | **0** |

**The harness prints an explicit warning when zero stops are scheduled**, because that
is exactly the situation where the numbers could be misread as success: with no
`OPENTRIPMAP_API_KEY` there is no POI source, so the scheduling and grounding columns
prove only that the pipeline degrades honestly — not that the real-data path works.
That caveat is emitted by the tool itself rather than left to a reader to remember.

Exit code is non-zero on any crash or verifier/expectation mismatch, so this is usable
as a CI gate later.

## Phase 7 — Frontend truth

Removed UI that displayed invented numbers. `BudgetDashboard` was the worst case: it
never received the backend's real `BudgetBreakdown` at all — it hardcoded a `baseBudget`
(125000 for Japan, else 25000), hardcoded every line item, and rendered a fixed
**"Confidence Score: 94%"** (the same dishonesty pattern as the old fake
`verification_node` that always reported 95%). The real `budget_summary` was already
present in `TripPlanResults` and simply never passed down.

- `BudgetDashboard` rewritten to render only real figures from `plan.budget_summary`,
  with an honest empty state when no budget exists. The per-day timeline is an even
  split of the real total, **labelled as exactly that** — the planner produces no
  per-day spend, so anything finer would be invented.
- **Deleted `BudgetSimulator.tsx`**: its "Live Trip Expense Tracker"
  (fixed 35,000/21,300/13,700), "AI Festival Price Forecast" (fixed +35/+42/+15%), and
  "Can I Afford This?" trade-off list were static JSX that never changed with input,
  presented as AI analysis.
- **Deleted `WeatherRadarMap.tsx`**: decorative SVG with no weather data behind it,
  labelled as a radar map.

Verified: `tsc --noEmit` clean, `next build` succeeds (11/11 pages).

## Phase 5 — Alembic owns the schema

Alembic was installed but had **never** produced a working migration. Three independent
causes, each of which alone would have been enough:

1. `alembic/script.py.mako` was missing entirely, so `alembic revision` crashed before
   writing anything.
2. `env.py` set `target_metadata = Base.metadata` but never imported the model modules.
   `Base.metadata` is only populated as a side effect of importing the mapped classes,
   so autogenerate compared the DB against **empty** metadata and silently emitted a
   migration whose `upgrade()` body was `pass`. This is the quiet one — it produces a
   real-looking migration file that does nothing.
3. `app/main.py` called `Base.metadata.create_all()` at import time, so the app raced
   ahead and built the tables itself. `alembic upgrade head` then failed with
   "relation users already exists", and any future column-altering migration would
   silently never run against a database the app had already shaped.

Fixed all three: added the template, imported the models in `env.py`, deleted
`create_all()`, and made the compose command run `alembic upgrade head` before uvicorn.
The schema now has exactly one owner, and it is the one with a version history.

Verified from a completely empty volume: the migration applies on cold start, `/health`
reports the database connected, all three tables are created by the migration alone, a
fresh autogenerate detects **zero drift** against the models, register/login/list-trips
work, and 76/76 tests pass.

## Phase 4 — Real verifier + bounded replan loop

**Built:**
- `app/verification/plan_verifier.py` — `verify_plan()` checks an assembled plan
  against the traveler's hard constraints. Deliberately **not** an LLM self-review:
  every check is arithmetic or a structural invariant, so a violation is a fact the
  graph can route on rather than an opinion. Codes: `budget_overrun`,
  `activities_overspend`, `day_count_mismatch`, `slot_overlap`, `ungrounded_fact`.
  Each violation carries `repairable` and (where relevant) `overspend_amount`, so the
  repair step branches on identity instead of string-matching a message.
- The `ungrounded_fact` check is the grounding guarantee made enforceable: every
  scheduled slot must carry a `source` tracing it to a real tool call, or the plan
  fails verification.
- `verification_node` / `repair_node` / `verification_router` in `orchestrator.py`,
  wired into a genuine LangGraph **cycle**:
  `node_itinerary -> node_verify -> (node_repair -> node_itinerary)* -> node_planner`.
  This is the first real cycle in the graph — everything before it was a DAG.
- `repair_node` is deterministic arithmetic, not an LLM guess: it reduces the
  activities allocation by exactly the overspend and recomputes the total from its
  components, then lets the scheduler re-solve against the tighter ceiling. It either
  resolves the violation or provably cannot.
- The loop terminates on any of: verification passing, an unrepairable violation,
  `MAX_REPAIR_ATTEMPTS` (2), or exhausted headroom. Unresolved violations are reported
  honestly in the response rather than being swallowed.

**Two real bugs found while verifying live (neither was in the plan):**
1. `rule_based_parse()` could not extract "a budget of 16000" — its regex allowed no
   filler between the keyword and the number. With no LLM key configured this is the
   *only* parse path, so `requirements.budget` came back `None` and the entire hard
   budget constraint was **silently inert in the default configuration**. The verifier
   was correct to pass; its input was broken. Fixed and covered by parametrized tests.
2. The graph's `verification` result never reached the API response — the endpoint
   builds a fixed key set. Added `PlanVerificationOut`/`ViolationOut` and surfaced it,
   so a client can actually see whether the plan satisfies its constraints.

**Efficiency fix worth noting:** the first working version burned a full scheduler
re-run discovering it had no headroom (reducing an already-zero activities budget by
9312 changes nothing). Moved the headroom check into `verification_router` so the
futile pass is never dispatched — the impossible-budget case now ends after 1 repair
attempt instead of 2.

**Verified live** (Docker Compose, committed `docker-compose.yml`, only the db host
port remapped for this machine):
- *Repairable case* — "2 day Kyoto trip, budget 16000": verifier flagged
  `budget_overrun` (total 17512, over by 1512) -> repair tightened activities
  3200 -> 1688 -> scheduler re-solved -> second verification **passed**, final total
  exactly 16000.0, `repair_attempts: 1`.
- *Unsatisfiable case* — same trip, budget 5000: repaired once (3200 -> 0), re-verified,
  detected no remaining headroom, stopped, and returned `valid: false` with the
  unresolved `budget_overrun` rather than faking success or spinning.
- 76/76 backend tests pass.

**Note on scope:** the repair lever is currently the activities allocation only. A
budget blown by transport/accommodation costs can be *detected* but not *repaired* —
it is reported honestly instead. Widening repair to re-select a cheaper hotel or
transport mode is a real follow-up, not something to claim as done.

## Phase 3 — Deterministic scheduling core

Built on branch `worktree-deterministic-scheduling-core`. Tasks 1–5 (pytest/hypothesis
bootstrap, domain models, travel-time port + haversine adapter, cost estimator, per-day
knapsack selection and brute-force ordering) were completed in an earlier session; this
entry covers Tasks 6–14.

**Built:**
- `scheduling/scheduler.py` — `build_schedule()` cross-day orchestration: owns the
  used-candidate set, depletes the activities budget across days, and applies a
  repeat-fallback (revisit the best candidate rather than leave a day blank) with an
  explicit warning when it fires.
- `scheduling/validator.py` — `validate()` independently re-checks a `ScheduleResult`
  against its `ScheduleConstraints` (day-window bounds, slot overlap, budget ceiling).
  Deliberately separate from `build_schedule` so it's a real trust-but-verify check
  rather than the same logic asserting about itself. This is also the reusable seed for
  Phase 4's plan verifier.
- `tests/scheduling/test_properties.py` — hypothesis property tests asserting the
  scheduler's output *always* satisfies `validate()`, and that it's deterministic
  run-to-run.
- Real coordinates end-to-end: `destination_search` now keeps OpenTripMap's
  `point{lat,lon}` (previously discarded), and `hotel_search` keeps Amadeus's
  `hotel.latitude/longitude`, carried through `AccommodationOption` into the agent.
  Places missing a name or coordinates are skipped rather than defaulting to a
  fabricated `(0,0)` — a Gulf-of-Guinea point would silently corrupt travel-time math.
- `schemas/itinerary.py` widened: request now carries `activities_budget` +
  `accommodation_lat/lon`; output carries structured `slots` (each with its `source`
  API, so any scheduled fact is traceable) and `warnings`; plus a narration-only
  schema for the LLM.
- `agents/itinerary.py` rewritten — **the scheduler is now the mandatory backbone.**
  `DESTINATION_DATABASE`, `rule_based_generate()`, and the old "3-per-day modulo"
  indexing are deleted outright; no code path remains that invents itinerary structure.
  The LLM, when a key is configured, only narrates prose over slots the scheduler
  already fixed — it cannot reorder, invent, drop, or rename a stop. With no key,
  deterministic templated narration is built straight from the schedule.
- `orchestrator.py`'s `itinerary_node` now passes the budget node's `activities_cost`
  as the scheduler's hard per-trip ceiling, and the top accommodation pick's real
  coordinates as the day's start location.

**Real bug found and fixed (worth remembering):** the Task 8 property test immediately
found a genuine unsoundness in the Task 5 knapsack. It reasons in integer cents but the
caller charges the true float cost, and it used `round()` — so a sub-cent cost
(`0.0039`) quantized to **0 cents**, looked free, got selected against a `0.0` budget,
and was then charged its real cost to the trip total, breaking the hard budget
guarantee. Fixed by making quantization conservative in both directions (budget rounds
DOWN, each cost rounds UP), so a selected set's true total can never exceed the real
budget. Pinned with a deterministic regression test and re-verified with a standalone
5000-example hypothesis run. This is exactly the class of bug the "budget is a hard,
programmatically-enforced constraint" requirement exists to prevent.

**Plan deviation (flagged, not silent):** the plan's Task 12 budget test asserted that a
`0.0` activities budget schedules nothing. That premise is wrong —
`ACTIVITY_COST_BY_CATEGORY` prices `"natural"` at `0.0`, so genuinely-free attractions
legitimately still fit a zero budget. Rather than weaken the test to pass, it was
replaced with the invariant that actually holds (zero budget ⇒ zero spend and no paid
stop scheduled) plus a second case exercising a non-trivial budget ceiling.

**Verified live** (Docker Compose, `db` + `backend`, local uncommitted override only —
`docker-compose.yml` itself untouched; needed because host port 5433 is occupied by
another project on this machine, plus the two pre-existing compose bugs logged under
Phase 0 still bite):
- `GET /health` → `{"status":"healthy","database":"connected"}`.
- `POST /api/v1/itinerary/generate` for **Kyoto** returned `slots: []` with explicit
  per-day warnings (`"no verified points of interest available to schedule"`). Kyoto is
  the sharpest possible test case here: the pre-Phase-1 code returned *hardcoded Kyoto
  attractions*, so the old system would have produced fake-but-entirely-plausible
  temples. The new pipeline correctly admits it has no verified data instead.
- `POST /api/v1/orchestrator/plan` (authenticated, full graph) ran every node to
  completion and returned `day_wise_itinerary` in the new schema, carrying `slots` and
  `warnings`, with `budget_summary.activities_cost` computed upstream — confirming the
  scheduler is genuinely wired into the graph, not just unit-tested in isolation.
- 50/50 backend tests pass.

**Blocked — cannot be closed by me:** the real-data path (real POIs → real scheduled
slots with real travel times) is still **not live-verified**, because there is no
`backend/.env` on this machine and therefore no `OPENTRIPMAP_API_KEY` (nor
`AMADEUS_API_KEY`/`AMADEUS_API_SECRET` for hotel coordinates). Obtaining those requires
creating accounts, which is the user's to do. Everything above verifies the
honest-degradation path and the logic under mocked real-shaped data; the moment a key
is present, `POST /api/v1/itinerary/generate` should be re-run for a real city and the
scheduled slot names checked against the live OpenTripMap response before Phase 3 is
called fully done.

**Still open from this phase:** Task 14's live real-data check (above), and the branch
is not yet merged to `main`.

## Phase 1 — Decide the MCP layer's fate, ground the tools

**Found before deciding:** the `mcp_server/` "MCP protocol" scaffolding (`server.py`'s
stdio server, `handlers/`, the `tool_registry` decorators) was 100% unused. Every one
of `weather.py`, `itinerary.py`, `accommodation.py`, `budget.py` bypassed it entirely
with a plain `from mcp_server.tools.X import X` direct function call plus a
try/except-ImportError fallback to a duplicated hardcoded copy of the same fake logic.
Also found `destination_search` specifically was dead code beyond that: it was
imported into `itinerary.py` but never actually called — `rule_based_generate` used a
hand-authored `DESTINATION_DATABASE` dict instead, and the LLM path never grounded its
prompt in real attraction data at all.

**Decision (confirmed with the user):** delete the protocol scaffolding rather than
wire up a real MCP subprocess — this app only ever runs as one process, so spawning a
second one to talk JSON-RPC over stdio to itself would be pure complexity for zero
behavior change. Moved the four tool functions into `backend/app/tools/` as plain
modules, deleted `mcp_server/` outright.

**Built:**
- `backend/app/core/cache.py`: a small hand-rolled in-process TTL-cache decorator
  (`@ttl_cache(seconds=...)`). No Redis in this stack (confirmed in
  KICKOFF_PROMPT.md's audit), and a single-process cache is enough to avoid
  re-hitting rate-limited external APIs for repeated lookups. No new dependency.
- `backend/app/tools/_http.py`: minimal stdlib-only (`urllib`) JSON GET/POST helpers —
  deliberately avoided adding `httpx`/`requests` as a new dependency for something
  this simple (the "ask before adding a dependency" constraint in KICKOFF_PROMPT.md
  §4.2). `httpx` is already pulled in transitively by the `openai` package, but
  depending on that transitively without declaring it felt fragile.
- `backend/app/tools/weather.py`: real weather via **Open-Meteo** (free, no API key).
  Geocodes the location name, fetches a daily forecast, maps WMO weather codes to
  condition labels. Returns an empty forecast (not fake data) if the location can't be
  geocoded or the API call fails — `analyze_weather()` in `agents/weather.py` already
  had a graceful "N/A" path for empty forecasts, so no caller changes needed there
  beyond the import swap.
- `backend/app/tools/hotel_search.py`: real hotel search via **Amadeus for
  Developers** (self-service free/test tier) — OAuth2 client-credentials token, city
  search to resolve an IATA city code, hotel list by city, hotel-offers pricing.
  Requires `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` (not yet supplied — see Blocked
  below); returns an empty hotel list, not fabricated ones, when unset or any step
  fails.
- `backend/app/tools/destination_search.py`: real points-of-interest via
  **OpenTripMap** (free tier) — geocodes the destination, searches a radius for
  places, maps OpenTripMap's 1–3/1h–3h "rate" importance tier onto a comparable 0–5
  score. Requires `OPENTRIPMAP_API_KEY` (not yet supplied); returns an empty activity
  list, not fabricated ones, when unset or any step fails.
- `backend/app/tools/budget_estimator.py`: relocated unchanged. This one stays a
  deterministic rate-table estimate rather than a live-pricing API call — it's
  presented as an estimate, not a claim of live pricing, and `optimize_budget()`
  already overrides it with real transport/accommodation costs when those are
  available. Grounding it in a live pricing API felt like solving a problem it
  doesn't actually have.
- Rewired `agents/weather.py`, `agents/accommodation.py`, `agents/budget.py`,
  `agents/itinerary.py` to import from `app.tools.*` directly — dropped the
  `sys.path` hack and the duplicated hardcoded-fallback function in each file (no
  longer needed now that the tools live in the same codebase and always import).
- **`itinerary.py` specifically**: since `destination_search` was previously dead
  code, just swapping its backing API for a real one wouldn't have changed anything
  observable — nothing consumed its output. Fixed that: `generate_itinerary()` now
  fetches real POIs once and (a) injects real attraction names into the LLM prompt as
  grounding context ("prefer these real names over invented ones"), and (b)
  `rule_based_generate()` now has three tiers — curated `DESTINATION_DATABASE` entries
  first (unchanged, hand-authored launch content, not per-request fabrication),
  then a schedule built from real POI names when `destination_search` returned any,
  and only the old generic/unnamed template text as the last resort when neither is
  available. This was judged to be within the scope of "ground destination_search in
  real data" (already agreed with the user) rather than new scope, since grounding a
  tool nobody calls is meaningless — flagging it here rather than treating the
  decision as silent.

**Blocked / deferred:**
- Hotel and attraction grounding are code-complete but **not live-verified with real
  data** — they need `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` (sign up free at
  https://developers.amadeus.com) and `OPENTRIPMAP_API_KEY` (sign up free at
  https://opentripmap.io/product), which only the user can obtain (per the "never
  create accounts or enter credentials" rule). Verified instead that both tools
  degrade honestly — empty results plus a logged warning, not fabricated Kyoto data —
  when the keys are absent. Once keys are added to `backend/.env`, these should be
  re-verified live with real requests before calling Phase 2 fully done.
- `rule_based_recommend()` in `accommodation.py` still calls `hotel_search` with
  hardcoded placeholder dates (`2026-10-01`/`2026-10-08`) rather than the trip's real
  dates — `AccommodationRequest` has no date fields today. Once Amadeus is live this
  will return real pricing for *a* valid date range, just not necessarily the
  traveler's actual one. Threading real dates through means widening
  `AccommodationRequest` and the orchestrator's state, which is more invasive than
  this pass's tool-swap scope — left as a follow-up.

**Verified live** (Docker Compose, `db` + `backend`, same local port-override
approach as Phase 0 — `docker-compose.yml` itself untouched):
- Weather for Tokyo vs. Reykjavik returned genuinely different, real forecasts
  (26°C/83% rain vs. 10°C/100% rain) — not the old `22 + (i % 3)` pattern.
- A nonsense location (`Zzqxwblahfake123`) degraded to the existing "N/A" response
  instead of crashing.
- `POST /accommodation/recommend` and `POST /itinerary/generate` (for a
  non-curated destination) both returned clean, non-crashing results with the
  expected "not configured" warnings logged — confirming the missing-key path is
  honest rather than silently fabricating data.
- `POST /itinerary/generate` for Goa still returns the curated hand-authored plan
  unchanged.
- No more `Could not import ... from mcp_server` warnings in startup logs — confirmed
  the old dead-code import path is gone.

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
