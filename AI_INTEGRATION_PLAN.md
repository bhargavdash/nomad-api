# AI Integration Plan — Nomad

> **Author:** Claude (architect) for Bhargav
> **Date:** 2026-05-09 (revised from earlier draft)
> **Status:** Polyglot split confirmed. Multi-agent from day one. Model-agnostic stack.

---

## TL;DR

- **Architecture:** Polyglot split. Node `nomad-api` keeps auth/CRUD/polling. New Python `nomad-agent` (FastAPI) owns the agentic pipeline. Both write to the same Supabase DB.
- **Framework:** **LangGraph** (Python). Chosen because the model layer is fully swappable — every provider you mentioned (OpenAI, Anthropic, Llama via Groq/Together, Qwen, Kimi via OpenAI-compatible APIs, plus Gemini) is a one-line config change. ADK was the runner-up but is Gemini-leaning by design.
- **Agents:** 4 of them — `YouTubeShortsAgent`, `RedditAgent`, `GoogleBlogAgent`, plus `SynthesizerAgent` orchestrating the final itinerary.
- **YouTube focus:** Shorts only. Long-form vlogs are over-produced; Shorts capture "I just walked into this place" authenticity. We aggregate Shorts metadata across 20-30 results per query, weight by repeat mentions, and extract place signals via LLM.
- **Signal extraction layer:** Trip params → derived signals (season, festival, crowd-level, budget tier, vibe weights) → tailored search queries per agent. This is the personalization layer a single LLM call cannot replicate.
- **Contract:** Node fires-and-forgets `POST /agent/research` to Python. Python writes ItineraryDay/Stop to Supabase and updates ResearchJob status. Frontend polling is unchanged.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Native app  (unchanged)                              │
└────────────┬────────────────────────────────────────────────┘
             │ POST /trips, GET /trips/:id/research, GET /full
             ▼
┌─────────────────────────────────────────────────────────────┐
│  nomad-api  (Node + Express, what you have today)           │
│  • Auth, profile, trips CRUD, polling endpoint              │
│  • Worker becomes a thin forwarder:                         │
│      1. create Trip + ResearchJob in DB                     │
│      2. POST → nomad-agent /agent/research                  │
│      3. return 201 to client                                │
└────────────┬────────────────────────────────────────────────┘
             │ HTTP, fire-and-forget (returns 202 Accepted)
             ▼
┌─────────────────────────────────────────────────────────────┐
│  nomad-agent  (Python + FastAPI + LangGraph)                │
│                                                             │
│  POST /agent/research { tripId, tripParams }                │
│    │                                                        │
│    ├─ SignalExtractor (pure Python, no LLM)                 │
│    │  → derives: season, festival, crowd, vibeWeights, etc. │
│    │                                                        │
│    ├─ LangGraph multi-agent run:                            │
│    │   ┌──────────────────┐                                 │
│    │   │ Run in parallel: │                                 │
│    │   │  YouTubeShorts   │──┐                              │
│    │   │  Reddit          │──┼─→ ResearchDiscovery[]        │
│    │   │  GoogleBlog      │──┘                              │
│    │   └──────────────────┘                                 │
│    │   then sequentially:                                   │
│    │   Synthesizer  ←  all discoveries + signals + params   │
│    │                  →  Final ItineraryDays + Stops        │
│    │                                                        │
│    └─ Writes results directly to Supabase via supabase-py   │
│       Updates ResearchJob status/phase/progress as it runs  │
└─────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                          ┌────────────────┐
                          │  Supabase DB   │
                          └────────────────┘
