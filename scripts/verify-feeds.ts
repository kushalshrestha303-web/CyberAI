import { fetchJson, normalizeKev, KEV_URL, KEV_MIRROR } from '../src/server/feeds';
const results = [];
let selected = '';
for (const url of [KEV_URL, KEV_MIRROR]) {
  try {
    const r = normalizeKev(await fetchJson(url, {}, 1), new Date().toISOString());
    selected = r.items[0]?.id ?? '';
    results.push({
      provider: 'CISA KEV',
      url,
      ok: true,
      records: r.items.length,
      catalogVersion: r.version,
      first: selected,
    });
  } catch (e) {
    results.push({ provider: 'CISA KEV', url, ok: false, error: (e as Error).message });
  }
}
if (selected) {
  for (const [provider, url] of [
    ['FIRST EPSS', `https://api.first.org/data/v1/epss?cve=${selected}`],
    ['NVD', `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${selected}`],
  ]) {
    try {
      const result = (await fetchJson(url, {}, 1)) as Record<string, unknown>;
      results.push({ provider, url, ok: true, responseFields: Object.keys(result) });
    } catch (e) {
      results.push({ provider, url, ok: false, error: (e as Error).message });
    }
  }
}
console.log(JSON.stringify({ testedAt: new Date().toISOString(), results }, null, 2));
if (!results.some((r) => r.provider === 'CISA KEV' && r.ok)) process.exitCode = 1;
