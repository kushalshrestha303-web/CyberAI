'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Search,
  Radio,
  ArrowUpRight,
  RefreshCw,
  Bookmark,
  Shield,
  ChevronLeft,
  ChevronRight,
  Workflow,
  ExternalLink,
} from 'lucide-react';
import { api, useResource, useStore } from './store';
import { automationIdeas } from '@/lib/content';
import type { Feed, Threat } from '@/lib/model';
export function IntelFeed() {
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [since, setSince] = useState(''),
    [severity, setSeverity] = useState('all');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  const feed = useResource<Feed>(
    `/api/intel?q=${encodeURIComponent(search)}&page=${page}&since=${since}&severity=${severity}`,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PUBLIC SOURCES / VERIFIED PROVENANCE</div>
          <h1>
            Threat intelligence<span className="cyan-text">.</span>
          </h1>
          <p>Source evidence, with room for uncertainty. Never an invented risk score.</p>
        </div>
        <button className="button" onClick={feed.reload} disabled={feed.loading}>
          <RefreshCw size={16} className={feed.loading ? 'spin' : ''} /> Refresh view
        </button>
      </div>
      <div className="intel-toolbar panel">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search threats"
            placeholder="Search CVE, product or vulnerability…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="badge cyan">CISA KEV</span>
        <span className="badge">CVE</span>
        <label className="inline-field">
          Added since
          <input
            aria-label="Added since"
            type="date"
            value={since}
            onChange={(e) => {
              setSince(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Severity filter"
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All severity</option>
          <option value="unknown">Not provided by KEV</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
        </select>
      </div>
      <div className="feed-summary">
        <span>
          <span className={`tiny-dot ${feed.data?.status === 'stale' ? 'orange' : 'green'}`} />
          {feed.data?.status ?? 'Connecting'} <span className="muted">/</span>{' '}
          {feed.data?.total ?? '—'} matching records
        </span>
        <span>
          {feed.data?.updatedAt
            ? `Retrieved ${new Date(feed.data.updatedAt).toLocaleString()}`
            : 'Awaiting public source'}{' '}
          · {feed.data?.storage ?? '—'}
        </span>
      </div>
      {(feed.error || feed.data?.error) && (
        <div className="notice error">{feed.error || feed.data?.error}</div>
      )}
      <div className="notice subtle">
        KEV identifies known exploitation. Severity is not supplied by this catalog; optional NVD
        and EPSS enrichment stays separate. Other providers are available through explicit lookups
        in Settings.
      </div>
      {feed.loading && !feed.data ? (
        <div className="empty">
          <RefreshCw className="spin" />
          <h3>Contacting the public source</h3>
          <p>Validating and normalizing the catalog…</p>
        </div>
      ) : (
        <div className="threat-grid">
          {feed.data?.items.map((t) => (
            <ThreatCard key={t.id} threat={t} />
          ))}
        </div>
      )}
      {!feed.loading && !feed.data?.items.length && (
        <div className="empty panel">
          <Radio size={32} />
          <h3>No records to show</h3>
          <p>
            {feed.data?.status === 'unavailable'
              ? 'The provider is unavailable; there is no invented live fallback.'
              : 'Try a broader search or a different date/severity filter.'}
          </p>
        </div>
      )}
      <div className="pagination">
        <button
          className="button"
          disabled={page <= 1 || feed.loading}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span>
          Page {feed.data?.page ?? 1} of {feed.data?.pages ?? 1}
        </span>
        <button
          className="button"
          disabled={page >= (feed.data?.pages ?? 1) || feed.loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}
function ThreatCard({ threat: t }: { threat: Threat }) {
  const { data, update } = useStore(),
    saved = data.bookmarks.includes(t.id);
  return (
    <article className="panel threat-card">
      <div className="panel-top">
        <span className="mono cyan-text">{t.id}</span>
        <button
          aria-label={`${saved ? 'Remove bookmark for' : 'Bookmark'} ${t.id}`}
          className={`icon-button ${saved ? 'cyan-text' : ''}`}
          onClick={() =>
            update((d) => ({
              ...d,
              bookmarks: saved ? d.bookmarks.filter((id) => id !== t.id) : [...d.bookmarks, t.id],
            }))
          }
        >
          <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <Link href={`/intel/${t.id}`}>
        <h3>{t.title}</h3>
      </Link>
      <p>{t.summary}</p>
      <div className="product-tag">{t.affected_products[0]}</div>
      <div className="threat-card-bottom">
        <span className="badge orange">KNOWN EXPLOITATION</span>
        <Link className="text-link" href={`/intel/${t.id}`}>
          Inspect <ArrowUpRight size={14} />
        </Link>
      </div>
      <small className="muted">
        Catalog addition: {t.catalog_added ?? 'Unknown'} · Severity: unknown
      </small>
    </article>
  );
}
export function ThreatDetail({ id }: { id: string }) {
  const result = useResource<{ item: Threat; status: string; upstream: string; updatedAt: string }>(
    `/api/intel/${id}`,
  );
  const [provider, setProvider] = useState('epss'),
    [consent, setConsent] = useState(false),
    [enrichment, setEnrichment] = useState<unknown>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const t = result.data?.item;
  if (!t)
    return (
      <div className="empty panel">
        <Shield size={32} />
        <h2>{result.loading ? 'Loading source evidence…' : 'Record unavailable'}</h2>
        <p>{result.error}</p>
        <Link className="button" href="/intel">
          Back to intelligence
        </Link>
      </div>
    );
  const workflow = `/workflow/intel?threat=${encodeURIComponent(id)}`;
  return (
    <>
      <Link href="/intel" className="text-link back-link">
        <ChevronLeft size={14} /> Intelligence feed
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CISA KEV / {result.data?.status}</div>
          <h1 className="detail-title">{t.id}</h1>
          <p>{t.title}</p>
        </div>
        <Link className="button primary" href={workflow}>
          <Workflow size={16} /> Open in workflow <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="detail-grid">
        <section className="panel prose">
          <span className="eyebrow">SOURCE EVIDENCE</span>
          <h2>{t.title}</h2>
          <p>{t.summary}</p>
          <div className="notice">{t.confidence}</div>
          <h3>Affected product</h3>
          <p>{t.affected_products.join(', ')}</p>
          <h3>CISA required action</h3>
          <p>{t.required_action}</p>
          <dl className="facts">
            <div>
              <dt>Catalog added</dt>
              <dd>{t.catalog_added ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>CISA due date</dt>
              <dd>{t.due_date ?? 'Not supplied'}</dd>
            </div>
            <div>
              <dt>Ransomware campaign use</dt>
              <dd>{t.ransomware ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>CVSS severity</dt>
              <dd>Not supplied by KEV</dd>
            </div>
            <div>
              <dt>EPSS likelihood</dt>
              <dd>Requires separate enrichment</dd>
            </div>
            <div>
              <dt>ATT&CK techniques</dt>
              <dd>No verified mapping supplied</dd>
            </div>
            <div>
              <dt>First / last observed</dt>
              <dd>Not provided by source</dd>
            </div>
            <div>
              <dt>Retrieved</dt>
              <dd>{new Date(t.ingested_at).toLocaleString()}</dd>
            </div>
          </dl>
          <p className="muted">
            The CISA due date is a source policy context, not an automatic deadline for every
            organization.
          </p>
          <h3>References & provenance</h3>
          {t.references.map((url) => (
            <a className="source-link" href={url} key={url} target="_blank" rel="noreferrer">
              {new URL(url).hostname}
              <ExternalLink size={13} />
            </a>
          ))}
          <a className="source-link" href={result.data!.upstream} target="_blank" rel="noreferrer">
            Retrieved source JSON <ExternalLink size={13} />
          </a>
        </section>
        <aside className="detail-side">
          <section className="panel prose">
            <span className="eyebrow">INVESTIGATE WITH CONTEXT</span>
            <h3>Turn evidence into understanding.</h3>
            <p>
              Carry this record into a conceptual investigation. Asset matches and response actions
              remain synthetic.
            </p>
            <Link className="button full" href={`${workflow}&explain=1`}>
              Explain this threat <ArrowUpRight size={16} />
            </Link>
            <Link className="button full" href={workflow}>
              Defensive investigation <ArrowUpRight size={16} />
            </Link>
            <Link className="button full" href={`/automation?threat=${id}`}>
              Suggest automation <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="panel prose">
            <span className="eyebrow">OPTIONAL ENRICHMENT</span>
            <h3>Keep the measures separate.</h3>
            <label>
              Provider
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="epss">FIRST · EPSS likelihood</option>
                <option value="nvd">NVD · CVE / CVSS</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{' '}
              I authorize sending this public CVE identifier to the selected provider.
            </label>
            <button
              className="button"
              disabled={!consent || busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  setEnrichment(
                    await api('/api/lookup', { provider, type: 'CVE', value: id, consent }),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Requesting…' : 'Request enrichment'}
            </button>
            {error && <div className="notice error">{error}</div>}
            {enrichment !== null && <pre>{JSON.stringify(enrichment, null, 2)}</pre>}
            <p className="muted small">
              Requires a signed-in workspace, enabled lookups and shared quotas.
            </p>
          </section>
        </aside>
      </div>
      <AutomationIdeas topic="intel" />
    </>
  );
}
export function AutomationIdeas({ topic = 'intel' }: { topic?: string }) {
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">DEFENSIVE AUTOMATION</span>
          <h2>Three practical next steps.</h2>
        </div>
      </div>
      <div className="learning-grid">
        {automationIdeas(topic).map((idea, i) => (
          <article key={idea.title} className="panel idea-card">
            <span className="card-index">
              0{i + 1}
              <Workflow size={20} />
            </span>
            <h3>{idea.title}</h3>
            <p>{idea.value}</p>
            <details>
              <summary>Inspect proposal</summary>
              <dl>
                {Object.entries(idea)
                  .filter(([k]) => !['title', 'value'].includes(k))
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
            </details>
            <Link className="text-link" href="/automation">
              Open safe template <ArrowUpRight size={14} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
