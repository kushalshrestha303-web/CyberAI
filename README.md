# CYBER AI 2.0

**Learn cybersecurity by watching it work.**

This is a **new application built from scratch**, not an upgrade of an existing repository. It delivers a working first release: public CISA intelligence, four deterministic educational workflows, six synthetic SOC scenarios, contextual teaching, and an editable dry-run automation architect. It is prepared for deployment to Vercel; it has not been deployed to a Vercel account by this build session.

## Start locally

Requires Node.js 22 or newer and npm. Node 24 was used for validation.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:3100**. No credentials are needed for the public CISA feed, simulations, academy, local mentor or browser-local playbooks. Internet access is needed to retrieve public intelligence. A failed provider is shown as unavailable or stale, never replaced by invented live data.

Copy `.env.example` to `.env.local` when enabling workspace services. Keep `APP_ORIGIN=http://127.0.0.1:3100` locally and use the exact HTTPS origin in production.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Development and builds use Webpack. Windows uses worker threads to avoid sandbox child-process filesystem restrictions; Linux/Vercel use the default build worker configuration.

## Try the complete intelligence journey

1. Open **Threat intelligence**. The server fetches CISA KEV, validates its schema, deduplicates CVEs, preserves source timestamps and caches the result for one hour.
2. Search for a CVE or product. Open a record and inspect the affected product, CISA required action, catalog addition date and original source.
3. Select **Open in workflow**. Real public evidence follows the graph. Asset matches, review decisions and remediation are explicitly hypothetical.
4. Press play or step. Select a node to inspect its input/output and explanatory content. Scrub backward, change speed, pause or reset.
5. Ask **Cyber AI** about the node. The local curated mentor works immediately. An authenticated model-backed mentor is optional.
6. Select **Automate this**. The CVE opens a remediation-review template with its evidence intact. Approve the **simulated** response to exercise the response path, or withhold approval to verify that it is skipped.
7. Save a version, finish the dry run, inspect its history and export the workflow or execution trace.

## Included functionality

| Area                  | Implemented                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command center        | Source-derived catalog count, actual lesson/run counts, linked investigations, procedural midnight lounge atmosphere                                                                        |
| Intelligence          | CISA KEV feed and official mirror fallback; search; date/severity filters; pagination; detail/evidence; bookmarks; source health                                                            |
| Workflow engine       | Validated acyclic graph; explicit yes/no branches; deterministic events; pan/zoom; node dragging; selection; input/output; playback, pause, step, seek, reset, speed and in-session replay  |
| Protocol lessons      | TCP three-way handshake and firewall failure; simplified full TLS 1.3 and certificate failure                                                                                               |
| SOC                   | Identity compromise, phishing, suspicious PowerShell, brute force, possible exfiltration and ransomware precursor fixtures                                                                  |
| Intelligence workflow | Selected KEV record → enrichment context → normalization → hypothetical asset correlation → analyst review → approval → remediation proposal → audit                                        |
| Automation            | Editable node graph; add/connect/remove nodes; branch controls; required-field contracts; bounded retry/timeout simulation; approval guard; version snapshots; dry-run history; JSON export |
| Mentor                | Curated local retrieval; selected node and playback context; source references; optional server-side OpenAI Responses adapter with validated structured output                              |
| Academy               | 12 lessons, four recommended paths, workflow completion plus correct answer required for local progress                                                                                     |
| Accounts              | PostgreSQL-backed provisioned users, scrypt passwords, hashed opaque sessions, strict cookies, tenant-scoped state, admin audit, role checks                                                |
| Production services   | Database cache and health, atomic shared quotas, scheduled CISA ingestion endpoint, cleanup of expired sessions/cache, placeholder environment configuration                                |

## Optional services

| Service                                                                       | Requirements / status                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL                                                                    | Set `DATABASE_URL`, migrate and seed. Schema/state/quota/audit operations tested against PGlite (embedded PostgreSQL); managed Postgres deployment and real account sign-in need environment verification. |
| OpenAI                                                                        | Set `OPENAI_API_KEY` and `OPENAI_MODEL`. Signed-in user and PostgreSQL quotas required. No model key was supplied during implementation; the real model path is not live-tested.                           |
| NVD                                                                           | Explicit CVE lookup; API key optional; conservative shared limit of four requests per 30 seconds. Public endpoint reached during validation.                                                               |
| FIRST EPSS                                                                    | Explicit CVE lookup; public endpoint reached during validation. EPSS and percentile are kept separate from CVSS.                                                                                           |
| OTX / VirusTotal / AbuseIPDB                                                  | Implemented, schema-checked on-demand adapters; credentials required and not supplied/tested. Enable `ENABLE_EXTERNAL_LOOKUPS=true` only after reviewing your provider plan and license.                   |
| Sentinel / Defender / Graph / Wazuh / Splunk / Elastic / SOAR / Slack / Teams | Educational examples only. No operational adapters, notifications or containment actions.                                                                                                                  |
| Billing                                                                       | Server-side Free/Student/Professional/Team quota definitions only. No Stripe, checkout or payment processing.                                                                                              |

Provider connectivity is confirmed only by a valid response, not by the presence of a key. The first release's global feed is CISA only; other sources provide explicit enrichment, not continuous bulk ingestion. Indicator lookups require disclosure consent and reject private/reserved IPv4 addresses. IPv6 lookup is not supported.

## Database setup

Use a managed PostgreSQL database with a pooled connection string and TLS as required by your provider. The app does not disable certificate validation.

```sh
npm run db:migrate
# Set SEED_ADMIN_EMAIL and a unique SEED_ADMIN_PASSWORD (14+ characters) in .env.local.
npm run db:seed
```

Remove the seed credentials afterwards. There is no shipped default account. Provisioning additional users, password recovery, social login, invitation flows and MFA are not implemented; do not treat this first release as a fully audited commercial identity product. The seed refuses to overwrite an existing account.

## Verification

```sh
npm test                       # deterministic, validation, security and PostgreSQL-engine tests
npm run verify:feeds           # real upstream connectivity; no keys used
node scripts/smoke-api.mjs     # running localhost server required
npm audit --omit=dev
```

See `docs/VALIDATION.md` for executed checks and their limits. Fixtures are generated by `npx tsx scripts/generate-fixtures.ts` and clearly marked synthetic.

## Important scope boundaries

- This is a functioning first release, not a claim that the full commercial roadmap is finished.
- Public intelligence is real when retrieved; there is no connected production telemetry, asset inventory, scanning, exploitation or external response execution.
- Replay uses the recorded portion of the current session. Trace export works; importing arbitrary trace files and nested subgraph composition are future work.
- The editor implements a bounded single-path conditional DAG. Parallel joins, loops, arbitrary expression execution and connector-specific field-mapping editors are not implemented.
- The renderer and deterministic processor are separate. Retry and timeout behavior is simulated with explicit latency, not background workers.
- No literal coverage of every cybersecurity topic, arbitrary AI-generated graphs, free-form SIEM query execution, file uploads, or paid entitlements purchased by users is claimed.
- Device-local progress is self-directed educational evidence, not a certification. Cloud save/load is explicit.
- Responsive tabbed mobile layouts and reduced-motion CSS are included; full mobile-device, assistive-technology and performance audits remain necessary before commercial launch.

See `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/ROADMAP.md`, `CHANGELOG.md` and `THIRD_PARTY_LICENSES.md`.