```

The Node service has zero AI logic. The Python service has zero auth or CRUD logic. The boundary is one HTTP call + a shared database.

---

## 2. Why LangGraph (and not ADK or others)

You explicitly do not want to be locked into Gemini. That single constraint decides the framework.

| | LangGraph | Google ADK | PydanticAI | CrewAI |
|---|---|---|---|---|
| Model-agnostic | ✅ Native, every provider has a langchain-* package | ⚠️ Possible via LiteLLM but Gemini-leaning by design | ✅ Native | ✅ Via wrappers |
| Switch model = 1 line | ✅ `ChatOpenAI()` ↔ `ChatAnthropic()` ↔ `ChatGroq()` ↔ `ChatGoogleGenerativeAI()` | ⚠️ Gemini default, others via custom adapter | ✅ | ✅ |
| Multi-agent first-class | ✅ Graph nodes = agents | ✅ Sub-agent pattern | ✅ Delegation pattern | ✅ Crew pattern |
| Stateful workflow control | ✅ Best in class | Good | Decent | Limited |
| Production maturity | ✅ Most mature | New (2025) | Newer | Mid |
| Observability | LangSmith (excellent) | Vertex AI built-in | OpenTelemetry | Built-in basic |
| Examples for "research → synthesis" | Hundreds | Few | Growing | Some |

**Verdict: LangGraph.** It treats "which model" as an injection point. Today's `ChatGroq(model="llama-3.3-70b-versatile")` for the YouTubeAgent becomes `ChatAnthropic(model="claude-sonnet-4-6")` tomorrow with no other code change. ADK assumes Gemini until proven otherwise.

**Provider mapping (all swappable in LangGraph):**
- Gemini → `langchain-google-genai`
- OpenAI → `langchain-openai`
- Anthropic → `langchain-anthropic`
- Groq (Llama 3.3, Mixtral) → `langchain-groq` ← free, fast, recommended for dev
- Together AI (Qwen, Llama, Mistral) → `langchain-together`
- Kimi / Moonshot → uses OpenAI-compatible API, so `langchain-openai` with custom `base_url`
- Local (Ollama, llama.cpp) → `langchain-ollama`

You can mix models per agent. YouTubeAgent uses cheap fast Groq Llama. Synthesizer uses higher-quality Anthropic Claude. Switch at any time via env vars.

---

## 3. The Signal Extraction Layer

This is the part that makes the project actually personalized. Pure Python, no LLM. Runs before any agent.

```python
# nomad-agent/app/signals.py

from datetime import date
from dataclasses import dataclass

@dataclass
class TravelSignals:
    season: str                  # "winter" | "spring" | "summer" | "monsoon" | "autumn"
    is_festival_window: bool
    festival_name: str | None
    crowd_level: str             # "low" | "moderate" | "peak"
    weather_hint: str | None     # "monsoon-flooding-risk", "snow-pass-closures", etc.
    budget_tier: str             # "shoestring" | "mid" | "premium" | "luxury"
    pace_density: int            # stops per day: 3 | 4 | 5
    vibe_source_weights: dict    # {"reddit": 0.5, "youtube": 0.3, "blog": 0.2}
    query_modifiers: list[str]   # extra keywords for search queries

def extract_signals(trip_params) -> TravelSignals:
    """
    Pure transformation from trip parameters to derived signals.
    No LLM call. Deterministic.
    """
    # Example logic (real implementation per destination):

    month = date.fromisoformat(trip_params.date_from).month if trip_params.date_from else None
    destination_lower = trip_params.destination.lower()

    # Season inference (rough — refine per region)
    if month in (6, 7, 8, 9) and any(k in destination_lower for k in ["india", "goa", "kerala", "mumbai"]):
        season = "monsoon"
        weather_hint = "monsoon-flooding-risk"
        query_modifiers = ["monsoon", "indoor activities", "waterfalls"]
    elif month in (12, 1, 2):
        season = "winter"
        if "ladakh" in destination_lower:
            weather_hint = "snow-pass-closures"
        query_modifiers = ["winter", "cozy"]
    # ... etc

    # Festival window detection
    is_festival = False
    festival_name = None
    if month == 10 and "jaipur" in destination_lower:
        is_festival = True
        festival_name = "Diwali"
        query_modifiers.append("Diwali")
    # ... lookup table for major festivals × destinations

    # Crowd level
    crowd_level = "peak" if month in (12, 1) and any(k in destination_lower for k in ["goa", "kerala", "rajasthan"]) else "moderate"

    # Budget tier
    budget_tier = {"$": "shoestring", "$$": "mid", "$$$": "premium", "$$$$": "luxury"}[trip_params.budget]

    # Pace density
    pace_density = {"Slow & Soulful": 3, "Balanced": 4, "Action-Packed": 5}[trip_params.pace]

    # Vibe → source weighting (which agent's findings should get priority)
    vibe_source_weights = {"reddit": 0.34, "youtube": 0.33, "blog": 0.33}  # default
    if "hidden gems" in trip_params.vibes or "off the beaten path" in trip_params.vibes:
        vibe_source_weights = {"reddit": 0.5, "youtube": 0.4, "blog": 0.1}
    elif "iconic" in trip_params.vibes or "first time" in trip_params.vibes:
        vibe_source_weights = {"reddit": 0.2, "youtube": 0.3, "blog": 0.5}

    return TravelSignals(...)
