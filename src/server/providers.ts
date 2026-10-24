import { z } from 'zod';
import { cacheRead, cacheWrite, health, healthRows, type User, audit } from './db';
import { fetchJson } from './feeds';
import { digest, entitlements, HttpError, quota, validateIndicator } from './security';
export const providerDefinitions = [
  {
    id: 'cisa',
    name: 'CISA KEV',
    key: null,
    purpose: 'Scheduled public catalog',
    url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
  },
  {
    id: 'nvd',
    name: 'NVD',
    key: 'NVD_API_KEY',
    purpose: 'On-demand CVE enrichment',
    url: 'https://nvd.nist.gov/developers/start-here',
  },
  {
    id: 'epss',
    name: 'FIRST EPSS',
    key: null,
    purpose: 'On-demand exploit likelihood',
    url: 'https://www.first.org/epss/',
  },
  {
    id: 'otx',
    name: 'AlienVault OTX',
    key: 'OTX_API_KEY',
    purpose: 'On-demand indicator context',
    url: 'https://otx.alienvault.com/api',
  },
  {
    id: 'virustotal',
    name: 'VirusTotal',
    key: 'VIRUSTOTAL_API_KEY',
    purpose: 'On-demand report; commercial license may be required',
    url: 'https://docs.virustotal.com/reference/overview',
  },
  {
    id: 'abuseipdb',
    name: 'AbuseIPDB',
    key: 'ABUSEIPDB_API_KEY',
    purpose: 'Explicit public IPv4 lookup',
    url: 'https://docs.abuseipdb.com/',
  },
];
export async function providerStatus() {
  const rows = await healthRows();
  return providerDefinitions.map((p) => {
    const h = rows.find((r) => r.provider === p.name);
    return {
      id: p.id,
      name: p.name,
      purpose: p.purpose,
      url: p.url,
      status:
        h?.status ??
        (p.key && !process.env[p.key] && p.id !== 'nvd'
          ? 'needs credentials'
          : p.id === 'cisa'
            ? 'not fetched'
            : process.env.ENABLE_EXTERNAL_LOOKUPS === 'true'
              ? 'configured · unverified'
              : 'disabled'),
      lastSuccess: h?.last_success ?? null,
      lastAttempt: h?.last_attempt ?? null,
      message: h?.message ?? 'A successful request is required to verify connection.',
    };
  });
}
export async function lookup(
  user: User,
  provider: string,
  type: string,
  value: string,
  consent: boolean,
) {
  if (process.env.ENABLE_EXTERNAL_LOOKUPS !== 'true')
    throw new HttpError(503, 'External lookups are disabled by the workspace administrator.');
  if (!consent)
    throw new HttpError(
      400,
      'Confirm that this indicator may be disclosed to the selected third party.',
    );
  if (!validateIndicator(type, value))
    throw new HttpError(
      400,
      'Invalid or non-public indicator. IPv4, public domain, SHA-256 and CVE inputs only.',
    );
  const p = providerDefinitions.find((p) => p.id === provider && p.id !== 'cisa');
  if (!p) throw new HttpError(400, 'Unknown provider.');
  if (p.key && !process.env[p.key] && provider !== 'nvd')
    throw new HttpError(503, `${p.name} credentials are not configured.`);
  if (['nvd', 'epss'].includes(provider) && type !== 'CVE')
    throw new HttpError(400, 'This provider accepts CVE identifiers.');
  if (provider === 'abuseipdb' && type !== 'IP')
    throw new HttpError(400, 'AbuseIPDB accepts public IPv4 only.');
  if (['otx', 'virustotal'].includes(provider) && !['IP', 'domain', 'hash'].includes(type))
    throw new HttpError(400, 'Choose a public IPv4, domain or SHA-256.');
  await quota(`lookups:user:${user.id}`, entitlements[user.plan].lookups, 86400, true);
  // Third-party cache is tenant-scoped. Indicator values are not written to audit logs.
  const key = `lookup:${user.tenant_id}:${provider}:${digest(value)}`,
    cached = await cacheRead<unknown>(key);
  if (cached && Date.now() - Date.parse(cached.updatedAt) < 3600000)
    return { provider: p.name, data: cached.data, updatedAt: cached.updatedAt, cached: true };
  await quota(
    `provider:${provider}`,
    provider === 'virustotal' ? 3 : provider === 'nvd' ? 4 : 10,
    provider === 'nvd' ? 30 : 60,
    true,
  );
  if (provider === 'virustotal') await quota('provider:virustotal:daily', 100, 86400, true);
  await audit(user, 'indicator-disclosure-consent', {
    provider: p.name,
    indicatorHash: digest(value),
    type,
  });
  try {
    let data: unknown;
    if (provider === 'nvd') {
      const raw = z
        .object({
          vulnerabilities: z.array(
            z.object({
              cve: z.object({
                id: z.string(),
                descriptions: z.array(z.object({ lang: z.string(), value: z.string() })),
                published: z.string(),
                lastModified: z.string(),
                metrics: z.record(z.string(), z.unknown()).optional(),
                references: z.array(z.object({ url: z.string() })),
              }),
            }),
          ),
        })
        .parse(
          await fetchJson(
            `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(value)}`,
            process.env.NVD_API_KEY ? { apiKey: process.env.NVD_API_KEY } : {},
            1,
          ),
        );
      data = raw.vulnerabilities.map((v) => ({
        id: v.cve.id,
        summary: v.cve.descriptions.find((d) => d.lang === 'en')?.value,
        published: v.cve.published,
        lastModified: v.cve.lastModified,
        metrics: v.cve.metrics ?? {},
        references: v.cve.references.slice(0, 10),
        note: 'CVSS measures severity; it is not exploitation probability.',
      }));
    } else if (provider === 'epss') {
      const raw = z
        .object({
          data: z.array(
            z.object({
              cve: z.string(),
              epss: z.string(),
              percentile: z.string(),
              date: z.string(),
            }),
          ),
        })
        .parse(
          await fetchJson(
            `https://api.first.org/data/v1/epss?cve=${encodeURIComponent(value)}`,
            {},
            1,
          ),
        );
      data = raw.data.map((v) => ({
        ...v,
        note: 'EPSS estimates exploitation probability in the next 30 days. Percentile is rank, not probability.',
      }));
    } else if (provider === 'abuseipdb') {
      const raw = z
        .object({
          data: z.object({
            ipAddress: z.string(),
            abuseConfidenceScore: z.number(),
            totalReports: z.number(),
            lastReportedAt: z.string().nullable(),
            usageType: z.string().nullable().optional(),
          }),
        })
        .parse(
          await fetchJson(
            `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(value)}&maxAgeInDays=90`,
            { Key: process.env.ABUSEIPDB_API_KEY! },
            1,
          ),
        );
      data = {
        ...raw.data,
        note: 'Community-report confidence is not a vulnerability severity score or proof of maliciousness.',
      };
    } else if (provider === 'virustotal') {
      const kind = type === 'IP' ? 'ip_addresses' : type === 'domain' ? 'domains' : 'files';
      const raw = z
        .object({
          data: z.object({
            id: z.string(),
            attributes: z.object({
              last_analysis_stats: z.record(z.string(), z.number()).optional(),
              last_analysis_date: z.number().optional(),
            }),
          }),
        })
        .parse(
          await fetchJson(
            `https://www.virustotal.com/api/v3/${kind}/${encodeURIComponent(value)}`,
            { 'x-apikey': process.env.VIRUSTOTAL_API_KEY! },
            1,
          ),
        );
      data = {
        ...raw.data,
        note: 'Engine verdict counts are observations, not a universal maliciousness percentage. No file is uploaded.',
      };
    } else {
      const kind = type === 'IP' ? 'IPv4' : type === 'domain' ? 'domain' : 'file';
      const raw = z
        .object({
          indicator: z.string().optional(),
          pulse_info: z.object({ count: z.number() }).optional(),
          reputation: z.number().optional(),
        })
        .parse(
          await fetchJson(
            `https://otx.alienvault.com/api/v1/indicators/${kind}/${encodeURIComponent(value)}/general`,
            { 'X-OTX-API-KEY': process.env.OTX_API_KEY! },
            1,
          ),
        );
      data = {
        ...raw,
        note: 'Pulse inclusion supplies context; verify source quality before using it for a verdict.',
      };
    }
    await cacheWrite(key, data);
    await health(p.name, 'connected', 'Validated on-demand response received.');
    return { provider: p.name, data, updatedAt: new Date().toISOString(), cached: false };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    await health(p.name, 'error', 'Request failed or response schema changed.');
    throw new HttpError(502, `${p.name} did not return a valid response. No verdict was inferred.`);
  }
}
