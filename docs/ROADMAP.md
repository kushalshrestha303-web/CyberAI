# Commercial expansion roadmap

The shipped implementation is a usable first release. The following are **not implemented** and must not be marketed as operational:

1. Production identity lifecycle: SSO/OIDC, invitations, MFA, password reset, user administration and verified organization membership.
2. Connected telemetry: tenant-scoped collectors, permissions review, consent, data minimization, asset inventory and vendor-specific detections with evidence-backed mappings.
3. Workflow engine expansion: nested subgraphs, parallel joins, resilient long-running execution, arbitrary trace import and connector-specific field mapping. Run any real long-lived jobs in an external worker/queue.
4. Operational adapters: Sentinel/Defender/Graph/SOAR/ticketing/Slack/Teams, each implemented and tested independently with least privileges, staged approval and rollback. Preserve deny-by-default response behavior.
5. Knowledge expansion: reviewed content ingestion, source versioning, tool explorer and additional labs. Existing modules are starter coverage, not an encyclopedia.
6. AI workflow generation: schema validation, semantic verification, source attribution, injection testing and explicit review before publishing any generated graph.
7. Billing: provider interface, checkout, subscriptions, webhooks, entitlement reconciliation and receipts. Existing plan names only control assigned server quotas.
8. Commercial operations: audit/retention controls, exports/deletion, backup recovery, observability, accessibility audit, device/performance testing, load testing and independent security assessment.

Recommended release gate: deploy a private workspace, verify managed database and identity end-to-end, run two-tenant isolation and quota tests, validate scheduled ingestion, then enable one optional provider at a time under an appropriate license.