```

This object becomes input to every agent. The YouTubeAgent uses `query_modifiers` to shape its search query. The Synthesizer uses `vibe_source_weights` to bias which discoveries dominate the final itinerary.

**Future extension:** This file becomes a lookup table loaded from a YAML or JSON of (destination × month → signals). Easy to expand without touching agent code.

---

## 4. The Four Agents

### 4.1 YouTubeShortsAgent

**Tool:** YouTube Data API v3 (free, 10K quota units/day = ~100 search calls/day)

**Strategy:**
1. Build query from `destination + signals.query_modifiers + vibe-derived keywords`
2. Call `search.list` with `videoDuration=short` (returns videos under 4 min, includes Shorts)
3. Take top 25 results, call `videos.list` with their IDs to get full duration in `contentDetails.duration` (ISO 8601 like `PT47S`)
4. **Filter to true Shorts: duration < 60 seconds**
5. Optionally fetch auto-captions via `youtube-transcript-api` (Python package, free) — many Shorts don't have them, that's fine
6. Aggregate signal: place names appearing in 3+ Shorts titles get a "trending" boost
7. Send aggregated metadata + transcripts to LLM with extraction prompt

**Why Shorts specifically:**
- Long-form YouTube travel content is heavily produced — sponsorships, scripted intros, listicles. The places shown are filtered through a content-strategy lens.
- Shorts are usually shot in-the-moment by individual creators. The hook is "you have to come here". That's the authenticity signal you want.
- Shorts titles are aggressive and specific by necessity (algorithm rewards specificity). "This ₹50 chai stall in Jodhpur is INSANE" beats a 15-min vlog titled "5 days in Rajasthan".
- Cross-Short aggregation is gold: if 6 different small creators all made Shorts about the same hidden café, that's a stronger signal than one big vlogger covering it once.

**Quality multipliers:**
- **Channel filter:** keep only channels with ≥ 1k subs and ≥ 5 travel-tagged Shorts (filters out spam/AI farms)
- **Recency boost:** prefer Shorts from last 12 months
- **View-velocity proxy:** view count / days since publish
- **Repeat-mention dedup:** same place mentioned in N Shorts → boost confidence

**Prompt (shape):**
```
You are extracting place recommendations from YouTube Shorts metadata.

Context:
- Destination: {destination}
- Travel signals: {signals.season}, budget {signals.budget_tier}, pace {signals.pace}
- User vibes: {vibes}

Below are titles, descriptions, channel names, view counts, and (where
available) auto-generated transcripts of {N} YouTube Shorts. The Shorts
were filtered to <60s, recent (last 12 months), from established travel
creators.

Your task: extract 4-6 specific recommendations. For each:
- Identify the proper noun (restaurant/spot/neighborhood). Skip generic
  recommendations like "the local market" — name something specific or omit.
- If multiple Shorts mention the same place, weight that as higher confidence
  and call it out in the body ("appeared in 4 different vlogs").
- Match the destination's signals: in monsoon season, prioritize indoor/
  weather-resilient picks; for $$$$ budget, skip street food.

Output strict JSON: {"discoveries": [{"id": "yt-1", "title": "...", "body": "...", "tags": [...], "source": "youtube"}]}
```

**LLM choice for this agent:** Default to Groq Llama 3.3 70B (free, fast, 14k tok/min). Quality is plenty for metadata extraction; you don't need flagship models here.

---

### 4.2 RedditAgent

**Tool:** Reddit's public JSON endpoints, no auth (60 req/min limit)

**Strategy:**
1. Identify candidate subreddits via lookup: `r/travel`, `r/{destination}` (e.g. `r/india`), `r/{destination_city}` if exists, plus general `r/solotravel` / `r/backpacking`
2. For each subreddit, hit `https://www.reddit.com/r/{sub}/search.json?q={destination}+tips+OR+gems&restrict_sr=on&sort=top&t=year&limit=15`
3. For top 5-10 posts, fetch comments: `https://www.reddit.com/r/{sub}/comments/{id}.json?sort=top&limit=20`
4. Concatenate post body + top 10 comments per post
5. Send to LLM for extraction

