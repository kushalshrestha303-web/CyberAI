import { z } from 'zod';
import { type Threat, type Feed, ThreatSchema } from '../lib/model';
import { cacheRead, cacheWrite, db, health } from './db';
export const KEV_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
export const KEV_MIRROR =
  'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json';
export const KevSchema = z.object({
  catalogVersion: z.string(),
  dateReleased: z.string(),
  vulnerabilities: z
    .array(
      z.object({
        cveID: z.string().regex(/^CVE-\d{4}-\d{4,10}$/),
        vendorProject: z.string(),
        product: z.string(),
        vulnerabilityName: z.string(),
        dateAdded: z.string(),
        shortDescription: z.string(),
        requiredAction: z.string(),
        dueDate: z.string().optional(),
        knownRansomwareCampaignUse: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .max(50000),
});
export function normalizeKev(
  raw: unknown,
  ingestedAt: string,
): { items: Threat[]; version: string } {
  const c = KevSchema.parse(raw);
  const unique = new Map<string, Threat>();
  for (const v of c.vulnerabilities) {
    const reference = `https://www.cve.org/CVERecord?id=${v.cveID}`;
    unique.set(
      v.cveID,
      ThreatSchema.parse({
        id: v.cveID,
        source: 'CISA KEV',
        source_id: v.cveID,
        type: 'CVE',
        title: v.vulnerabilityName,
        summary: v.shortDescription,
        references: [reference, 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'],
        first_seen: null,
        last_seen: null,
        ingested_at: ingestedAt,
        confidence: 'CISA reports known exploitation; local applicability is unverified.',
        severity: null,
        cvss: null,
        epss: null,
        affected_products: [`${v.vendorProject} ${v.product}`],
        techniques: [],
        sharing: 'Public catalog; source terms apply',
        raw_source: KEV_URL,
        required_action: v.requiredAction,
        due_date: v.dueDate ?? null,
        ransomware: v.knownRansomwareCampaignUse ?? null,
      }),
    );
  }
  // Catalog addition dates are retained separately from observed first/last seen.
  const dates = new Map(c.vulnerabilities.map((v) => [v.cveID, v.dateAdded]));
  return {
    items: [...unique.values()]
      .map((v) => ({ ...v, catalog_added: dates.get(v.id) }))
      .sort(
        (a, b) =>
          (b.catalog_added ?? '').localeCompare(a.catalog_added ?? '') || b.id.localeCompare(a.id),
      ),
    version: c.catalogVersion,
  };
}
export async function fetchJson(
  url: string,
  headers: Record<string, string> = {},
  attempts = 2,
): Promise<unknown> {
  let failure: Error = new Error('Upstream unavailable');
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(12000),
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) {
        failure = new Error(`Upstream HTTP ${response.status}`);
        if (response.status !== 429 && response.status < 500) throw failure;
        if (i + 1 < attempts) {
          await new Promise((r) =>
            setTimeout(
              r,
              Math.min(
                2500,
                Number(response.headers.get('retry-after') ?? 0) * 1000 || 500 * 2 ** i,
              ),
            ),
          );
          continue;
        }
        throw failure;
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty upstream response');
      let bytes = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 12_000_000) {
          await reader.cancel();
          throw new Error('Upstream response exceeds size limit');
        }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (e) {
      failure = e instanceof Error ? e : new Error('Upstream unavailable');
      if (/HTTP (400|401|403|404)/.test(failure.message)) break;
      if (i + 1 < attempts) await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw failure;
}
type Snapshot = { items: Threat[]; version: string; updatedAt: string; upstream: string };
let memory: Snapshot | null = null,
  pending: Promise<Snapshot> | null = null,
  lastAttempt = 0,
  lastFailure = false;
async function ingest(): Promise<Snapshot> {
  let raw: unknown,
    upstream = KEV_URL;
  try {
    raw = await fetchJson(KEV_URL);
  } catch {
    upstream = KEV_MIRROR;
    raw = await fetchJson(KEV_MIRROR);
  }
  const updatedAt = new Date().toISOString(),
    normalized = normalizeKev(raw, updatedAt);
  const snapshot = { ...normalized, updatedAt, upstream };
  await cacheWrite('kev', snapshot);
  memory = snapshot;
  await health(
    'CISA KEV',
    'connected',
    upstream === KEV_URL
      ? 'Official CISA feed succeeded'
      : 'Official cisagov GitHub mirror succeeded',
  );
  lastFailure = false;
  return snapshot;
}
export async function kevFeed(force = false): Promise<Feed> {
  const storage = db() ? 'postgresql' : 'process-memory';
  let snapshot = memory;
  if (db()) {
    const saved = await cacheRead<Snapshot>('kev');
    if (saved) snapshot = saved.data;
  }
  const age = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;
  if (!force && age < 3600000)
    return {
      items: snapshot!.items,
      total: snapshot!.items.length,
      updatedAt: snapshot!.updatedAt,
      catalogVersion: snapshot!.version,
      status: lastFailure ? 'stale' : 'cached',
      storage,
      upstream: snapshot!.upstream,
      page: 1,
      pages: 1,
    };
  if (!force && Date.now() - lastAttempt < 60000 && !pending)
    return {
      items: snapshot?.items ?? [],
      total: snapshot?.items.length ?? 0,
      updatedAt: snapshot?.updatedAt ?? null,
      catalogVersion: snapshot?.version ?? null,
      status: snapshot ? 'stale' : 'unavailable',
      error: 'Upstream retry is cooling down. Last successful data is retained.',
      storage,
      upstream: snapshot?.upstream ?? null,
      page: 1,
      pages: 1,
    };
  try {
    if (!pending) {
      lastAttempt = Date.now();
      pending = ingest().finally(() => {
        pending = null;
      });
    }
    snapshot = await pending;
    return {
      items: snapshot.items,
      total: snapshot.items.length,
      updatedAt: snapshot.updatedAt,
      catalogVersion: snapshot.version,
      status: 'live',
      storage,
      upstream: snapshot.upstream,
      page: 1,
      pages: 1,
    };
  } catch {
    lastFailure = true;
    await health(
      'CISA KEV',
      'error',
      'Both official endpoints failed; last successful cache retained.',
    );
    return {
      items: snapshot?.items ?? [],
      total: snapshot?.items.length ?? 0,
      updatedAt: snapshot?.updatedAt ?? null,
      catalogVersion: snapshot?.version ?? null,
      status: snapshot ? 'stale' : 'unavailable',
      error: 'CISA is unavailable. Cached evidence, if present, is marked stale.',
      storage,
      upstream: snapshot?.upstream ?? null,
      page: 1,
      pages: 1,
    };
  }
}
