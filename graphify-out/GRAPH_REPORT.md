# Graph Report - .  (2026-05-28)

## Corpus Check
- Corpus is ~20,472 words - fits in a single context window. You may not need a graph.

## Summary
- 330 nodes · 529 edges · 19 communities (13 shown, 6 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core API Infrastructure|Core API Infrastructure]]
- [[_COMMUNITY_Dev Docs & Claude Agents|Dev Docs & Claude Agents]]
- [[_COMMUNITY_Data Models & Integration|Data Models & Integration]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_AI Research Pipeline|AI Research Pipeline]]
- [[_COMMUNITY_Image & Media Utilities|Image & Media Utilities]]
- [[_COMMUNITY_Dev Toolchain|Dev Toolchain]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Claude Code Hooks & Settings|Claude Code Hooks & Settings]]
- [[_COMMUNITY_Skills & MCP Config|Skills & MCP Config]]
- [[_COMMUNITY_Claude Code Automation|Claude Code Automation]]
- [[_COMMUNITY_Database Seeding|Database Seeding]]
- [[_COMMUNITY_Husky Git Hooks|Husky Git Hooks]]
- [[_COMMUNITY_Local MCP Settings|Local MCP Settings]]
- [[_COMMUNITY_MCP JSON Config|MCP JSON Config]]
- [[_COMMUNITY_Start Script|Start Script]]
- [[_COMMUNITY_Express Type Augmentation|Express Type Augmentation]]