**Important header:**
```python
headers = {"User-Agent": "nomad-agent/0.1 (https://github.com/yourname/nomad)"}
```
Reddit blocks default Python User-Agents. This is non-optional.

**Prompt (shape):**
```
You are extracting traveler insights from Reddit threads.

Context:
- Destination: {destination}
- Signals: monsoon season, mid-range budget, balanced pace
- User wants: {vibes}

Below are {N} Reddit posts and their top comments about {destination}.

Extract 3-5 specific, insider recommendations. Reddit's strength is contrarian
takes and warnings — actively look for:
- "Skip X, go to Y instead" patterns
- "Avoid this scam"
- Locals correcting outdated guidebook recommendations
- Specific neighborhoods or hours that locals mention

Skip vague advice. Each discovery must reference a specific named place,
person, or piece of timing.

Output: {"discoveries": [{"id": "rd-1", ...}]}
```

**LLM choice:** Same as YouTube — Groq Llama is fine. Switch to Anthropic Claude if extraction quality is poor (Reddit threads are messier than Shorts metadata).

---

### 4.3 GoogleBlogAgent

**Tool:** Tavily Search API (free 1000 queries/month, built for AI agents) — **not** Gemini grounding (we're staying model-agnostic)

Why Tavily:
- Free tier large enough for dev
- Returns LLM-ready summaries, not raw HTML
- LangChain integration: `TavilySearchResults` tool
- No vendor lock-in (alternative: Brave Search API, also free)

**Strategy:**
1. Query: `"best places ${destination} ${signals.season} ${vibes_keywords}" -tripadvisor.com -reddit.com` (exclude already-covered sources)
2. Tavily returns top 5 articles with summaries
3. Send summaries to LLM for extraction

**Prompt (shape):**
```
You are extracting recommendations from travel blog summaries.

Below are {N} summaries of recent travel blog articles for {destination}.

Travel blogs are best at:
- Curated lists with reasoning ("the 7 best cafés...")
- Historical/cultural context ("why this temple matters")
- Logistics and itinerary suggestions

Extract 3-5 well-substantiated recommendations. Each must be a specific
named place. Tag with source "blog" unless the recommendation is
specifically a Google Maps top-rated tourist anchor — then use "maps".

Output: {"discoveries": [{"id": "gg-1", ...}]}
```

---

### 4.4 SynthesizerAgent

**Tool:** No external tool — pure LLM reasoning over collected discoveries.

**Strategy:**
1. Receives: trip params, signals, all discoveries from all 3 research agents
2. Plans the day-by-day shape (which days in which city if multi-city)
3. Slots discoveries into days based on:
   - Signal matching (e.g., outdoor in pleasant weather, indoor in monsoon)
   - Source weighting from `signals.vibe_source_weights`
   - Pace density from `signals.pace_density`
4. Fills any gaps with sensible standard anchors (museum, viewpoint, etc.) tagged `source: "maps"`
5. Generates day titles, descriptions, highlights, stop times, durations, and the `tags` emoji array per stop
6. Outputs the final structured itinerary matching the Pydantic schema

**LLM choice:** This is where you spend on quality. Default to a flagship model — Anthropic Claude Sonnet 4.6 if you have an API key, otherwise Groq Llama 3.3 70B (free) is acceptable. Switch via env var.

**Prompt:** Same 12-rule prompt from the previous draft (specific names, real times, pace-aware density, source tagging, etc.) — but with the addition: "**Most stops should reference a discovery from the research findings. If a discovery is repeated across sources, prioritize it. If a stop has no backing discovery, mark it as `source: maps` and label it as a 'standard anchor'.**"

---

## 5. Pydantic Schemas (Mirrors Zod on Node side)

`nomad-agent/app/schemas.py`:

```python
from pydantic import BaseModel, Field
from typing import Literal

SourceType = Literal["youtube", "reddit", "blog", "maps"]

class TripParams(BaseModel):
    """Input from Node side."""
    trip_id: str
    user_id: str
    destination: str
    date_from: str | None = None
    date_to: str | None = None
    duration_days: int = 7
    travelers: Literal["1", "2", "3+", "large"] = "2"
    vibes: list[str] = Field(default_factory=list)
    accommodation: str = "Hotel"
    pace: Literal["Slow & Soulful", "Balanced", "Action-Packed"] = "Balanced"
    budget: Literal["$", "$$", "$$$", "$$$$"] = "$$"
    preferences: str | None = None

class ResearchDiscovery(BaseModel):
    id: str
    title: str = Field(..., min_length=1)
    body: str = Field(..., min_length=1)
    tags: list[str] = Field(..., min_length=1, max_length=3)
    source: SourceType

class AIStop(BaseModel):
    sortOrder: int = Field(..., ge=1)
    time: str = Field(..., pattern=r"^\d{1,2}:\d{2}$")
    ampm: Literal["AM", "PM"]
    duration: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    source: SourceType
    tags: list[str] = Field(..., min_length=1, max_length=4)

class AIDay(BaseModel):
    dayNumber: int = Field(..., ge=1)
    city: str
    title: str
    description: str
    highlights: list[str] = Field(..., min_length=2, max_length=5)
    stops: list[AIStop] = Field(..., min_length=3, max_length=6)

class AIItinerary(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=4)
    stats_places: int
    stats_tips: int
    stats_photo_stops: int
    discoveries: list[ResearchDiscovery] = Field(..., min_length=3, max_length=12)
    days: list[AIDay] = Field(..., min_length=1)
```

Field names match Prisma columns where possible (camelCase on stops/days for direct write compatibility; snake_case on stats since those mirror DB columns).

---

## 6. Node ↔ Python Contract

### What Node sends (fire-and-forget):

```http
POST http://localhost:8000/agent/research
Authorization: Bearer <internal_shared_secret>   # not user JWT
Content-Type: application/json

{
  "trip_id": "uuid",
  "user_id": "uuid",
  "destination": "Goa, India",
  "date_from": "2026-06-15",
  "date_to": "2026-06-22",
  "duration_days": 7,
  "travelers": "2",
  "vibes": ["beaches", "hidden gems", "street food"],
  "accommodation": "Boutique Villa",
  "pace": "Balanced",
  "budget": "$$",
  "preferences": null
}
```

Python responds `202 Accepted` immediately and runs the pipeline in a background task.

### What Python writes to Supabase:

While running:
- Updates `research_jobs.phase`, `progress`, `message`, `discoveries` after each agent completes (3 progress updates: youtube done, reddit done, google done)
- Updates `research_jobs.status` from `'pending'` → `'researching'` → `'building'` → `'completed'` (or `'failed'`)

At completion:
- Inserts `itinerary_days` rows (one per day)
- Inserts `stops` rows (one per stop, all days)
- Updates `trips.status = 'ready'`, `trips.emoji`, `trips.stats_*`

### Internal auth between Node and Python:

Use a shared secret in env (`INTERNAL_AGENT_SECRET`). Node sends it in `Authorization`. Python checks it. This is fine for now — both services are private. Migrate to mTLS or a service mesh only if you ever expose Python publicly.

---

## 7. Project Structure (`nomad-agent`)

```
nomad-agent/
├── pyproject.toml                    # uv or poetry-managed
├── .env.example
├── .gitignore
├── README.md
├── docker-compose.yml                # optional, for local Supabase Postgres if you want
├── Dockerfile                        # for deployment later
│
├── app/
│   ├── __init__.py
│   ├── main.py                       # FastAPI entrypoint
│   ├── config.py                     # env var loader (pydantic-settings)
│   ├── auth.py                       # internal secret check middleware
│   │
│   ├── schemas.py                    # Pydantic models (mirrors of Zod schemas)
│   ├── signals.py                    # SignalExtractor — pure Python, no LLM
│   │
│   ├── llm/
│   │   ├── __init__.py
│   │   └── factory.py                # get_llm("youtube_agent") → returns ChatOpenAI/Groq/Anthropic etc. based on env
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── base.py                   # shared utilities (retry, JSON parsing, validation)
│   │   ├── youtube_shorts.py
│   │   ├── reddit.py
│   │   ├── google_blog.py
│   │   └── synthesizer.py
│   │
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── youtube.py                # YouTube Data API v3 wrapper
│   │   ├── reddit.py                 # Reddit JSON wrapper
│   │   └── tavily.py                 # Tavily search wrapper (or langchain_community)
│   │
│   ├── graph/
│   │   ├── __init__.py
│   │   └── pipeline.py               # LangGraph state machine: parallel research → synthesis
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   └── supabase_writer.py        # Supabase client + write functions (research_jobs, days, stops)
│   │
│   └── routes/
│       ├── __init__.py
│       └── research.py               # POST /agent/research, GET /agent/health
│
├── tests/
│   ├── test_signals.py               # pure unit tests, no LLM calls
│   ├── test_schemas.py
│   └── fixtures/
│       └── sample_trip.json
│
└── scripts/
    ├── run_agent_locally.py          # runs the full pipeline against a test trip — no FastAPI
    └── test_youtube_tool.py          # standalone test of YouTube API integration
```

---

## 8. Bootstrap Prompt for Claude Code

Copy-paste this into a fresh Claude Code session in your `code` folder. It will scaffold the project end-to-end. Read it once before running so you know what it does and doesn't do (it stops short of implementing real agent logic — that's the next, smaller, iterative session).

