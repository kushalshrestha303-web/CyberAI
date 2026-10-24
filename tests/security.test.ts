import test from 'node:test';
import assert from 'node:assert/strict';
import { publicIPv4, validateIndicator, originCheck } from '../src/server/security';
import { normalizeKev, KevSchema } from '../src/server/feeds';
const fixture = {
  catalogVersion: 'test-only',
  dateReleased: '2026-01-01T00:00:00Z',
  vulnerabilities: [
    {
      cveID: 'CVE-2021-44228',
      vendorProject: 'Apache',
      product: 'Log4j',
      vulnerabilityName: 'Test fixture only',
      dateAdded: '2021-12-10',
      shortDescription: 'Synthetic normalization test; not a live claim.',
      requiredAction: 'Apply vendor guidance.',
      dueDate: '2021-12-24',
    },
  ],
};
test('private, documentation, reserved and ambiguous IPv4 values cannot leave the server', () => {
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '192.168.1.1',
    '172.16.0.2',
    '169.254.169.254',
    '100.64.0.1',
    '192.0.2.42',
    '198.51.100.1',
    '203.0.113.1',
    '198.18.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '8.008.8.8',
    '999.1.1.1',
    '::1',
  ])
    assert.equal(publicIPv4(ip), false, ip);
  assert.equal(publicIPv4('8.8.8.8'), true);
});
test('indicator validation rejects URLs, local domains and malformed hashes', () => {
  assert.equal(validateIndicator('domain', 'https://example.com'), false);
  assert.equal(validateIndicator('domain', 'secret.internal'), false);
  assert.equal(validateIndicator('domain', 'host.localhost'), false);
  assert.equal(validateIndicator('domain', 'example.com'), true);
  assert.equal(validateIndicator('hash', 'a'.repeat(64)), true);
  assert.equal(validateIndicator('hash', 'z'.repeat(64)), false);
  assert.equal(validateIndicator('CVE', 'CVE-2021-44228'), true);
  assert.equal(validateIndicator('CVE', 'CVE-123'), false);
});
test('cross-origin state-changing requests are denied', () => {
  process.env.APP_ORIGIN = 'https://cyber.example.com';
  assert.throws(() =>
    originCheck(
      new Request('https://cyber.example.com/api/state', {
        headers: { origin: 'https://attacker.example' },
      }),
    ),
  );
  assert.doesNotThrow(() =>
    originCheck(
      new Request('https://cyber.example.com/api/state', {
        headers: { origin: 'https://cyber.example.com' },
      }),
    ),
  );
  delete process.env.APP_ORIGIN;
});
test('normalization deduplicates without inventing severity, confidence percentage or techniques', () => {
  const source = {
    ...fixture,
    vulnerabilities: [...fixture.vulnerabilities, ...fixture.vulnerabilities],
  };
  const r = normalizeKev(source, '2026-01-01T00:00:00Z');
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].cvss, null);
  assert.equal(r.items[0].epss, null);
  assert.equal(r.items[0].severity, null);
  assert.equal(r.items[0].first_seen, null);
  assert.deepEqual(r.items[0].techniques, []);
  assert.equal(r.items[0].catalog_added, '2021-12-10');
  assert.equal(r.items[0].ingested_at, '2026-01-01T00:00:00Z');
});
test('malformed upstream catalog is rejected rather than represented as empty live data', () => {
  assert.equal(KevSchema.safeParse({ vulnerabilities: [] }).success, false);
  assert.throws(() => normalizeKev({ unexpected: 'payload' }, new Date().toISOString()));
});
