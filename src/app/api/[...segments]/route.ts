import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db, audit } from '@/server/db';
import { readUserState, writeUserState } from '@/server/state';
import { kevFeed } from '@/server/feeds';
import { providerStatus, lookup } from '@/server/providers';
import { mentor } from '@/server/mentor';
import {
  HttpError,
  currentUser,
  requireUser,
  originCheck,
  quota,
  login,
  sessionName,
  digest,
} from '@/server/security';
import { validateWorkflow } from '@/lib/engine';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ segments: string[] }> };
const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
function failure(e: unknown) {
  if (e instanceof HttpError) return respond({ error: e.message }, e.status);
  if (e instanceof z.ZodError)
    return respond(
      {
        error: 'Invalid request.',
        details: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      },
      400,
    );
  console.error('API operation failed:', e instanceof Error ? e.name : 'UnknownError');
  return respond(
    { error: 'The service is unavailable. Check server configuration and try again.' },
    503,
  );
}
async function body(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 150000)
    throw new HttpError(413, 'Request too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'JSON body required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 150000) {
      await reader.cancel();
      throw new HttpError(413, 'Request too large.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}
export async function GET(request: Request, context: Context) {
  try {
    const path = (await context.params).segments.join('/'),
      url = new URL(request.url);
    if (path === 'health')
      return respond({
        ok: true,
        version: '2.0.0',
        database: db() ? 'configured · unverified' : 'not configured',
        mode: 'learning + public intelligence',
      });
    if (path === 'auth/session')
      return respond({ user: await currentUser(), databaseConfigured: Boolean(db()) });
    if (path === 'providers') return respond({ providers: await providerStatus() });
    if (path === 'intel') {
      const feed = await kevFeed();
      const q = (url.searchParams.get('q') ?? '').slice(0, 120).toLowerCase(),
        since = url.searchParams.get('since') ?? '',
        severity = url.searchParams.get('severity') ?? 'all';
      const filtered = feed.items.filter(
        (t) =>
          (!q || `${t.id} ${t.title} ${t.affected_products.join(' ')}`.toLowerCase().includes(q)) &&
          (!since || (t.catalog_added ?? '') >= since) &&
          (severity === 'all' ||
            (severity === 'unknown' && !t.severity) ||
            t.severity?.toLowerCase() === severity),
      );
      const page = Math.max(
        1,
        Math.min(
          Number(url.searchParams.get('page')) || 1,
          Math.max(1, Math.ceil(filtered.length / 24)),
        ),
      );
      return respond({
        ...feed,
        items: filtered.slice((page - 1) * 24, page * 24),
        total: filtered.length,
        page,
        pages: Math.max(1, Math.ceil(filtered.length / 24)),
      });
    }
    if (path.startsWith('intel/')) {
      const id = z
        .string()
        .regex(/^CVE-\d{4}-\d{4,10}$/)
        .parse(path.slice(6));
      const feed = await kevFeed();
      const item = feed.items.find((t) => t.id === id);
      if (!item)
        throw new HttpError(
          feed.status === 'unavailable' ? 503 : 404,
          'This record is not available in the current catalog.',
        );
      return respond({
        item,
        status: feed.status,
        upstream: feed.upstream,
        updatedAt: feed.updatedAt,
      });
    }
    if (path === 'cron/ingest') {
      const secret = process.env.CRON_SECRET;
      if (
        !secret ||
        secret.length < 32 ||
        request.headers.get('authorization') !== `Bearer ${secret}`
      )
        throw new HttpError(401, 'Unauthorized cron request.');
      if (!db()) throw new HttpError(503, 'Scheduled ingestion requires PostgreSQL.');
      await quota('cron:ingest', 2, 3600, true);
      const feed = await kevFeed(true);
      await db()!.query('DELETE FROM sessions WHERE expires_at<now()');
      await db()!.query('DELETE FROM rate_buckets WHERE expires_at<now()');
      await db()!.query(
        "DELETE FROM provider_cache WHERE key LIKE 'lookup:%' AND updated_at<now()-interval '7 days'",
      );
      return respond(
        { status: feed.status, total: feed.total, updatedAt: feed.updatedAt },
        feed.status === 'unavailable' || feed.status === 'stale' ? 502 : 200,
      );
    }
    if (path === 'state') {
      const u = await requireUser();
      return respond(await readUserState(u));
    }
    if (path === 'admin') {
      const u = await requireUser(true);
      const result = await db()!.query(
        'SELECT action,metadata,created_at FROM audit_log WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50',
        [u.tenant_id],
      );
      return respond({ audit: result.rows, providers: await providerStatus() });
    }
    throw new HttpError(404, 'API route not found.');
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    originCheck(request);
    const path = (await context.params).segments.join('/');
    if (path === 'auth/login') {
      const data = z
        .object({
          email: z
            .string()
            .email()
            .max(254)
            .transform((s) => s.toLowerCase().trim()),
          password: z.string().min(1).max(256),
        })
        .parse(await body(request));
      await login(data.email, data.password);
      const u = await requireUser();
      await audit(u, 'login', {});
      return respond({ user: u });
    }
    if (path === 'auth/logout') {
      const token = (await cookies()).get(sessionName())?.value;
      if (token && db())
        await db()!.query('DELETE FROM sessions WHERE token_hash=$1', [digest(token)]);
      (await cookies()).delete(sessionName());
      return respond({ ok: true });
    }
    if (path === 'mentor') {
      await quota('mentor:global', 120, 60);
      return respond(await mentor(await body(request), await currentUser()));
    }
    if (path === 'lookup') {
      const u = await requireUser();
      const data = z
        .object({
          provider: z.string().max(30),
          type: z.string().max(20),
          value: z.string().max(253),
          consent: z.boolean(),
        })
        .parse(await body(request));
      return respond(await lookup(u, data.provider, data.type, data.value, data.consent));
    }
    if (path === 'state') {
      const u = await requireUser();
      await quota(`state:${u.id}`, 60, 60, true);
      const data = z
        .object({
          completed: z.array(z.string().max(60)).max(100),
          bookmarks: z.array(z.string().max(60)).max(500),
          workflows: z.array(z.unknown()).max(20),
          history: z
            .array(
              z.object({
                id: z.string().max(80),
                title: z.string().max(120),
                at: z.string().max(40),
                steps: z.number().int().min(0).max(50),
                outcome: z.string().max(300),
              }),
            )
            .max(30),
        })
        .parse(await body(request));
      for (const w of data.workflows)
        if (validateWorkflow(w).errors.length)
          throw new HttpError(400, 'Saved workflow is invalid.');
      await writeUserState(u, data);
      await audit(u, 'learning-state-saved', {
        completed: data.completed.length,
        workflows: data.workflows.length,
      });
      return respond({ ok: true });
    }
    throw new HttpError(404, 'API route not found.');
  } catch (e) {
    return failure(e);
  }
}