````
I want you to scaffold a new Python project called `nomad-agent` at
`C:\Users\DELL\code\nomad-agent`. It is the agentic AI service for the
Nomad travel itinerary app. The project plan and full architecture lives at
`C:\Users\DELL\code\nomad-api\AI_INTEGRATION_PLAN.md` — read that file
first, completely, before doing anything else. Confirm you have read it
before scaffolding.

Then:

1. Create the directory structure exactly as specified in section 7 of
   the plan ("Project Structure"). Create empty `__init__.py` files in
   every Python package directory.

2. Initialize as a `uv`-managed Python project. Use Python 3.12.
   `pyproject.toml` should declare these dependencies:
   - fastapi
   - uvicorn[standard]
   - pydantic >= 2.0
   - pydantic-settings
   - langgraph
   - langchain-core
   - langchain-openai
   - langchain-anthropic
   - langchain-google-genai
   - langchain-groq
   - langchain-community            # for Tavily
   - supabase                        # supabase-py
   - httpx
   - google-api-python-client        # YouTube Data API v3
   - youtube-transcript-api          # for Shorts captions when available
   - tavily-python                   # web search
   - python-dotenv
   - tenacity                        # retry helpers

   Dev dependencies:
   - pytest
   - pytest-asyncio
   - ruff
   - mypy

