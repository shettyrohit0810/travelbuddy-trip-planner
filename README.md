<div align="center">

<img src="https://img.shields.io/badge/TravelBuddy-AI%20Trip%20Planner-0058bc?style=for-the-badge&logo=airplane&logoColor=white" />

# ✈️ TravelBuddy — AI Multi-Agent Travel Planner

### *A deterministic scheduler with a bounded verify-and-repair loop, orchestrated in LangGraph.*

[![CI](https://github.com/shettyrohit0810/travelbuddy-trip-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/shettyrohit0810/travelbuddy-trip-planner/actions/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2+-orange?style=flat-square)](https://langchain-ai.github.io/langgraph/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[**Architecture**](#-what-is-travelbuddy) · [**Decisions log**](DECISIONS.md) · [**Run it locally**](#-quick-start)

</div>

---

> **Fork notice.** Built on [Akash7367/Trip_planer_Ai](https://github.com/Akash7367/Trip_planer_Ai).
> This fork rebuilt the planning core — deterministic scheduler, hard-constraint
> verifier with a bounded repair loop, migrations, and security hardening. See
> [Credits](#-credits) for the precise split.

## 📌 What is TravelBuddy?

TravelBuddy plans trips with a **LangGraph agent pipeline whose itinerary is decided by a deterministic scheduler, not by an LLM**. The LLM narrates prose over stops that are already fixed; it cannot reorder, invent, drop, or rename one.

The part worth looking at is the **bounded verify-and-repair cycle**:

```
understanding → destination → weather → transport → accommodation → budget
                                             ↓
                    itinerary → verify → (repair → itinerary)* → planner
```

`verify` checks the assembled plan against **hard constraints using arithmetic, not an
LLM self-review** — budget ceiling, trip length, slot overlap, and whether every
scheduled fact carries a source attribution. A violation is therefore a fact the graph
routes on. `repair` makes a targeted deterministic change (reduce the activities
allocation by exactly the overspend, recompute the total) and the scheduler re-solves.
The loop terminates on success, an unrepairable violation, an attempt cap, or exhausted
headroom — and reports unresolved violations honestly rather than swallowing them.

**Worked example** (`budget 16000`, measured): first pass overruns by 1512 → repair
tightens activities 3200 → 1688 → scheduler re-solves → second verification passes,
final total exactly 16000. Given an impossible budget (5000) it repairs once, detects no
remaining headroom, stops, and returns `valid: false`.

### ⚠️ Honest status

This is a work in progress, and a few claims are deliberately **not** made:

- **POI grounding is real and needs no API key** — it uses OpenStreetMap via Overpass,
  verified end-to-end (see the sample itinerary above). Hotels still require an Amadeus
  key and remain unverified. Where a source is unavailable the tools return **empty
  results and explicit warnings — they never fabricate places.**
- **Geocoding is a weak link.** Open-Meteo has no entry for some well-known regions, so
  a request can resolve to a different place of the same name. The itinerary now says
  which place it actually planned rather than substituting silently.
- **The agentic layer is built but UNMEASURED — treat every agent claim as frozen.**
  There is a bounded tool-calling loop, real acquisition tools, a trajectory recorder
  and a trace view in the UI. No LLM key is configured on the development machine, so
  **no agent has ever actually made a decision.** Tests drive the loop with a scripted
  brain, which verifies control flow, budget enforcement and trace fidelity — and says
  nothing about decision quality. Recovery rate, tool calls per request, added latency
  and token cost are all unmeasured. `LLMBrain` raises rather than falling back to
  heuristics, so a run without a key is visibly `unavailable` instead of quietly
  pretending. **Nothing about agentic recovery should be claimed until those numbers
  exist.**
- **Parallel execution is real and measured** (see Benchmarks): research branches run
  concurrently, verified by measuring peak concurrency and wall clock rather than by
  reading the edge list.
- The repair loop spends across activities, food and lodging, each floored. Transport
  is deliberately not reducible, so a transport-dominated overrun is partially absorbed
  and then reported unresolved rather than "fixed" by rewriting a real price.
- A second "vlog intelligence" pipeline exists in the codebase but is a linear chain
  with a placeholder verification step; it is not part of the main planning graph.

See [DECISIONS.md](DECISIONS.md) for the full per-phase engineering log, including bugs
found and scope explicitly cut.

### 🎯 The Core Problem We Solve

> Travelers currently juggle 6–12 separate platforms (flights, hotels, weather, maps, budgeting). Existing AI travel tools are generic chatbots with no domain specialization, stale training data, and no real-world price verification.

**TravelBuddy solves this with:**

| Problem | TravelBuddy Solution |
|---|---|
| **LLMs inventing plausible-but-fake places** | Every scheduled stop carries a `source`; unattributed facts fail verification |
| **LLMs ignoring a budget** | Budget is enforced by a knapsack solver and re-checked arithmetically, never trusted to the model |
| **Fragmented planning tools** | Single unified platform — plan to PDF in one flow |
| **Static plans** | **Selective Replanning** — change one day or one hotel without rebuilding the rest |
| **No personalization** | **Persistent Memory System** — learns and remembers your travel preferences |
| **Language barrier** | Multilingual vlog ingestion + outputs plan in 100+ languages |
| **Price inflation/hallucinations** | Double-verification of prices with high-confidence thresholds |

---

## ✨ Key Features

- 🤖 **16-Agent Dual LangGraph Pipeline** — Two parallel orchestration graphs working in concert.
- 🎬 **Vlog Intelligence Pipeline** — Extracts real 2025/2026 prices & hidden gems from YouTube travel vlogs.
- 🔄 **Selective Replanning** — Regenerate only the parts of the plan that need changing.
- 🧠 **Persistent Memory** — Remembers your travel preferences across sessions.
- 🌍 **Multilingual Support** — Plans generated in Hindi, Spanish, French, and 100+ languages.
- 💰 **Constraint-Aware Budget Engine** — Plans that actually fit your budget constraints.
- 📄 **PDF Export** — Download your complete itinerary as a beautiful PDF document.
- 📧 **Email Delivery** — Send plans directly to your inbox.
- 🗺️ **Interactive Map** — Visual route planning.
- 🛠️ **Dynamic Tool Registry** — Agents discover and invoke tools at runtime (MCP).

---

## 🏗️ Architecture Overview

TravelBuddy is built on a **layered, domain-separated architecture** where each layer has a single, well-defined responsibility.

```
┌─────────────────────────────────────────────────────┐
│                  Presentation Layer                  │
│          Next.js 15 + TypeScript Frontend           │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP / REST
┌─────────────────────▼───────────────────────────────┐
│                    API Layer                         │
│     FastAPI Gateway + JWT Auth + Rate Limiter       │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              Orchestration Layer                     │
│         LangGraph Workflow Engine (2 Graphs)        │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
┌──────────────▼──────┐  ┌───────▼──────────────────┐
│  Traditional Graph  │  │  Vlog Intelligence Graph  │
│    8 Agents         │  │    8 Agents               │
└──────────────┬──────┘  └───────┬──────────────────┘
               │                  │
┌──────────────▼──────────────────▼───────────────────┐
│                   Tool Layer (MCP)                   │
│         12 Tools across 7 domains                   │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│                    Data Layer                        │
│      PostgreSQL 16 (Neon) + Redis (Upstash)         │
└─────────────────────────────────────────────────────┘
```

### System Component Diagram

```mermaid
graph TB
    subgraph "Presentation Layer"
        FE[Next.js Frontend]
        VOICE_UI[Voice Interface]
    end

    subgraph "API Layer"
        GW[FastAPI Gateway]
        AUTH_MW[Auth Middleware]
        RATE_MW[Rate Limiter]
        LOG_MW[Request Logger]
    end

    subgraph "Orchestration Layer"
        LGRAPH[LangGraph Workflow Engine]
        STATE_MGR[State Manager]
        RETRY[Retry Handler]
    end

    subgraph "Agent Layer"
        AGENTS[16 Specialized Agents]
    end

    subgraph "Tool Layer"
        MCP_SRV[MCP Server]
        TOOL_REG[Tool Registry]
    end

    subgraph "Integration Layer"
        LLM_POOL[LLM Pool - Gemini / Llama 3.3]
        EXT_API[External APIs]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL)]
        REDIS[(Redis)]
    end

    FE & VOICE_UI --> GW
    GW --> AUTH_MW --> RATE_MW --> LOG_MW --> LGRAPH
    LGRAPH --> STATE_MGR --> AGENTS
    AGENTS --> MCP_SRV --> TOOL_REG
    AGENTS --> LLM_POOL
    TOOL_REG --> EXT_API
    TOOL_REG --> PG & REDIS
    LGRAPH --> PG
```

---

## 🤖 The 16 Agents & How They Work

TravelBuddy orchestrates its agents across two independent state machine graphs managed by LangGraph. Below is the detailed breakdown of the input/output schemas, responsibilities, and system prompts of each agent.

### 📈 Graph 1: Traditional Orchestrator (8 Agents + 1 Replanner)

Coordinates structured trip planning using live tools and database retrieval.

```mermaid
graph TD
    A[TripUnderstandingAgent] --> B[DestinationAgent]
    A --> C[WeatherAgent]
    A --> D[TransportAgent]
    B --> E[HotelAgent]
    B --> F[BudgetAgent]
    C --> E
    C --> F
    D --> F
    E --> G[ItineraryAgent]
    F --> G
    G --> H[FinalPlannerAgent]
    H --> |disruption| I[ReplanningAgent]
```

#### 1. Trip Understanding Agent
* **Role:** Node 1 (Entry)
* **LLM Model:** Gemini 2.0 Flash
* **Responsibilities:** Parses free-text user queries into structured parameters, applying historical user preferences from database memory to fill in gaps.
* **System Prompt:**
  ```text
  You are an expert travel intake specialist. Your job is to extract a complete, structured travel plan request from the user's natural language input. Extract parameters (destination, dates, budget, travelers, interests), fill missing fields with reasonable defaults, and query memories for user preferences. Return ONLY valid JSON matching the TripParameters schema.
  ```
* **Tools Used:** `get_user_memories`

#### 2. Destination Agent
* **Role:** Node 2A (Parallel)
* **LLM Model:** Gemini 2.0 Flash
* **Responsibilities:** Evaluates seasonality, safety, visa requirements, and user interest match-scores (0.0 to 1.0) to recommend targeted cities/destinations.
* **Tools Used:** `search_destinations`, `get_user_memories` (past trips)

#### 3. Weather Agent
* **Role:** Node 2B (Parallel)
* **LLM Model:** Gemini 2.0 Flash
* **Responsibilities:** Fetches live weather forecasts or historical averages for travel dates. Suggests specific packing lists and flags meteorological risks (e.g. monoons, heatwaves).
* **Tools Used:** `get_weather_forecast`

#### 4. Transport Agent
* **Role:** Node 2C (Parallel)
* **LLM Model:** Gemini 2.0 Flash
* **Responsibilities:** Researches flight options (cheapest vs. fastest) and trains/metro infrastructure at the destination.
* **Tools Used:** `search_flights`, `get_local_transport`

#### 5. Hotel Agent
* **Role:** Node 3A
* **LLM Model:** Gemini 2.0 Flash
* **Responsibilities:** Identifies properties across 3 budget tiers (Budget-friendly, Recommended Value, Premium). Extracts pros/cons and walking distance to transit hubs.
* **Tools Used:** `search_hotels`

#### 6. Budget Agent
* **Role:** Node 3B
* **LLM Model:** Gemini 1.5 Pro
* **Responsibilities:** Compiles estimates from Transport/Hotel agents, sets a 10% emergency buffer, evaluates feasibility, and returns three pricing options.
* **Tools Used:** `optimize_budget`

#### 7. Itinerary Agent
* **Role:** Node 4 (Synthesis)
* **LLM Model:** Gemini 1.5 Pro
* **Responsibilities:** Combines weather, hotel, and attraction reports to design a day-by-day itinerary. Groups activities geographically to minimize daily travel times.
* **Tools Used:** `generate_itinerary`

#### 8. Final Planner Agent
* **Role:** Node 5 (Output)
* **LLM Model:** Gemini 1.5 Pro
* **Responsibilities:** Packages the complete trip plan. Formats layout, triggers PDF generation, emails results, and saves learned user preferences.
* **Tools Used:** `generate_pdf`, `send_trip_email`, `save_user_memory`

#### 9. Selective Replanning Agent
* **Role:** Disruption Handler (Conditional)
* **LLM Model:** Gemini 1.5 Pro
* **Responsibilities:** Reacts to user modification requests (e.g., "Change Day 3 hotel", "Shorten trip to 3 days") by pinpointing only affected sub-states and re-invoking the specific domain agents without rebuilding the entire trip plan.

---

### 🎥 Graph 2: Vlog Intelligence Pipeline (8 Agents)

An advanced pipeline designed to search, download transcripts, extract knowledge, and synthesize real-time travel vlog data into itineraries.

```
User Query
    │
    ▼
┌──────────────────────┐
│ 1. Planner Agent     │ → Extracts: Destination, Language, Interests
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ 2. YouTube Search    │ → Scrapes live YouTube for travel vlogs
│    Agent             │   (real video IDs, views, upload dates)
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ 3. Transcript Agent  │ → Downloads real captions via youtube-transcript-api
│                      │   Filters sponsors, generates if unavailable
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ 4. Translation Agent │ → Translates to target language
│                      │   Preserves place names, prices, proper nouns
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ 5. Knowledge         │ → Extracts structured data:
│    Extraction Agent  │   Hotels, food spots, prices, hidden gems, transport
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ 6. Verification      │ → Cross-references prices & locations
│    Agent             │   Computes confidence scores (avg 95%)
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ 7. Itinerary         │ → Compiles day-wise plan with vlogger citations
│    Generator Agent   │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│ 8. Language          │ → Formats final JSON in target language
│    Personalization   │   Scales budget (Budget/Moderate/Luxury)
│    Agent             │
└──────────────────────┘
```

1. **Planner Agent** (`nodes/planner.py`): Formulates specialized search parameters and identifies target video demographics.
2. **YouTube Search Agent** (`nodes/youtube_search.py`): Targets high-density travel guides by querying live YouTube APIs for recent, high-performing videos.
3. **Transcript Agent** (`nodes/transcript.py`): Fetches captions via `youtube-transcript-api` and strips promotional content.
4. **Translation Agent** (`nodes/translation.py`): Converts spoken text into user language while protecting proper nouns, currency values, and locations.
5. **Knowledge Extraction Agent** (`nodes/knowledge.py`): Identifies street food, real costs, hidden gems, and active safety alerts mentioned by vloggers.
6. **Verification Agent** (`nodes/verification.py`): Cross-references spots against geographical coordinate systems to calculate accuracy thresholds.
7. **Itinerary Agent** (`nodes/itinerary.py`): Builds daily itinerary timelines anchored to vlogger video timestamps.
8. **Language Personalization Agent** (`nodes/personalization.py`): Standardizes pricing outputs to regional currencies and formats final JSON.

---

## 🗄️ Database Architecture

TravelBuddy utilizes **PostgreSQL 16** (Neon serverless instance) as its primary data layer, orchestrated using **SQLAlchemy 2.x ORM** and managed by **Alembic** migrations.

### Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar email UK
        varchar hashed_password
        varchar full_name
        varchar travel_style
        varchar preferred_currency
        jsonb preferences
        bool is_active
        bool is_verified
        timestamp created_at
        timestamp updated_at
    }

    TRIPS {
        uuid id PK
        uuid user_id FK
        varchar title
        varchar status
        varchar origin
        varchar destination
        varchar destination_region
        date start_date
        date end_date
        int num_travelers
        decimal total_budget
        varchar currency
        varchar travel_style
        text raw_request
        jsonb trip_params
        jsonb destination_report
        jsonb weather_report
        jsonb hotel_report
        jsonb transport_report
        jsonb budget_report
        jsonb itinerary_report
        jsonb final_plan
        varchar pdf_url
        timestamp created_at
        timestamp updated_at
    }

    ITINERARIES {
        uuid id PK
        uuid trip_id FK
        int day_number
        date date
        varchar theme
        jsonb morning_activities
        jsonb afternoon_activities
        jsonb evening_activities
        jsonb meals
        jsonb logistics
        decimal estimated_cost_usd
        varchar weather_summary
        timestamp created_at
    }

    HOTELS {
        uuid id PK
        uuid trip_id FK
        varchar name
        varchar destination
        varchar neighborhood
        decimal price_per_night_usd
        decimal total_price_usd
        int star_rating
        varchar tier
        jsonb amenities
        jsonb pros
        jsonb cons
        int recommendation_rank
        timestamp created_at
    }

    MEMORIES {
        uuid id PK
        uuid user_id FK
        varchar memory_type
        jsonb content
        float relevance_score
        timestamp created_at
        timestamp last_accessed
        timestamp expires_at
    }

    PREFERENCES {
        uuid id PK
        uuid user_id FK
        varchar key
        text value
        varchar data_type
        timestamp updated_at
    }

    AGENT_LOGS {
        uuid id PK
        uuid trip_id FK
        varchar agent_name
        varchar status
        jsonb input_payload
        jsonb output_payload
        int tokens_used
        float execution_time_ms
        int retry_count
        text error_message
        varchar error_code
        timestamp created_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        bool is_revoked
        timestamp expires_at
        timestamp created_at
        varchar issued_from_ip
    }

    USERS ||--o{ TRIPS : "plans"
    USERS ||--o{ MEMORIES : "has"
    USERS ||--o{ PREFERENCES : "stores"
    USERS ||--o{ REFRESH_TOKENS : "has"
    TRIPS ||--o{ ITINERARIES : "contains"
    TRIPS ||--o{ HOTELS : "recommends"
    TRIPS ||--o{ AGENT_LOGS : "generates"
```

### Table Schemas (SQL DDL)

#### 1. `users` Table
Stores primary user identity and high-level preferences.
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    travel_style    VARCHAR(50) DEFAULT 'comfort', -- budget, comfort, luxury
    preferred_currency VARCHAR(3) DEFAULT 'USD',
    preferences     JSONB DEFAULT '{}',            -- diet, speed preferences
    is_active       BOOLEAN DEFAULT TRUE,
    is_verified     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
```

#### 2. `trips` Table
Stores raw request data, parsed input parameters, intermediate agent outputs, and the final compiled travel JSON.
```sql
CREATE TABLE trips (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               VARCHAR(255),
    status              VARCHAR(50) NOT NULL DEFAULT 'planning', -- planning, completed, failed, replanning
    origin              VARCHAR(255),
    destination         VARCHAR(255),
    destination_region  VARCHAR(255),
    start_date          DATE,
    end_date            DATE,
    num_travelers       INTEGER DEFAULT 1,
    total_budget        DECIMAL(12,2),
    currency            VARCHAR(3) DEFAULT 'USD',
    travel_style        VARCHAR(50),
    raw_request         TEXT,
    trip_params         JSONB,         -- Raw parsed params
    destination_report  JSONB,         -- Cache results from Destination Agent
    weather_report      JSONB,         -- Forecast summaries
    hotel_report        JSONB,         -- Recommended properties
    transport_report    JSONB,         -- Flight options
    budget_report       JSONB,         -- Final optimization percentages
    itinerary_report    JSONB,         -- Structured day schedule
    final_plan          JSONB,         -- Full merged schema
    pdf_url             TEXT,          -- AWS S3/Cloudinary link
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_status ON trips(status);
```

#### 3. `itineraries` Table
Enables granular editing and selective replacement of specific days within a trip.
```sql
CREATE TABLE itineraries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_number          INTEGER NOT NULL,
    date                DATE,
    theme               VARCHAR(255),
    morning_activities  JSONB DEFAULT '[]',
    afternoon_activities JSONB DEFAULT '[]',
    evening_activities  JSONB DEFAULT '[]',
    meals               JSONB DEFAULT '{}',
    logistics           JSONB DEFAULT '{}',
    estimated_cost_usd  DECIMAL(10,2),
    weather_summary     VARCHAR(255),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trip_id, day_number)
);
CREATE INDEX idx_itineraries_trip_id ON itineraries(trip_id);
```

#### 4. `hotels` Table
Caches property structures recommended by the Hotel Agent.
```sql
CREATE TABLE hotels (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id                 UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name                    VARCHAR(255) NOT NULL,
    destination             VARCHAR(255),
    neighborhood            VARCHAR(255),
    price_per_night_usd     DECIMAL(10,2),
    total_price_usd         DECIMAL(12,2),
    star_rating             INTEGER CHECK (star_rating BETWEEN 1 AND 5),
    tier                    VARCHAR(50),  -- budget, mid-range, luxury
    amenities               JSONB DEFAULT '[]',
    pros                    JSONB DEFAULT '[]',
    cons                    JSONB DEFAULT '[]',
    recommendation_rank     INTEGER DEFAULT 1,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 5. `memories` Table
Tracks preferences across sessions for personalization.
```sql
CREATE TABLE memories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    memory_type     VARCHAR(50) NOT NULL, -- preference, past_trip, blacklist
    content         JSONB NOT NULL,       -- key-value preferences
    relevance_score FLOAT DEFAULT 1.0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_memories_user_type ON memories(user_id, memory_type);
```

#### 6. `agent_logs` Table
Essential for observability. Tracks execution latencies, token consumption, and input/output payloads of every agent invocation.
```sql
CREATE TABLE agent_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    agent_name          VARCHAR(100) NOT NULL,
    status              VARCHAR(50) NOT NULL,  -- running, success, failed, fallback
    input_payload       JSONB,
    output_payload      JSONB,
    tokens_used         INTEGER DEFAULT 0,
    execution_time_ms   FLOAT,
    retry_count         INTEGER DEFAULT 0,
    error_message       TEXT,
    error_code          VARCHAR(100),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_agent_logs_trip_agent ON agent_logs(trip_id, agent_name);
```

#### 7. `preferences` Table
Tracks simple settings keys for users.
```sql
CREATE TABLE preferences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key         VARCHAR(100) NOT NULL,
    value       TEXT NOT NULL,
    data_type   VARCHAR(20) DEFAULT 'string',
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, key)
);
```

#### 8. `refresh_tokens` Table
Manages secure JWT authorization flows.
```sql
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) UNIQUE NOT NULL,
    is_revoked      BOOLEAN DEFAULT FALSE,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    issued_from_ip  VARCHAR(45)
);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(user_id) WHERE is_revoked = FALSE;
```

---

## 🔄 Request Lifecycle & Workflows

### 1. Request Sequence Diagram

```mermaid
sequenceDiagram
    participant Client as Frontend / Client
    participant API as FastAPI Gateway
    participant Auth as Auth Middleware
    participant LG as LangGraph Workflow
    participant Agents as AI Agent Pool
    participant MCP as MCP Tool Server
    participant DB as PostgreSQL

    Client->>API: POST /api/v1/orchestrator/plan
    API->>Auth: Validate JWT Token
    Auth-->>API: Extracted user_id
    API->>LG: Initialize StateGraph with user input
    
    par Intake & Preferences
        LG->>Agents: Invoke TripUnderstandingAgent
        Agents->>DB: Query user memory
        DB-->>Agents: Preferences & constraints
        Agents-->>LG: Populate structured state variables
    end
    
    par Parallel Research Phase
        LG->>Agents: Invoke DestinationAgent
        Agents->>MCP: call_tool("search_destinations")
        MCP-->>Agents: Recommended venues

        LG->>Agents: Invoke WeatherAgent
        Agents->>MCP: call_tool("get_weather_forecast")
        MCP-->>Agents: Day-by-day temperatures

        LG->>Agents: Invoke TransportAgent
        Agents->>MCP: call_tool("search_flights")
        MCP-->>Agents: Live flight rates
    end

    LG->>Agents: Invoke HotelAgent (receives destination + weather)
    Agents->>MCP: call_tool("search_hotels")
    MCP-->>Agents: Properties JSON
    
    LG->>Agents: Invoke BudgetAgent (aggregates flight & hotel estimates)
    Agents-->>LG: Optimal allocations & feasibility index

    LG->>Agents: Invoke ItineraryAgent (synthesizes travel guides)
    Agents-->>LG: Chronological day events

    LG->>Agents: Invoke FinalPlannerAgent (assembles reports)
    Agents->>DB: Save generated trip, itineraries & logs
    Agents-->>LG: Compiled plan document JSON
    
    LG-->>API: Graph completes
    API-->>Client: 200 OK (Returns Trip JSON)
```

---

## 🛠️ Technology Stack

### Backend
* **Language:** Python 3.10+
* **Framework:** FastAPI 0.110+ (Asynchronous ASGI)
* **Agent Orchestration:** LangGraph 0.2+ (State Graphs & parallel routing)
* **LLM Engine:** Google Gemini (2.0 Flash / 1.5 Pro) with fallback routing to Groq (Llama 3.3)
* **Vector Store:** FAISS (for memory semantic search)
* **Database ORM:** SQLAlchemy 2.0 (asyncpg backend)
* **Migrations:** Alembic

### Frontend
* **Core:** Next.js 15 (App Router, React Server Components)
* **Language:** TypeScript
* **Styling:** Tailwind CSS + Framer Motion (for smooth micro-animations)

### Infrastructure & Operations
* **Primary DB:** PostgreSQL 16 (Neon Serverless)
* **Cache & Rate Limiter:** Redis (Upstash)
* **Hosting:** AWS EC2 (Backend API container) + Vercel (Frontend app)
* **Networking:** Nginx (Reverse proxy & SSL termination)
* **Containerization:** Docker & Docker Compose

---

## 📁 Directory Structure

```
Trip_Planner/
├── backend/
│   ├── app/
│   │   ├── agents/                    # Multi-Agent systems
│   │   │   ├── travel_intelligence/   # Vlog Intelligence Graph
│   │   │   │   ├── state.py           # Shared vlog state schemas
│   │   │   │   ├── llm_gateway.py     # Resilient API key failover
│   │   │   │   ├── youtube_utils.py   # Caption fetcher & transcript clean
│   │   │   │   ├── graph.py           # LangGraph StateGraph instance
│   │   │   │   └── nodes/             # 8 vlog agent files
│   │   │   ├── orchestrator.py        # Traditional LangGraph controller
│   │   │   ├── understanding.py       # Intake / user intent node
│   │   │   ├── planner.py             # Route coordinator node
│   │   │   ├── weather.py             # Weather agent node
│   │   │   ├── transport.py           # Flights / routes node
│   │   │   ├── accommodation.py       # Hotels recommendation node
│   │   │   ├── recommendation.py      # Food & activities node
│   │   │   ├── itinerary.py           # Day planner node
│   │   │   ├── budget.py              # Financial checker node
│   │   │   └── memory.py              # Long-term preference writer
│   │   ├── api/v1/endpoints/          # REST API endpoints
│   │   │   ├── auth.py                # Registration / JWT Auth
│   │   │   ├── orchestrator.py        # Main plan route
│   │   │   ├── travel_intelligence.py  # Vlog plan route
│   │   │   ├── trips.py               # Trips management & replanning
│   │   │   ├── memory.py              # User preferences endpoint
│   │   │   └── tools.py               # MCP control gate
│   │   ├── core/                      # Config files & database sessions
│   │   ├── models/                    # SQLAlchemy database tables
│   │   └── schemas/                   # Pydantic validation structures
│   ├── alembic/                       # Migration files
│   └── docs/                          # Detailed architecture markdown
├── frontend/
│   ├── src/
│   │   ├── app/                       # Next.js app routing
│   │   └── components/                # Modular React widgets
│   └── package.json
├── docker/                            # Production/Dev Docker configurations
├── docker-compose.yml                 # Local cluster setup
└── README.md                          # Main project documentation
```

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/Akash7367/Trip_planer_Ai.git
cd Trip_planer_Ai
```

### 2. Configure Environment Variables
Create a `.env` file in `backend/` and `frontend/` directories from the provided templates.

#### Backend `.env`
```env
DATABASE_URL=postgresql://user:password@host/dbname
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_groq_or_openai_key
SECRET_KEY=your_512bit_secret_key
ALGORITHM=HS256
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
UNSPLASH_ACCESS_KEY=your_unsplash_key
```

### 3. Spin Up Services Using Docker Compose (Recommended)
This starts the backend API, the frontend web application, and local Redis/PostgreSQL instances.
```bash
docker-compose up --build
```
* **Frontend:** `http://localhost:3000`
* **Backend API Docs:** `http://localhost:8005/docs`

---

## 📡 API Reference Example

Detailed OpenAPI docs are rendered at `/docs` when the API is running.

### Create Vlog-Grounded Trip Plan
* **Method:** `POST`
* **Endpoint:** `/api/v1/orchestrator/travel-intelligence`
* **Headers:** `Content-Type: application/json`

**Sample Payload:**
```json
{
  "query": "Plan a 5-day Goa trip, beaches and local food, budget ₹25,000",
  "days": 5,
  "budget": 25000,
  "source_city": "Mumbai",
  "people": 1
}
```

**Response Format:**
```json
{
  "trip_id": "8f8b056e-8260-449e-b9b5-6f6eb8b7c7b2",
  "title": "5-Day Vlog-Verified Goa Adventure",
  "confidence_score": 0.96,
  "sources": [
    {
      "video_id": "dQw4w9WgXcQ",
      "vlogger": "TheSocialTraveller",
      "timestamp": "04:12"
    }
  ],
  "daily_itinerary": [
    {
      "day": 1,
      "morning": "Arrival at Mopa airport, take public bus (₹150) instead of airport taxi (₹1200) [Source: @TheSocialTraveller]",
      "afternoon": "Check in to Zostel Palolem (₹600/night)",
      "evening": "Walk around Palolem beach, dinner at Café Inn (Fish thali for ₹180)"
    }
  ],
  "scam_alerts": [
    "Taxi touts at Mopa airport charging 4x prices — use public electric buses parked outside."
  ]
}
```

---

## 📊 Benchmarks & Performance Metrics

Produced by `python -m evals.run_eval` (`backend/evals/`) over 10 benchmark cases
spanning ordinary, tight-but-repairable, genuinely infeasible, and adversarial inputs.
Reproduce it yourself — these are the harness's actual output, not estimates.

| Metric | Cold POI cache | Warm POI cache |
|---|---|---|
| Cases run / crashes | 10 / **0** | 10 / **0** |
| Verifier agreed with expected outcome | **6/6** | **6/6** |
| Mean plan latency | 59.15 s | **0.00 s** |
| p95 plan latency | 87.19 s | **0.01 s** |
| Cases needing repair | 3/10 | 3/10 |
| Mean repair iterations | 0.30 | 0.30 |
| Cases with scheduled stops | 5/10 | 5/10 |
| Stops scheduled / grounded in a real source | **33 / 33** | 33 / 33 |
| Backend tests | **95 passing** | — |

Reported as fractions rather than percentages on purpose: ten cases is far too small a
sample for "100%" to mean what it looks like.

**Latency is dominated by cold Overpass lookups** (60–100 s for a city not seen before);
cached lookups are effectively free for 24h. Only the warm column describes steady
state, and only the cold column describes a first-time visitor to a new city — neither
alone is "the" latency.

**Two things the numbers do not say.** Only 5/10 cases schedule stops, because some
destinations genuinely have no Wikidata-linked POIs in OpenStreetMap — those cases
correctly return empty with a warning rather than inventing places. And the ranking is
weak: every linked POI scores 4.0–4.5 on the notability proxy, so ties break
alphabetically and the [sample Kyoto itinerary](docs/samples/kyoto-3day-real-itinerary.md)
is all early-alphabet temples while Kinkaku-ji sits unselected in the candidate pool.
That is a real limitation, not a rounding detail.

### Parallel research fan-out

Weather, transport, accommodation and POI retrieval are independent given a destination,
so they run concurrently and converge before the scheduler. Measured with
`python -m evals.bench_parallel`, which builds a sequential-edge variant of the real
graph and runs both over the same request:

| Scenario | Sequential | Parallel | Speedup |
|---|---|---|---|
| Cold POI cache | 257.48 s | **75.91 s** | **3.39x** |
| Warm POI cache (median of 3) | 0.01 s | 0.01 s | 0.93x |

Both rows are worth reading. The cold speedup is real in mechanism — a 60–100s POI
lookup now overlaps the other research calls instead of following them — but it is one
run each and 257 s exceeds what those nodes should sum to, so that run likely also hit
an Overpass retry. Do not quote "3.39x" as precise. The warm row at **0.93x** is the
honest counterpart: with everything cached there is nothing to overlap and the fan-out
costs slight dispatch overhead.

**Sample output:** [docs/samples/kyoto-3day-real-itinerary.md](docs/samples/kyoto-3day-real-itinerary.md)
— a real 3-day Kyoto plan, every stop from live OpenStreetMap data with source
attribution, generated with no LLM key configured.

---

## 👨‍💻 Credits

This is a **fork**, and the split of work is worth being precise about.

**Original project — [Akash Kumar (@Akash7367)](https://github.com/Akash7367)**
([upstream repo](https://github.com/Akash7367/Trip_planer_Ai)). The Next.js frontend,
FastAPI scaffolding, authentication, data models, and the initial domain agents are his
work.

**This fork — [Rohit Shetty (@shettyrohit0810)](https://github.com/shettyrohit0810).**
Rebuilt the planning core:

- **Deterministic scheduling core** — knapsack selection under a budget ceiling with
  travel-time-aware ordering, plus property-based tests that caught a real
  budget-soundness bug (sub-cent costs quantizing to zero and being treated as free).
- **Hard-constraint verifier and bounded repair loop** — the first genuine cycle in the
  graph; the LLM can no longer decide the itinerary, only narrate it.
- **Grounding enforcement** — every scheduled stop must carry a source attribution or
  fail verification; tools return empty results rather than fabricating places.
- **Security lockdown** — removed an unauthenticated remote-code-execution endpoint and
  added auth plus ownership checks across every resource route.
- **Schema ownership** — replaced `create_all()` with real Alembic migrations.
- **Removed fabricated UI** — dashboards that displayed invented figures and a
  hardcoded "94% confidence score" now render real data or an honest empty state.

See [DECISIONS.md](DECISIONS.md) for the full engineering log, including bugs found and
scope deliberately cut.
