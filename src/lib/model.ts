import { z } from 'zod';
export const operations = [
  'trigger',
  'parse',
  'collect',
  'siem',
  'detect',
  'alert',
  'enrich',
  'investigate',
  'decide',
  'approval',
  'respond',
  'notify',
  'audit',
  'dns',
  'syn',
  'synack',
  'ack',
  'hello',
  'certificate',
  'keys',
  'http',
  'source',
  'normalize',
  'correlate',
] as const;
export const NodeSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(60),
  title: z.string().min(1).max(90),
  op: z.enum(operations),
  description: z.string().max(1800),
  detail: z.string().max(2400),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  requires: z.array(z.string().max(50)).max(15).default([]),
  produces: z.array(z.string().max(50)).max(15).default([]),
  timeoutMs: z.number().int().min(1).max(30000).default(5000),
  retries: z.number().int().min(0).max(3).default(0),
});
export const WorkflowSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(60),
  version: z.number().int().positive(),
  title: z.string().min(1).max(120),
  domain: z.string().max(90),
  summary: z.string().max(1000),
  nodes: z.array(NodeSchema).min(2).max(50),
  edges: z
    .array(
      z.object({
        id: z.string().max(100),
        source: z.string(),
        target: z.string(),
        when: z.enum(['always', 'yes', 'no']).default('always'),
      }),
    )
    .min(1)
    .max(100),
  references: z.array(z.object({ title: z.string(), url: z.string().url() })).max(20),
});
export type Workflow = z.infer<typeof WorkflowSchema>;
export type CyberNode = z.infer<typeof NodeSchema>;
export type Payload = Record<string, unknown>;
export type SimEvent = {
  id: string;
  index: number;
  nodeId: string;
  time: string;
  input: Payload;
  output: Payload;
  message: string;
  status: 'complete' | 'warning' | 'error';
  edgeIds: string[];
};
export type Parameters = {
  suspicious: boolean;
  approved: boolean;
  certificateValid: boolean;
  firewallOpen: boolean;
  threshold: number;
  enrichmentFails: boolean;
  scenario: string;
};
export const defaultParameters: Parameters = {
  suspicious: true,
  approved: false,
  certificateValid: true,
  firewallOpen: true,
  threshold: 5,
  enrichmentFails: false,
  scenario: 'identity',
};
export const ThreatSchema = z.object({
  id: z.string(),
  source: z.string(),
  source_id: z.string(),
  type: z.enum(['CVE', 'IP', 'domain', 'hash', 'campaign', 'technique']),
  title: z.string(),
  summary: z.string(),
  references: z.array(z.string().url()),
  first_seen: z.string().nullable(),
  last_seen: z.string().nullable(),
  ingested_at: z.string(),
  confidence: z.string(),
  severity: z.string().nullable(),
  cvss: z.number().nullable(),
  epss: z.number().nullable(),
  affected_products: z.array(z.string()),
  techniques: z.array(z.string()),
  sharing: z.string(),
  raw_source: z.string().url(),
  required_action: z.string(),
  due_date: z.string().nullable(),
  ransomware: z.string().nullable(),
  catalog_added: z.string().optional(),
});
export type Threat = z.infer<typeof ThreatSchema>;
export type Feed = {
  items: Threat[];
  total: number;
  updatedAt: string | null;
  catalogVersion: string | null;
  status: 'live' | 'cached' | 'stale' | 'unavailable';
  upstream: string | null;
  error?: string;
  storage: 'postgresql' | 'process-memory';
  page: number;
  pages: number;
};
