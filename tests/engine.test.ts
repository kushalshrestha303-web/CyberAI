import test from 'node:test';
import assert from 'node:assert/strict';
import { workflows, automationTemplate, intelAutomationTemplate, topics } from '../src/lib/content';
import { simulate, validateWorkflow, playbackReducer, scenarios } from '../src/lib/engine';
import { defaultParameters } from '../src/lib/model';
test('every shipped workflow validates and runs deterministically', () => {
  for (const w of [...Object.values(workflows), automationTemplate]) {
    assert.deepEqual(validateWorkflow(w).errors, []);
    assert.deepEqual(simulate(w, defaultParameters), simulate(w, defaultParameters));
    assert.ok(simulate(w, defaultParameters).length > 2);
  }
});
test('TCP sequence numbers are coherent and firewall blocks handshake', () => {
  const events = simulate(workflows.tcp, defaultParameters);
  assert.equal(events.find((e) => e.nodeId === 'synack')?.output.ack, 1001);
  assert.equal(events.find((e) => e.nodeId === 'ack')?.output.ack, 7001);
  assert.equal(events.find((e) => e.nodeId === 'ack')?.output.tcpState, 'ESTABLISHED');
  const blocked = simulate(workflows.tcp, { ...defaultParameters, firewallOpen: false });
  assert.ok(!blocked.some((e) => e.nodeId === 'synack'));
  assert.equal(blocked.at(-1)?.output.failed, true);
});
test('TLS invalid certificate prevents application data', () => {
  const failed = simulate(workflows.tls, { ...defaultParameters, certificateValid: false });
  assert.ok(failed.some((e) => e.nodeId === 'certificate' && e.status === 'error'));
  assert.ok(!failed.some((e) => e.nodeId === 'http'));
  const normal = simulate(workflows.tls, defaultParameters);
  assert.equal(normal.find((e) => e.nodeId === 'http')?.output.confidentiality, true);
});
test('unapproved response is skipped and approved response remains dry-run', () => {
  const denied = simulate(workflows.soc, defaultParameters);
  assert.ok(!denied.some((e) => e.nodeId === 'respond'));
  const approved = simulate(workflows.soc, { ...defaultParameters, approved: true });
  assert.equal(approved.find((e) => e.nodeId === 'respond')?.output.executedExternally, false);
});
test('normal branch never reaches approval or response', () => {
  const events = simulate(workflows.soc, {
    ...defaultParameters,
    suspicious: false,
    approved: true,
  });
  assert.ok(!events.some((e) => e.nodeId === 'approval' || e.nodeId === 'respond'));
  assert.equal(events.at(-1)?.output.outcome, 'Closed — no rule match');
});
test('brute-force threshold changes the downstream branch', () => {
  const low = simulate(workflows.soc, {
    ...defaultParameters,
    scenario: 'bruteforce',
    threshold: 5,
  });
  const high = simulate(workflows.soc, {
    ...defaultParameters,
    scenario: 'bruteforce',
    threshold: 10,
  });
  assert.ok(low.some((e) => e.nodeId === 'approval'));
  assert.ok(!high.some((e) => e.nodeId === 'approval'));
});
test('all six SOC fixtures produce distinct evidence and explicit rules', () => {
  const evidence = new Set<string>();
  for (const scenario of Object.keys(scenarios)) {
    const e = simulate(workflows.soc, { ...defaultParameters, scenario });
    evidence.add(String(e[0].output.evidence));
    assert.ok(e.find((v) => v.nodeId === 'detect')?.output.rule);
  }
  assert.equal(evidence.size, 6);
});
test('enrichment failure retains uncertainty and respects bounded retries/timeouts', () => {
  const w = structuredClone(automationTemplate);
  const enrich = w.nodes.find((n) => n.op === 'enrich')!;
  enrich.retries = 2;
  enrich.timeoutMs = 50;
  const events = simulate(w, defaultParameters);
  const e = events.find((e) => e.nodeId === enrich.id)!;
  assert.equal(e.status, 'warning');
  assert.equal(e.output.attempts, 3);
  assert.equal(e.output.latencyMs, 50);
  assert.ok(!events.some((e) => e.nodeId === 'respond'));
});
test('KEV source data remains associated through the investigation', () => {
  const e = simulate(workflows.intel, defaultParameters, {
    cve: 'CVE-2021-44228',
    source: 'CISA KEV',
    requiredAction: 'Vendor mitigation',
  });
  assert.equal(e.at(-1)?.output.cve, 'CVE-2021-44228');
  assert.match(String(e.find((e) => e.nodeId === 'correlate')?.output.limits), /lab assumption/);
});
test('dangling edges, cycles, duplicate IDs and missing decision branches fail validation', () => {
  for (const mutate of [
    (w: typeof automationTemplate) => {
      w.edges[0].target = 'absent';
    },
    (w: typeof automationTemplate) => {
      w.edges.push({ id: 'cycle', source: 'audit', target: 'trigger', when: 'always' });
    },
    (w: typeof automationTemplate) => {
      w.nodes[1].id = w.nodes[0].id;
    },
    (w: typeof automationTemplate) => {
      w.edges = w.edges.filter((e) => !(e.source === 'approval' && e.when === 'no'));
    },
  ]) {
    const w = structuredClone(automationTemplate);
    mutate(w);
    assert.ok(validateWorkflow(w).errors.length);
  }
});
test('runtime contract failures stop execution before sensitive stages', () => {
  const w = structuredClone(automationTemplate);
  w.nodes.find((n) => n.id === 'parse')!.requires = ['missingEvidence'];
  const events = simulate(w, defaultParameters);
  assert.equal(events.at(-1)?.status, 'error');
  assert.equal(events.length, 2);
});
test('a custom graph cannot bypass approval to execute a response', () => {
  const w = structuredClone(automationTemplate);
  w.nodes = w.nodes.filter((n) => !['approval', 'decision'].includes(n.id));
  w.edges = w.edges.filter(
    (e) =>
      !['approval', 'decision'].includes(e.source) && !['approval', 'decision'].includes(e.target),
  );
  w.edges.push({ id: 'bypass', source: 'enrich', target: 'respond', when: 'always' });
  const events = simulate(w, { ...defaultParameters, approved: true });
  assert.equal(events.at(-1)?.status, 'error');
  assert.ok(!events.some((e) => e.output.executedExternally === true));
});
test('playback pauses, seeks, steps, rewinds and resets independently of event generation', () => {
  let s = { cursor: 0, playing: false, speed: 1 };
  s = playbackReducer(s, { type: 'play', length: 5 });
  assert.equal(s.playing, true);
  s = playbackReducer(s, { type: 'step', length: 5 });
  assert.equal(s.cursor, 1);
  s = playbackReducer(s, { type: 'pause' });
  assert.equal(s.playing, false);
  s = playbackReducer(s, { type: 'seek', value: 5, length: 5 });
  assert.equal(s.cursor, 5);
  assert.equal(s.playing, false);
  s = playbackReducer(s, { type: 'step', length: 5 });
  assert.equal(s.cursor, 5);
  s = playbackReducer(s, { type: 'reset' });
  assert.equal(s.cursor, 0);
  assert.equal(s.playing, false);
});
test('source payloads and previous event outputs are not mutated', () => {
  const source = { cve: 'CVE-2021-44228', nested: { v: 1 } };
  const e = simulate(workflows.intel, defaultParameters, source);
  e.at(-1)!.output.cve = 'changed';
  assert.equal(e[0].output.cve, source.cve);
  assert.equal(source.nested.v, 1);
});
test('topics have valid workflows and answer keys', () => {
  for (const t of topics) {
    assert.ok(workflows[t.workflow]);
    assert.ok(t.answers[t.correct]);
    assert.ok(t.concept.length > 60);
  }
});
test('KEV automation preserves the CVE and proposes remediation, never account containment', () => {
  const e = simulate(
    intelAutomationTemplate,
    { ...defaultParameters, approved: true },
    { cve: 'CVE-2021-44228', source: 'CISA KEV' },
  );
  assert.equal(e.at(-1)?.output.cve, 'CVE-2021-44228');
  assert.equal(e.at(-1)?.output.action, 'Dry-run remediation ticket prepared');
  assert.equal(e.at(-1)?.output.executedExternally, false);
});
test('declared output contracts are enforced', () => {
  const w = structuredClone(automationTemplate);
  w.nodes[0].produces = ['nonexistentField'];
  const events = simulate(w, defaultParameters);
  assert.equal(events.length, 1);
  assert.match(events[0].message, /Output contract failed/);
  assert.equal(events[0].status, 'error');
});