3. Write `app/schemas.py` with the Pydantic models exactly as defined
   in section 5 of the plan ("Pydantic Schemas"). Do not modify the
   field names.

4. Write `app/config.py` using `pydantic-settings.BaseSettings`. Load
   these env vars (all optional with sensible defaults except where noted):
   - DATABASE_URL                          (required)
   - SUPABASE_URL                          (required)
   - SUPABASE_SERVICE_ROLE_KEY             (required)
   - INTERNAL_AGENT_SECRET                 (required)
   - YOUTUBE_API_KEY                       (required for YT agent)
   - TAVILY_API_KEY                        (required for Google agent)
   - LLM_YOUTUBE_PROVIDER  default "groq"
   - LLM_YOUTUBE_MODEL     default "llama-3.3-70b-versatile"
   - LLM_REDDIT_PROVIDER   default "groq"
   - LLM_REDDIT_MODEL      default "llama-3.3-70b-versatile"
   - LLM_GOOGLE_PROVIDER   default "groq"
   - LLM_GOOGLE_MODEL      default "llama-3.3-70b-versatile"
   - LLM_SYNTH_PROVIDER    default "anthropic"
   - LLM_SYNTH_MODEL       default "claude-sonnet-4-6"
   - GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY,
     TOGETHER_API_KEY      (each optional — required only if used)

5. Write `app/llm/factory.py` exporting one function:
       def get_llm(role: str) -> BaseChatModel
   `role` is one of "youtube_agent" | "reddit_agent" | "google_agent" |
   "synthesizer". Reads provider/model from config based on role and
   returns the right LangChain chat model:
   - "groq"      -> ChatGroq
   - "openai"    -> ChatOpenAI
   - "anthropic" -> ChatAnthropic
   - "google"    -> ChatGoogleGenerativeAI
   - "together"  -> ChatOpenAI with base_url="https://api.together.xyz/v1"
   - "kimi"      -> ChatOpenAI with base_url="https://api.moonshot.cn/v1"

