# Architecture and source map

## New-project decision

The user explicitly authorized a new build after no existing repository was attached. No pre-existing routes, data or behavior were available to preserve. There is no claimed upgrade or migration from a prior Cyber AI version. Reference imagery/video was not available; the atmosphere is original procedural CSS and no reference screenshot is embedded.

## Data flow

```text
Official CISA JSON → schema validation → deduplication/normalization
 → PostgreSQL snapshot (or labeled local process cache)
 → feed/detail → selected evidence → conceptual investigation
 → deterministic event sequence → playback cursor → graph/logs/inspector
 → approval-gated dry-run proposal → saved version/history/export
```

The simulator is a pure bounded processor. It never calls a remote integration and never executes scripts. Nodes transform an event envelope, enforce required inputs/declared outputs and choose an explicit branch. A response checks approval at runtime even when a user edits the graph to bypass an approval node. The UI consumes the generated events; animation does not invent telemetry.

## File-by-file implementation map

| File                                      | Responsibility                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/lib/model.ts`                        | Zod contracts for graphs, nodes and normalized threats; shared event types                                       |
| `src/lib/engine.ts`                       | Graph validation, deterministic operation semantics, synthetic scenario fixtures, playback reducer               |
| `src/lib/content.ts`                      | Versioned workflows, topics, primary references, quizzes and structured automation ideas                         |
| `src/server/feeds.ts`                     | CISA/mirror adapter, bounded fetch/backoff, source normalization, dedupe, cache and stale states                 |
| `src/server/providers.ts`                 | Explicit NVD/EPSS/OTX/VT/AbuseIPDB enrichment, consent, quotas and source health                                 |
| `src/server/mentor.ts`                    | Curated retrieval and local answers; optional Responses request and structured result validation                 |
| `src/server/db.ts`                        | Pooled PostgreSQL connection, cache, health and tenant audit                                                     |
| `src/server/state.ts`                     | Shared, tested user-and-tenant-scoped persistence queries                                                        |
| `src/server/security.ts`                  | Authentication sessions, scrypt verification, origin checks, atomic quotas, indicator validation and plan limits |
| `src/app/api/[...segments]/route.ts`      | Validated HTTP boundary, access checks, response policies and cron dispatch                                      |
| `src/app/[[...path]]/page.tsx`            | Server-side route validation; unknown topics/routes return 404                                                   |
| `src/app/layout.tsx`                      | Global metadata and style entry                                                                                  |
| `src/app/globals.css`                     | Design system, original lounge atmosphere, responsive layouts, reduced-motion and low-motion states              |
| `src/components/App.tsx`                  | Navigation shell and source-backed command center                                                                |
| `src/components/Intel.tsx`                | Feed, filters, evidence details and enrichment consent                                                           |
| `src/components/Workspace.tsx`            | Graph/editor, playback, selection, synchronized inspector, mentor and lessons                                    |
| `src/components/Screens.tsx`              | Knowledge navigator, academy, projects, settings and protected admin view                                        |
| `src/components/store.tsx`                | Account-scoped device persistence, API helper, downloads and user notices                                        |
| `db/migrations/001_initial.sql`           | Additive schema for tenants/users/sessions/state/cache/health/quotas/audit                                       |
| `scripts/migrate.mjs`, `scripts/seed.mjs` | Transactional schema setup and explicit admin provisioning                                                       |
| `scripts/verify-feeds.ts`                 | Live public endpoint check                                                                                       |
| `scripts/smoke-api.mjs`                   | HTTP route/security/integration smoke checks                                                                     |
| `scripts/generate-fixtures.ts`            | Reproducible synthetic data exports                                                                              |
| `tests/engine.test.ts`                    | Determinism, semantic branches, guards, contracts and playback                                                   |
| `tests/security.test.ts`                  | Input/origin restrictions and provenance-preserving normalization                                                |
| `tests/database.test.ts`                  | PostgreSQL-engine migration, isolation, cache, quota and audit checks                                            |
| `next.config.ts`, `vercel.json`           | Runtime headers/build compatibility and scheduled ingestion declaration                                          |

## Authentication and trust boundaries

Credentials and API keys are only read on the server. Passwords use scrypt with random salts. Session tokens have 256 bits of randomness and are hashed at rest; cookies are HTTP-only, strict SameSite and secure in production. Admin role checks occur server-side. State operations use the session-derived identity and tenant, never an identity supplied in the JSON body.

Provider lookup caches are tenant-scoped, and audit events store a hash of a disclosed indicator. Production quotas require the shared database; external lookups fail closed without it. Domain and IP lookups never fetch a user-supplied URL: they call fixed provider endpoints with encoded input. Non-public IPv4 ranges, credentials-in-URL patterns and unsupported indicator formats are rejected.

The mentor resolves topic, workflow and node definitions on the server and recomputes its simulation context. Public source text is delimited as untrusted data. The model has no tools or execution authority. A strict JSON schema, Zod validation and citation allowlist constrain the response. Prompt injection cannot be guaranteed absent; unsupported output falls back to transparent local guidance. No private telemetry or raw user-uploaded documents are supported.

## Technology decisions

Next.js/React/strict TypeScript provide the application and HTTP boundary. XYFlow provides accessible graph navigation primitives. Plain CSS implements the bespoke design without an additional utility/component framework. Zod validates external data. Parameterized `pg` queries and additive SQL migrations keep persistence explicit; Prisma/Drizzle were not added to this bounded first release. PGlite is a development-only embedded PostgreSQL test engine, not production storage.

The UI does not require a GPU-heavy scene or external image/fonts. The procedural atmosphere uses a small number of composited transforms. Graph animation is disabled under reduced-motion preferences; playback and state changes remain available.
