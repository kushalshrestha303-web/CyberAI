import {
  WorkflowSchema,
  type Workflow,
  type Payload,
  type SimEvent,
  type Parameters,
} from './model';

export function validateWorkflow(raw: unknown): { workflow?: Workflow; errors: string[] } {
  const parsed = WorkflowSchema.safeParse(raw);
  if (!parsed.success)
    return { errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  const w = parsed.data,
    ids = new Set(w.nodes.map((n) => n.id)),
    errors: string[] = [];
  if (ids.size !== w.nodes.length) errors.push('Node IDs must be unique.');
  if (new Set(w.edges.map((e) => e.id)).size !== w.edges.length)
    errors.push('Edge IDs must be unique.');
  for (const e of w.edges)
    if (!ids.has(e.source) || !ids.has(e.target)) errors.push(`Dangling edge: ${e.id}`);
  const roots = w.nodes.filter((n) => !w.edges.some((e) => e.target === n.id));
  if (roots.length !== 1) errors.push('A workflow must have exactly one entry node.');
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) {
      errors.push('Cycles are not allowed in bounded dry runs.');
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    w.edges.filter((e) => e.source === id).forEach((e) => visit(e.target));
    visiting.delete(id);
    visited.add(id);
  }
  if (roots[0]) visit(roots[0].id);
  if (visited.size !== ids.size) errors.push('Every node must be reachable from the entry.');
  for (const n of w.nodes) {
    const out = w.edges.filter((e) => e.source === n.id);
    if (
      out.length > 1 &&
      (out.some((e) => e.when === 'always') || new Set(out.map((e) => e.when)).size !== out.length)
    )
      errors.push(`${n.title}: use one yes and one no branch, or a single always edge.`);
    if (
      ['decide', 'approval', 'certificate', 'syn'].includes(n.op) &&
      !(out.some((e) => e.when === 'yes') && out.some((e) => e.when === 'no'))
    )
      errors.push(`${n.title}: both yes and no branches are required.`);
  }
  return { workflow: errors.length ? undefined : w, errors: [...new Set(errors)] };
}

export const scenarios: Record<
  string,
  {
    title: string;
    source: string;
    field: string;
    value: string;
    detection: string;
    evidence: string;
  }
> = {
  identity: {
    title: 'Cloud identity compromise',
    source: 'Entra sign-in (synthetic)',
    field: 'newDevice',
    value: 'true',
    detection: 'Unfamiliar device with repeated failures; corroborate with MFA and user context.',
    evidence: '8 failed sign-ins followed by a success from an unfamiliar device.',
  },
  phishing: {
    title: 'Phishing investigation',
    source: 'Mail gateway (synthetic)',
    field: 'senderAlignment',
    value: 'fail',
    detection:
      'SPF/DKIM alignment failure plus credential-page report; no verdict from one signal.',
    evidence: 'User-reported message, failed alignment, and a synthetic credential URL.',
  },
  powershell: {
    title: 'Suspicious PowerShell',
    source: 'Endpoint process log (synthetic)',
    field: 'encodedCommand',
    value: 'true',
    detection:
      'Encoded command with unusual parent process; inspect content and authorized task context.',
    evidence: 'A word processor starts PowerShell with an encoded argument; content omitted.',
  },
  bruteforce: {
    title: 'Brute-force authentication',
    source: 'Authentication log (synthetic)',
    field: 'failureCount',
    value: '8',
    detection:
      'Failed sign-ins exceed the configured demonstration threshold within a five-minute window.',
    evidence: '8 failures for one synthetic account in a five-minute window.',
  },
  exfiltration: {
    title: 'Possible data exfiltration',
    source: 'Proxy egress log (synthetic)',
    field: 'unusualUpload',
    value: 'true',
    detection:
      'Unusual outbound transfer plus new destination; validate business purpose and byte baseline.',
    evidence: 'A synthetic endpoint uploads 800 MB to a new destination after hours.',
  },
  ransomware: {
    title: 'Ransomware precursor',
    source: 'EDR behavior event (synthetic)',
    field: 'recoveryTampering',
    value: 'true',
    detection:
      'Recovery configuration change with unusual process ancestry; verify authorized maintenance.',
    evidence: 'Synthetic recovery-setting tampering followed by a burst of file renames.',
  },
};

