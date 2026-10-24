# Deployment to Vercel

The source uses Next.js App Router and Node route handlers. No long-running server, background loop or WebSocket process is assumed. Deployment credentials were not supplied; local production build validation is separate from a successful Vercel deployment.

1. Extract the ZIP. The project root contains `package.json`.
2. Push this directory to a Git repository you control, or import it using your Vercel CLI workflow.
3. Create a Vercel project using the **Next.js** framework preset. Use Node.js 22 or 24, install command `npm ci`, and build command `npm run build`. Do not set a static export output directory.
4. Provision managed PostgreSQL near the function region. Set `DATABASE_URL` using a pooled, TLS-enabled connection string with limited database privileges. Run `npm run db:migrate` from a trusted terminal with that connection configured.
5. Set `APP_ORIGIN` to the exact canonical HTTPS origin, e.g. `https://your-project.vercel.app`. A custom domain requires updating this value. Preview deployments need their own matching origin. Without it, production POSTs fail closed.
6. Generate a random `CRON_SECRET` of at least 32 characters using your secret manager. Set it server-side in Vercel. Never use a public environment variable for any key.
7. Provision your administrator using the documented seed command from a trusted terminal. Remove `SEED_ADMIN_PASSWORD` and `SEED_ADMIN_EMAIL` after seeding. Do not place them in the ZIP or Git.
8. Deploy, then verify `/api/health`, `/intel`, `/api/providers`, sign-in and `/api/state`. The health endpoint reports database configuration, not a successful DB connection; verify a real account and state save to test the database.
9. `vercel.json` schedules `GET /api/cron/ingest` daily at **06:00 UTC**. Confirm your plan supports the schedule and bearer-secret behavior. Alternatively use an external scheduler with `Authorization: Bearer <CRON_SECRET>`. Do not expose the secret in query parameters. The endpoint requires PostgreSQL and performs a bounded ingestion.
10. Confirm the cron's database snapshot, timestamp and health row update. A failed upstream fetch preserves the last successful data and returns an error/stale state.

## Environment values

| Variable                                             | Purpose                                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| DATABASE_URL                                         | PostgreSQL connection; required for accounts, durable cache, shared quotas and cron    |
| APP_ORIGIN                                           | Exact trusted browser origin for POST requests                                         |
| CRON_SECRET                                          | Secret bearer token, 32+ characters                                                    |
| OPENAI_API_KEY / OPENAI_MODEL                        | Optional model adapter; both required; choose a model supporting Responses JSON schema |
| ENABLE_EXTERNAL_LOOKUPS                              | Defaults off; set to `true` to enable authenticated explicit enrichment                |
| NVD_API_KEY                                          | Optional NVD key; requests remain conservatively limited                               |
| OTX_API_KEY / VIRUSTOTAL_API_KEY / ABUSEIPDB_API_KEY | Optional provider secrets                                                              |

Use the service's current terms and quota plan. This application deliberately has no bulk VirusTotal collection or file upload. Even indicator queries may disclose data to a provider or its community. Only submit indicators you are authorized to disclose.

## Storage and retention

- Without a database, the app works in guest learning mode with a process-local, one-hour KEV cache. This is useful locally; it is not a durable production ingestion architecture.
- With PostgreSQL, `provider_cache` stores public snapshots and tenant-scoped lookup results. `provider_health` preserves successful and attempted timestamps.
- Cloud learning data is saved explicitly by the authenticated user. `user_state` operations filter on both user and tenant. A browser namespace separates guest data from each signed-in account.
- The daily ingestion job removes expired sessions, expired quota buckets and lookup cache older than seven days. Audit logs and user state are retained until the operator applies an approved retention policy. Add scheduled archival/deletion appropriate to your obligations before processing sensitive tenant information.
- Use provider-managed backups, monitoring and connection pooling. Production pooling/TLS behavior must be tested against your selected provider.

## Verification and rollback

Run the checks in `docs/VALIDATION.md` after deployment, using the actual origin. Verify authorization failures as well as successful account operations. Test two different tenants before enabling multi-user use.

Migration 001 is additive and idempotent. Back up the database before future schema changes. Roll back application deployments to a previous version without dropping tables. Do not run destructive down migrations on production data.

## Before commercial launch

Complete independent security and accessibility review, production identity lifecycle/MFA, provider-license review, distributed load testing, stronger nonce-based CSP, database backup/restore tests, retention controls, monitoring and billing integration if needed. The current CSP blocks framing and restricts connections to same-origin, but allows inline Next.js scripts; it is not a nonce-based policy.
