import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3100',
  results = [];
async function check(name, path, expected = 200, options) {
  const r = await fetch(base + path, options);
  assert.equal(r.status, expected, `${name}: ${r.status}`);
  results.push({ name, status: r.status });
  return r;
}
for (const path of [
  '/dashboard',
  '/intel',
  '/universe',
  '/workflow/tcp',
  '/workflow/tls',
  '/workflow/soc',
  '/soc',
  '/automation',
  '/academy',
  '/learn/tcp',
  '/projects',
  '/settings',
  '/admin',
])
  await check(`Page ${path}`, path);
await check('Unknown page', '/missing-route', 404);
await check('Guest cannot read state', '/api/state', 401);
await check('Guest cannot access admin audit', '/api/admin', 401);
await check('Cron rejects missing authorization', '/api/cron/ingest', 401);
await check('Cross-origin POST rejected', '/api/mentor', 403, {
  method: 'POST',
  headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
  body: '{}',
});
await check('Invalid schema rejected', '/api/mentor', 400, {
  method: 'POST',
  headers: { Origin: base, 'Content-Type': 'application/json' },
  body: '{}',
});
const mentor = await check('Local contextual mentor', '/api/mentor', 200, {
  method: 'POST',
  headers: { Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'Explain this stage',
    workflowId: 'soc',
    nodeId: 'approval',
    cursor: 10,
  }),
});
const explanation = await mentor.json();
assert.equal(explanation.mode, 'local');
assert.ok(explanation.answer.includes('approval'));
assert.ok(explanation.citations.length);
const feed = await (await check('Live normalized feed', '/api/intel')).json();
assert.ok(feed.items.length);
assert.ok(feed.updatedAt);
assert.equal(feed.items[0].source, 'CISA KEV');
assert.equal(feed.items[0].cvss, null);
const id = feed.items[0].id;
await check('CVE detail page', `/intel/${id}`);
const detail = await (await check('CVE API provenance', `/api/intel/${id}`)).json();
assert.equal(detail.item.id, id);
const search = await (await check('CVE search', `/api/intel?q=${id}`)).json();
assert.ok(search.items.every((item) => item.id.includes(id)));
const next = await (await check('Catalog pagination', '/api/intel?page=2')).json();
assert.notEqual(next.items[0].id, id);
console.log(
  JSON.stringify({ testedAt: new Date().toISOString(), checks: results.length, results }, null, 2),
);