export function simulate(workflow: Workflow, p: Parameters, threat?: Payload): SimEvent[] {
  const valid = validateWorkflow(workflow);
  if (valid.errors.length) throw new Error(valid.errors.join(' '));
  const root = workflow.nodes.find((n) => !workflow.edges.some((e) => e.target === n.id))!;
  let current: string | undefined = root.id,
    data: Payload = { mode: 'simulation', scenario: p.scenario },
    ticks = 0;
  const events: SimEvent[] = [],
    scenario = scenarios[p.scenario] ?? scenarios.identity;
  while (current && ticks < 50) {
    const node = workflow.nodes.find((n) => n.id === current)!;
    const input = structuredClone(data);
    let message = node.description,
      decision = true,
      status: SimEvent['status'] = 'complete';
    const missing = node.requires.filter((k) => !(k in data));
    if (missing.length) {
      events.push({
        id: `${workflow.id}-${ticks}`,
        index: ticks,
        nodeId: node.id,
        time: new Date(Date.UTC(2026, 0, 1, 9, 0, ticks)).toISOString(),
        input,
        output: { ...data, error: `Missing contract fields: ${missing.join(', ')}` },
        message: 'Input contract failed. Execution stopped.',
        status: 'error',
        edgeIds: [],
      });
      break;
    }
    switch (node.op) {
      case 'trigger':
        data = {
          ...data,
          eventId: 'SYN-1001',
          user: 'alex@example.test',
          ip: '192.0.2.42',
          source: scenario.source,
          failureCount: p.suspicious ? 8 : 1,
          [scenario.field]: p.suspicious ? scenario.value : 'normal',
          evidence: p.suspicious ? scenario.evidence : 'Expected activity from a familiar context.',
        };
        break;
      case 'parse':
        data = { ...data, normalized: true, timestamp: '2026-01-01T09:00:00Z' };
        break;
      case 'collect':
        data = { ...data, collected: true, scope: 'Authorized synthetic lab only' };
        break;
      case 'siem':
        data = {
          ...data,
          index: 'lab-events',
          query:
            p.scenario === 'bruteforce'
              ? 'where failureCount >= threshold'
              : `where ${scenario.field} != "normal"`,
        };
        break;
      case 'detect':
        data = {
          ...data,
          rule: scenario.detection,
          matched:
            p.scenario === 'bruteforce' ? Number(data.failureCount) >= p.threshold : p.suspicious,
          threshold: p.threshold,
        };
        break;
      case 'alert':
        data = {
          ...data,
          alert: data.matched ? 'LAB-ALERT-1001' : null,
          severity: data.matched ? 'Review required' : 'Informational',
        };
        break;
      case 'enrich': {
        const failed = p.enrichmentFails || node.timeoutMs < 100;
        data = {
          ...data,
          enrichment: failed ? 'unavailable' : 'Local context attached',
          attempts: failed ? node.retries + 1 : 1,
          latencyMs: Math.min(100, node.timeoutMs),
        };
        if (failed) {
          status = 'warning';
          message =
            'Enrichment unavailable after bounded attempts. Preserve uncertainty; manual review remains required.';
        }
        break;
      }
      case 'investigate':
        data = {
          ...data,
          analystReview:
            'Check asset ownership, source evidence, relevant logs and false-positive explanations.',
          confidence: 'Insufficient evidence for automatic containment',
        };
        break;
      case 'decide':
        decision = Boolean(data.matched ?? data.affected);
        data = {
          ...data,
          decision: decision ? 'review' : 'no action',
          reason: decision
            ? 'Demonstration rule matched; human authorization required.'
            : 'No supporting match in this scenario.',
        };
        break;
      case 'approval':
        decision = p.approved;
        data = { ...data, approved: p.approved, approvalScope: 'Simulation only' };
        if (!decision) {
          status = 'warning';
          message = 'Approval withheld. No response action is permitted.';
        }
        break;
      case 'respond':
        if (data.approved !== true) {
          status = 'error';
          message = 'Response blocked: missing approval.';
          data = { ...data, action: 'blocked' };
        } else
          data = {
            ...data,
            action:
              data.cve || workflow.id.includes('intel')
                ? 'Dry-run remediation ticket prepared'
                : 'Dry-run containment proposal prepared',
            executedExternally: false,
          };
        break;
      case 'notify':
        data = { ...data, notification: 'Preview only; no message sent' };
        break;
      case 'audit':
        data = {
          ...data,
          outcome:
            data.action ??
            (data.failed
              ? 'Connection failed'
              : data.decision === 'no action'
                ? 'Closed — no rule match'
                : 'Recorded; no external action'),
          auditId: `LAB-${workflow.id}-1001`,
        };
        break;
      case 'dns':
        data = {
          ...data,
          hostname: 'training.example.test',
          address: '192.0.2.10',
          resolution: 'Conceptual resolver response; no DNS request sent',
        };
        break;
      case 'syn':
        decision = p.firewallOpen;
        data = { ...data, segment: 'SYN', seq: 1000, port: 443, allowed: decision };
        if (!decision) {
          data.failed = true;
          status = 'warning';
          message =
            'Firewall drops the SYN; the client would retransmit until timeout. No connection is established.';
        }
        break;
      case 'synack':
        data = { ...data, segment: 'SYN, ACK', serverSeq: 7000, ack: 1001 };
        break;
      case 'ack':
        data = { ...data, segment: 'ACK', clientSeq: 1001, ack: 7001, tcpState: 'ESTABLISHED' };
        break;
      case 'hello':
        data = {
          ...data,
          tlsVersion: '1.3',
          messages: ['ClientHello + key_share', 'ServerHello + key_share'],
          note: 'Simplified full TLS 1.3 handshake; resumption and 0-RTT are excluded.',
        };
        break;
      case 'certificate':
        decision = p.certificateValid;
        data = {
          ...data,
          certificateValid: decision,
          checks: ['Trust chain', 'Hostname', 'Validity', 'CertificateVerify signature'],
          messages: ['EncryptedExtensions', 'Certificate', 'CertificateVerify', 'Finished'],
        };
        if (!decision) {
          data.failed = true;
          status = 'error';
          message =
            'Certificate validation failed. Abort before application data; never bypass verification.';
        }
        break;
      case 'keys':
        data = {
          ...data,
          keyDerivation: '(EC)DHE shared secret + HKDF transcript-based key schedule',
          clientFinished: true,
          applicationTrafficKeys: 'Established; no private key is transmitted',
        };
        break;
      case 'http':
        data = {
          ...data,
          applicationData: 'Encrypted HTTP request and response',
          confidentiality: true,
          note: 'Metadata such as peer addresses and timing remains observable.',
        };
        break;
      case 'source':
        data = {
          ...data,
          mode: threat ? 'public-intelligence / conceptual workflow' : 'simulation',
          ...threat,
          provenance:
            threat?.source ?? 'Synthetic fixture; choose a live KEV entry for source evidence',
        };
        break;
      case 'normalize':
        data = {
          ...data,
          normalized: true,
          distinction:
            'KEV confirms exploitation reported by CISA, not compromise of your organization.',
        };
        break;
      case 'correlate':
        data = {
          ...data,
          affected: p.suspicious,
          assetMatch: p.suspicious
            ? 'Hypothetical affected product in synthetic inventory'
            : 'No match in synthetic inventory',
          limits: 'Asset correlation is a lab assumption; no customer telemetry is connected.',
        };
        break;
    }
    const missingOutputs = node.produces.filter((key) => !(key in data));
    if (missingOutputs.length) {
      status = 'error';
      message = `Output contract failed: ${missingOutputs.join(', ')}`;
      data = { ...data, contractError: true };
    }
    const choices = workflow.edges.filter((e) => e.source === current);
    const edge = choices.find((e) => e.when === 'always' || e.when === (decision ? 'yes' : 'no'));
    events.push({
      id: `${workflow.id}-${ticks}`,
      index: ticks,
      nodeId: node.id,
      time: new Date(Date.UTC(2026, 0, 1, 9, 0, ticks)).toISOString(),
      input,
      output: structuredClone(data),
      message,
      status,
      edgeIds: edge ? [edge.id] : [],
    });
    if (status === 'error' && (node.op === 'respond' || data.contractError)) break;
    current = edge?.target;
    ticks++;
  }
  return events;
}

export type Playback = { cursor: number; playing: boolean; speed: number };
export function playbackReducer(
  s: Playback,
  a: {
    type: 'play' | 'pause' | 'reset' | 'step' | 'seek' | 'speed';
    value?: number;
    length?: number;
  },
): Playback {
  const length = a.length ?? Infinity;
  if (a.type === 'reset') return { ...s, cursor: 0, playing: false };
  if (a.type === 'pause') return { ...s, playing: false };
  if (a.type === 'play') return { ...s, playing: s.cursor < length };
  if (a.type === 'speed') return { ...s, speed: Math.max(0.5, Math.min(4, a.value ?? 1)) };
  const cursor = Math.max(0, Math.min(length, a.type === 'step' ? s.cursor + 1 : (a.value ?? 0)));
  return { ...s, cursor, playing: a.type === 'seek' ? false : s.playing && cursor < length };
}