6. Write `app/signals.py` with a single function
   `extract_signals(trip_params: TripParams) -> TravelSignals`
   matching section 3 of the plan. Implement the basic version with
   season inference for India/SE Asia, festival detection for Diwali
   only (placeholder), and the budget/pace/vibe mappings.
   Add a TODO comment block listing other destinations and festivals
   to add later.

7. Write `app/db/supabase_writer.py` with these async functions
   (use the `supabase` Python client):
   - `update_research_job(trip_id, **fields) -> None`
   - `write_itinerary(trip_id, itinerary: AIItinerary) -> None`
        — writes ItineraryDay rows and Stop rows
   - `mark_trip_ready(trip_id, emoji, stats) -> None`
   - `mark_trip_failed(trip_id, error_message) -> None`

8. Write `app/agents/` files as STUBS. Each agent file has:
   - A class or function signature matching the agent's job
   - A docstring explaining the strategy from the plan
   - A `# TODO: implement` block with the strategy steps as comments
   - A return statement returning an empty list (so imports work)

9. Write `app/graph/pipeline.py` with the LangGraph state machine
   skeleton. Define a `PipelineState` TypedDict with fields:
   trip_params, signals, yt_discoveries, reddit_discoveries,
   google_discoveries, all_discoveries, itinerary, error.
   Build the graph: 3 parallel nodes → merge node → synthesizer node.
   Wire the nodes to call the (stub) agent functions. Don't implement
   the agents — just wire the graph. Confirm it compiles by running
   `graph.compile()`.

