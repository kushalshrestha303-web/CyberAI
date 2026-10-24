# API reference and provider integration

All JSON responses use `Cache-Control: private, no-store`; server-side provider caching is separate. Errors expose a safe message and HTTP status without upstream credentials. POST bodies are bounded to 150 KB. State-changing browser calls require the configured origin. Unrecognized APIs return 404.

| Method / path                                            | Access                     | Purpose                                                                                   |
| -------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| GET `/api/health`                                        | Public                     | Application/version/configuration status                                                  |
| GET `/api/intel?q=&page=1&since=YYYY-MM-DD&severity=all` | Public                     | CISA records, 24 per page, server-side filters and freshness                              |
| GET `/api/intel/CVE-…`                                   | Public                     | Source detail and actual upstream URL                                                     |
| GET `/api/providers`                                     | Public                     | Provider status and last successful request, never credentials                            |
| GET `/api/auth/session`                                  | Public                     | Current user or null                                                                      |
| POST `/api/auth/login`                                   | Trusted origin; limited    | `{email,password}`; provisioned accounts only                                             |
| POST `/api/auth/logout`                                  | Trusted origin             | Revoke the current session                                                                |
| GET `/api/state`                                         | Signed in                  | Read own tenant/user learning state                                                       |
| POST `/api/state`                                        | Signed in                  | Save bounded completed/bookmark/workflow/history state                                    |
| POST `/api/mentor`                                       | Local public; AI signed in | `{question,workflowId,nodeId,cursor,topic?,parameters?,threatId?,level?,goal?,useModel?}` |
| POST `/api/lookup`                                       | Signed in + flag + consent | `{provider,type,value,consent:true}`                                                      |
| GET `/api/admin`                                         | Admin                      | Current tenant audit trail                                                                |
| GET `/api/cron/ingest`                                   | Cron bearer secret         | Bounded durable ingestion and cleanup                                                     |

## Normalized CISA contract

`source`, `source_id`, `type`, `title`, `summary`, `references`, `first_seen`, `last_seen`, `ingested_at`, `confidence`, `severity`, `cvss`, `epss`, `affected_products`, `techniques`, `sharing`, `raw_source`, `required_action`, `due_date`, `ransomware`, `catalog_added`.

KEV does not supply first/last observed exploitation, CVSS, EPSS or verified ATT&CK mappings. Those values remain null/empty. `catalog_added` is deliberately not converted into `first_seen`. No numeric risk score is invented.

Source endpoints:

- [CISA official catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [CISA JSON](https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json)
- [Official cisagov mirror](https://github.com/cisagov/kev-data)
- [NVD developer guide](https://nvd.nist.gov/developers/start-here)
- [FIRST EPSS API](https://api.first.org/epss/)
- [OTX API](https://otx.alienvault.com/api)
- [VirusTotal IP reports](https://docs.virustotal.com/reference/ip-info)
- [AbuseIPDB API](https://docs.abuseipdb.com/)

Public catalog requests have timeouts, response-size limits, bounded retries and official-mirror fallback. Lookups use one upstream attempt per explicit request, tenant-scoped one-hour caching and conservative shared quotas. A failed lookup creates no verdict. NVD/EPSS return separate typed evidence; keyed providers return a bounded subset of their schema with interpretation limits. This is not a bulk ingestion implementation for optional providers.

## Optional AI provider

The adapter calls [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create) with `store:false`, a selected server-side model and [strict structured output](https://developers.openai.com/api/docs/guides/structured-outputs). User question, selected public evidence and curated educational context are sent only when the model checkbox is enabled. API credentials, account passwords and session tokens are never included in model context. The local fallback is a deterministic curated teacher and is labeled accordingly.

Model output includes an answer, limitations, next steps and citation IDs. Only IDs from the supplied primary-source set are accepted. No tool calls, URL following or automation execution are exposed to the model.