## God Nodes (most connected - your core abstractions)
1. `prisma` - 23 edges
2. `Frontend Integration Plan` - 22 edges
3. `AI Integration Plan` - 21 edges
4. `nomad-agent supabase_writer.py` - 17 edges
5. `router` - 14 edges
6. `Nomad API Package` - 14 edges
7. `Nomad API Backend Architecture Doc` - 14 edges
8. `nomad-agent graph/pipeline.py` - 13 edges
9. `compilerOptions` - 12 edges
10. `authMiddleware()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `AIItinerary Pydantic Model` --semantically_similar_to--> `ItineraryDay Prisma Model`  [INFERRED] [semantically similar]
  AI_INTEGRATION_PLAN.md → .claude/rules/database-schema.md
- `AIStop Pydantic Model` --semantically_similar_to--> `Stop Prisma Model`  [INFERRED] [semantically similar]
  AI_INTEGRATION_PLAN.md → .claude/rules/database-schema.md
- `TripParams Pydantic Model` --semantically_similar_to--> `Trip Prisma Model`  [INFERRED] [semantically similar]
  AI_INTEGRATION_PLAN.md → .claude/rules/database-schema.md
- `Coding Standards (TS/Express/Prisma)` --references--> `Express v5 Dependency`  [EXTRACTED]
  .claude/rules/coding-standards.md → package.json
- `Coding Standards (TS/Express/Prisma)` --references--> `Zod Validation Library Dependency`  [EXTRACTED]
  .claude/rules/coding-standards.md → package.json

## Hyperedges (group relationships)
- **Polyglot Split: nomad-api + nomad-agent + Supabase DB** — service_nomad_api, service_nomad_agent, db_supabase_postgres [EXTRACTED 1.00]
- **LangGraph Multi-Agent Research Pipeline** — agent_youtube_shorts, agent_reddit, agent_google_blog, agent_synthesizer, langgraph_pipeline [EXTRACTED 1.00]
- **Trip Data Model Cascade Hierarchy** — model_profile, model_trip, model_itinerary_day, model_stop, model_research_job [EXTRACTED 1.00]
- **Auth-Guarded Route Pattern** — middleware_auth_authmiddleware, routes_auth_router, routes_profile_router, routes_research_router, routes_trips_router [EXTRACTED 1.00]
- **Prisma Data Access Layer** — db_client_prisma, services_trip_createtrip, services_trip_listusertrips, services_trip_gettripbyid, services_trip_gettripfull, services_trip_updatetrip, services_trip_deletetrip, services_trip_updatestop, services_trip_deletestop, services_research_getresearchjob, services_research_updateresearchjob, services_research_recoverstalejobs, workers_research_startresearchworker [EXTRACTED 1.00]
- **Trip Creation Pipeline (POST /trips)** — routes_trips_router, services_trip_createtrip, workers_research_startresearchworker, external_nomad_agent [EXTRACTED 1.00]
- **Lazy Image Resolution Pipeline** — services_trip_gettripfull, services_trip_resolvetripimages, services_placeimage_resolveplaceimage, services_placeimage_fromwikipedia, external_wikipedia_api, services_placeimage_wikimemo [EXTRACTED 1.00]
- **Supabase Auth + RLS Security Layer** — external_supabase_auth, middleware_auth_authmiddleware, migrations_profile_trigger, migrations_rls_policies [EXTRACTED 1.00]
- **Environment Validation and Consumption** — env_envschema, env_env, index_app, middleware_error_errorhandler, workers_research_startresearchworker [EXTRACTED 1.00]
- **Public Feed Endpoints (No Auth)** — routes_feed_router, db_client_prisma [EXTRACTED 1.00]
- **Multi-Agent Research Pipeline (Parallel + Synthesizer)** — youtube_shorts_agent, reddit_agent, google_blog_agent, synthesizer_agent, langgraph_pipeline [EXTRACTED 1.00]
- **End-to-End Trip Creation Flow** — react_native_app, nomad_api_service, research_worker_ts, nomad_agent_service, supabase_db [EXTRACTED 1.00]
- **Claude Code Governance (Rules + Agents + Skills)** — rules_api_specs, rules_coding_standards, rules_database_schema, agent_api_contract_reviewer, agent_security_reviewer, skill_add_route, skill_add_ai_agent, skill_add_prisma_migration [EXTRACTED 0.95]

## Communities (19 total, 6 thin omitted)

### Community 0 - "Core API Infrastructure"
Cohesion: 0.05
Nodes (59): prisma, Validated env Object, Environment Schema (Zod), nomad-agent Python FastAPI Service (External), Supabase Auth (External), Wikipedia API (External), Express App Entry (index.ts), AuthenticatedRequest (+51 more)

### Community 1 - "Dev Docs & Claude Agents"
Cohesion: 0.06
Nodes (57): API Contract Reviewer Agent, Security Reviewer Agent, API Response Format Convention, Auth Middleware (Supabase JWT), Supabase JWT Auth Pattern, Nomad API Backend Architecture Doc, Nomad API Claude Dev Guide, db/client.ts (PrismaClient singleton) (+49 more)

### Community 2 - "Data Models & Integration"
Cohesion: 0.09
Nodes (36): Supabase Postgres Database, discoveries JSON Write Fix (L5), AGENT_SERVICE_URL env var, INTERNAL_AGENT_SECRET env var, Frontend Integration Plan, Insight Prisma Model, Internal Agent Secret Auth, ItineraryDay Prisma Model (+28 more)

### Community 3 - "Runtime Dependencies"
Cohesion: 0.07
Nodes (29): author, dependencies, cors, dotenv, express, jose, @prisma/client, zod (+21 more)

### Community 4 - "AI Research Pipeline"
Cohesion: 0.13
Nodes (29): GoogleBlogAgent, POST /agent/research Endpoint, RedditAgent, AGENT_SERVICE_URL Env Var, SynthesizerAgent, YouTubeShortsAgent, AIDay Pydantic Model, AI Integration Plan (+21 more)

### Community 5 - "Image & Media Utilities"
Cohesion: 0.14
Nodes (13): cleanUrl(), fileName(), fromWikipedia(), isPhoto(), memo, pickPhoto(), remember(), resolvePlaceImage() (+5 more)

### Community 6 - "Dev Toolchain"
Cohesion: 0.12
Nodes (16): devDependencies, @commitlint/cli, @commitlint/config-conventional, eslint, eslint-config-prettier, @eslint/js, husky, lint-staged (+8 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+6 more)

### Community 8 - "Claude Code Hooks & Settings"
Cohesion: 0.14
Nodes (13): args, command, type, hooks, PostToolUse, PreToolUse, mcpServers, context7 (+5 more)

### Community 9 - "Skills & MCP Config"
Cohesion: 0.15
Nodes (12): skills, supabase, supabase-postgres-best-practices, computedHash, computedHash, skillPath, source, sourceType (+4 more)

### Community 10 - "Claude Code Automation"
Cohesion: 0.22
Nodes (9): Claude Code Project Settings, Claude Code Local Settings, block-env.js Hook (env file guard), PostToolUse Hook: TypeCheck + Lint on TS Edit, PreToolUse Hook: Block .env Edit, Context7 MCP Server, Supabase MCP Server, Supabase Agent Skill (skills-lock) (+1 more)

## Knowledge Gaps
- **122 isolated node(s):** `supabase`, `name`, `version`, `main`, `dev` (+117 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Nomad API Claude Dev Guide` connect `Dev Docs & Claude Agents` to `Data Models & Integration`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `AI Integration Plan` connect `AI Research Pipeline` to `Dev Docs & Claude Agents`, `Data Models & Integration`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `Frontend Integration Plan` connect `Data Models & Integration` to `Dev Docs & Claude Agents`, `AI Research Pipeline`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `supabase`, `name`, `version` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core API Infrastructure` be split into smaller, more focused modules?**
  _Cohesion score 0.05009009009009009 - nodes in this community are weakly interconnected._
- **Should `Dev Docs & Claude Agents` be split into smaller, more focused modules?**
  _Cohesion score 0.06203007518796992 - nodes in this community are weakly interconnected._
- **Should `Data Models & Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.09365079365079365 - nodes in this community are weakly interconnected._