10. Write `app/routes/research.py` with `POST /agent/research` that:
    - Verifies the INTERNAL_AGENT_SECRET in Authorization header
    - Validates body against TripParams schema
    - Triggers the LangGraph pipeline as a background task
      (FastAPI's BackgroundTasks)
    - Returns 202 Accepted immediately

11. Write `app/main.py` to wire FastAPI: register the research route,
    add CORS, add a `GET /agent/health` endpoint.

12. Write `scripts/run_agent_locally.py` — a CLI entry that loads
    `tests/fixtures/sample_trip.json`, runs the LangGraph pipeline
    end-to-end, prints the result. This bypasses FastAPI for fast
    iteration.

13. Write `tests/fixtures/sample_trip.json` with a realistic Goa-monsoon
    test case (June 2026, 7 days, 2 travelers, $$, Balanced pace,
    vibes ["beaches", "hidden gems", "street food"]).

14. Write `tests/test_signals.py` with 3 unit tests:
    - Goa in June produces season="monsoon"
    - Jaipur in late October produces is_festival_window=True
    - Pace="Slow & Soulful" produces pace_density=3

15. Write `tests/test_schemas.py` ensuring TripParams and AIItinerary
    accept and reject correct/incorrect payloads.

16. Write `.env.example` listing every env var from step 4 with
    placeholder values.

17. Write `README.md` with sections:
    - What this is
    - Local setup (uv install, env vars, run with uvicorn)
    - Running the local script (scripts/run_agent_locally.py)
    - Running tests
    - Project structure
    Link back to AI_INTEGRATION_PLAN.md in the nomad-api repo.

18. Run `uv sync` and `uv run pytest tests/test_schemas.py
    tests/test_signals.py` to verify the scaffold works. Tests should
    pass since signals.py and schemas.py are implemented; agent stubs
    are not yet tested.

DO NOT IMPLEMENT THE AGENT LOGIC. The four agents (YouTubeShorts, Reddit,
GoogleBlog, Synthesizer) should be stubs returning empty lists or a
hardcoded sample AIItinerary. Implementing the real LLM calls is the
next session, not this one.

When done, give me a summary of:
- Every file created
- Test results
- The exact commands to run the agent locally (with uvicorn)
- A list of which env vars I need to set before the next session
````

That prompt is ~120 lines. Paste it into Claude Code, let it run for ~10-20 minutes, end with a working scaffold and passing tests. The next iteration session is "implement YouTubeShortsAgent for real" — small, focused, one agent at a time.

---

## 9. Sprint Plan (Revised)

**Sprint 2 (May 19–25, 13 SP) — Scaffold + first real agent**

| Task | SP |
|---|---|
| Run the bootstrap prompt → working scaffold + passing tests | 2 |
| Get YouTube Data API key + implement `tools/youtube.py` (search + filter to <60s Shorts + transcript fetch) | 2 |
| Implement `agents/youtube_shorts.py` with the prompt + LLM call + Pydantic validation | 3 |
| Implement `db/supabase_writer.py` for real (research_job updates and itinerary writes) | 2 |
| Modify Node `worker.ts` to forward to Python service (HTTP call + secret) | 2 |
| End-to-end test: real trip in app → Node → Python YouTubeAgent only → writes Day 1 with 4-5 real Shorts-derived stops | 2 |

End of Sprint 2: trip creation flows end-to-end with **real YouTube research** powering Day 1. Days 2-7 still empty (or filled with placeholder anchors). One agent live.

**Sprint 3 (May 26–Jun 1, 12 SP) — Remaining agents + synthesizer**

| Task | SP |
|---|---|
| Implement `tools/reddit.py` + `agents/reddit.py` | 3 |
| Implement `tools/tavily.py` + `agents/google_blog.py` | 2 |
| Implement `agents/synthesizer.py` (the heavy prompt) | 3 |
| Wire LangGraph parallel execution + merge | 2 |
| Tune signal extraction for 5+ destinations | 2 |

End of Sprint 3: full multi-agent pipeline producing all 7 days from real research.

**Sprint 4 (Jun 2–8) — Adventures + polish + backend housekeeping** (as before)
**Sprint 5 (Jun 9–14) — Deploy** (now: deploy two services)

---

## 10. Open Questions to Decide During Implementation

1. **Phase progress reporting from Python:** When YouTubeAgent finishes, do we update `research_jobs.phase = 1, progress = 25%`? Or hold all updates until everything is done? **Recommendation:** Update after each agent completes, so the frontend ticker reflects real progress, not fake.

2. **Should the synthesizer fail-fast or graceful-fail if 0 discoveries?** **Recommendation:** Graceful fail — synthesizer can produce a generic itinerary using just the destination + signals, with `source: maps` on every stop. Better than the user seeing an error.

3. **Caching layer:** If two users plan a Goa trip in the same week, do we re-run the agents? **Recommendation:** Not for MVP. Add Redis cache later if cost matters. Each user's trip is unique enough that cache hits will be rare anyway.

4. **Observability:** Add LangSmith from day 1? **Recommendation:** Yes, free tier is generous and the trace view will save hours when you debug bad outputs. One env var (`LANGSMITH_API_KEY`) and `LANGSMITH_TRACING=true` and you're done.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| YouTube API quota exhausted (100 searches/day) | Add daily counter; if hit, skip YT agent and use only Reddit + blog. Graceful degradation already built-in via `Promise.allSettled`-equivalent pattern in LangGraph. |
| Reddit blocks the User-Agent | Use a real-looking UA string with project URL. If still blocked, add a 1-2s sleep between requests. |
| Models hallucinate place names | The synthesizer prompt enforces "only stops backed by discoveries OR marked as `source: maps`". Real grounding via real APIs is the structural fix. |
| Synthesizer output fails Pydantic validation | Retry once with same input; if still failing, fall back to a simpler itinerary format using only top discoveries. |
| Python ↔ Node service drift | Schema Pydantic + Zod kept in two files but matched manually. Add a snapshot test that compares JSON-serialized example trips between the two services on CI. |
| Cost spirals if user uses paid models | Default config uses 100% free providers (Groq + Tavily + YT free tier). Paid models are opt-in via env. |

---

## 12. Success Criteria (Updated)

**End of Sprint 2 — one-agent live:**
1. Creating a Goa trip → YouTube agent runs → Day 1 has 4-5 stops, each citing a Short-derived discovery
2. Removing `YOUTUBE_API_KEY` → falls back to placeholder Day 1 (no crash)
3. Node ↔ Python integration tested with the real internal secret

**End of Sprint 3 — full pipeline live:**
1. Goa, Paris, Jaipur trips each produce visibly different, locally-relevant itineraries
2. Discoveries are tagged correctly across YouTube/Reddit/Blog sources
3. Signal extraction visibly affects output: Goa-June trip mentions monsoon, Jaipur-October trip mentions Diwali
4. End-to-end timing: 15-25 seconds (real research takes longer, frontend already accepts this)
5. LangSmith traces show 4 agents running, with 3 in parallel and 1 synthesizing

---

*End of plan. Ship Sprint 2 first — get one real agent in production. Don't build the whole pipeline before the simplest version is verified.*
