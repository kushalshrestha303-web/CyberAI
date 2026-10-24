'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import {
  ArrowUpRight,
  GraduationCap,
  Check,
  Search,
  Shield,
  Download,
  Cloud,
  RefreshCw,
  LogOut,
  Database,
  Radio,
  Bookmark,
  Workflow,
} from 'lucide-react';
import { topics } from '@/lib/content';
import { api, download, useResource, useStore, type LearningData } from './store';
type Provider = {
  id: string;
  name: string;
  purpose: string;
  url: string;
  status: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  message: string;
};
export function Universe() {
  const [search, setSearch] = useState(''),
    [selected, setSelected] = useState('soc');
  const t = topics.find((t) => t.id === selected)!;
  const nodes = useMemo(
    () => [
      {
        id: 'center',
        position: { x: 440, y: 320 },
        data: { label: 'CYBER UNIVERSE' },
        style: {
          background: '#0a2531',
          color: '#00e5ff',
          border: '1px solid #00e5ff',
          borderRadius: 50,
          width: 180,
          padding: 24,
          fontWeight: 700,
        },
      },
      ...topics.map((t, i) => {
        const angle = (i / topics.length) * Math.PI * 2;
        return {
          id: t.id,
          position: { x: 440 + Math.cos(angle) * 440, y: 320 + Math.sin(angle) * 310 },
          data: { label: t.title },
          style: {
            background: selected === t.id ? '#183040' : '#111b29',
            color: '#d6e5f2',
            border: `1px solid ${selected === t.id ? '#00e5ff' : '#35485b'}`,
            borderRadius: 12,
            width: 190,
            padding: 16,
            opacity:
              !search || `${t.title} ${t.domain}`.toLowerCase().includes(search.toLowerCase())
                ? 1
                : 0.2,
          },
        };
      }),
    ],
    [selected, search],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONNECTED KNOWLEDGE / 12 FOUNDATIONAL TOPICS</div>
          <h1>
            Cyber universe<span className="cyan-text">.</span>
          </h1>
          <p>Find a concept. Follow its connections. Watch the system work.</p>
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search topics"
            placeholder="Find a topic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="universe-layout">
        <div className="panel universe-canvas">
          <ReactFlow
            nodes={nodes}
            edges={topics.map((t) => ({
              id: `center-${t.id}`,
              source: 'center',
              target: t.id,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: t.id === selected ? '#00e5ff' : '#304250' },
            }))}
            onNodeClick={(_, n) => {
              if (n.id !== 'center') setSelected(n.id);
            }}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            colorMode="dark"
            nodesDraggable={false}
          >
            <Background color="#213346" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <aside className="panel prose">
          <span className="eyebrow">{t.domain}</span>
          <h2>{t.title}</h2>
          <span className="badge cyan">{t.level}</span>
          <p>{t.concept}</p>
          <h3>Evidence to inspect</h3>
          <p>{t.evidence}</p>
          <h3>Connected workflow</h3>
          <p>
            {t.workflow === 'soc'
              ? 'Identity → collection → detection → investigation → response'
              : t.workflow === 'tls'
                ? 'DNS → TCP → TLS → encrypted application data'
                : t.workflow === 'tcp'
                  ? 'SYN → SYN-ACK → ACK'
                  : 'Source → normalization → correlation → review'}
          </p>
          <Link className="button primary full" href={`/learn/${t.id}`}>
            Enter learning workspace <ArrowUpRight size={15} />
          </Link>
        </aside>
      </div>
      <div className="topic-chips">
        {topics
          .filter((t) => `${t.title} ${t.domain}`.toLowerCase().includes(search.toLowerCase()))
          .map((t) => (
            <button
              className={selected === t.id ? 'selected' : ''}
              key={t.id}
              onClick={() => setSelected(t.id)}
            >
              {t.title}
            </button>
          ))}
      </div>
    </>
  );
}
const paths = [
  {
    title: 'SOC analyst',
    description: 'Turn signals into defensible decisions.',
    ids: ['tcp', 'logs', 'identity', 'soc', 'intel', 'automation'],
  },
  {
    title: 'Security engineer',
    description: 'Understand the systems you protect.',
    ids: ['tcp', 'tls', 'web', 'cloud', 'governance'],
  },
  {
    title: 'Automation engineer',
    description: 'Build safe, inspectable response chains.',
    ids: ['logs', 'identity', 'soc', 'automation', 'ai-security'],
  },
  {
    title: 'Incident responder',
    description: 'Follow evidence from event to resolution.',
    ids: ['endpoint', 'logs', 'soc', 'intel', 'governance'],
  },
];
export function Academy() {
  const { data } = useStore();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">BUILD UNDERSTANDING / PROVE IT IN THE LAB</div>
          <h1>
            Learning academy<span className="cyan-text">.</span>
          </h1>
          <p>Progress follows completed workflows and knowledge checks.</p>
        </div>
        <span className="badge green">
          {data.completed.length} of {topics.length} lessons complete
        </span>
      </div>
      <div className="path-grid">
        {paths.map((path, i) => {
          const completed = path.ids.filter((id) => data.completed.includes(id)).length;
          return (
            <section key={path.title} className="panel path-card">
              <div className="card-index">
                0{i + 1}
                <GraduationCap size={24} />
              </div>
              <h2>{path.title}</h2>
              <p>{path.description}</p>
              <div className="progress-track">
                <span style={{ width: `${(completed / path.ids.length) * 100}%` }} />
              </div>
              <span className="small muted">
                {completed}/{path.ids.length} completed · Recommended sequence
              </span>
              <ol className="path-steps">
                {path.ids.map((id, index) => {
                  const t = topics.find((t) => t.id === id)!;
                  return (
                    <li key={id}>
                      <Link href={`/learn/${id}`}>
                        <span
                          className={
                            data.completed.includes(id) ? 'step-number done' : 'step-number'
                          }
                        >
                          {data.completed.includes(id) ? <Check size={13} /> : index + 1}
                        </span>
                        <span>
                          {t.title}
                          <small>
                            {t.minutes} minutes · {t.level}
                          </small>
                        </span>
                        <ArrowUpRight size={14} />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </>
  );
}
export function Projects() {
  const { data } = useStore();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORK / DEVICE-LOCAL UNLESS SYNCED</div>
          <h1>
            Saved projects<span className="cyan-text">.</span>
          </h1>
          <p>Playbooks, source bookmarks and the traces of your learning.</p>
        </div>
        <button
          className="button"
          onClick={() =>
            download('cyber-ai-learning-portfolio.json', {
              ...data,
              exportedAt: new Date().toISOString(),
              disclaimer:
                'Self-directed educational progress; not an accredited qualification. All executions are dry runs.',
            })
          }
        >
          <Download size={15} /> Export portfolio
        </button>
      </div>
      <div className="settings-grid">
        <section className="panel prose">
          <h2>
            <Workflow size={21} /> Playbooks
          </h2>
          {data.workflows.length ? (
            data.workflows.map((w) => (
              <div className="saved-row" key={`${w.id}-${w.version}`}>
                <div>
                  <strong>{w.title}</strong>
                  <small>
                    v{w.version} · {w.nodes.length} nodes
                  </small>
                </div>
                <button className="button small" onClick={() => download(`${w.id}.json`, w)}>
                  Export
                </button>
              </div>
            ))
          ) : (
            <p>No saved playbooks yet. Build and save one in the architect.</p>
          )}
          <Link className="text-link" href="/automation">
            Open architect <ArrowUpRight size={14} />
          </Link>
        </section>
        <section className="panel prose">
          <h2>
            <Bookmark size={21} /> Intelligence bookmarks
          </h2>
          {data.bookmarks.length ? (
            data.bookmarks.map((id) => (
              <Link key={id} className="saved-row" href={`/intel/${id}`}>
                {id}
                <ArrowUpRight size={14} />
              </Link>
            ))
          ) : (
            <p>Bookmark a CVE from the intelligence feed to return to its evidence.</p>
          )}
          <Link className="text-link" href="/intel">
            Explore intelligence <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>
      <section className="panel prose">
        <h2>Execution history</h2>
        <p className="muted">
          Completed dry-run summaries. Download a full event trace from the workflow before
          resetting it.
        </p>
        {data.history.length ? (
          data.history.map((h) => (
            <div className="history-row" key={h.id}>
              <div>
                <strong>{h.title}</strong>
                <small>
                  {new Date(h.at).toLocaleString()} · {h.steps} steps
                </small>
              </div>
              <span>{h.outcome}</span>
              <span className="badge orange">DRY RUN</span>
            </div>
          ))
        ) : (
          <div className="empty">
            <Shield />
            <p>Complete an automation dry run to record its outcome here.</p>
          </div>
        )}
      </section>
    </>
  );
}
export function SettingsScreen() {
  const store = useStore(),
    providers = useResource<{ providers: Provider[] }>('/api/providers');
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [lookupProvider, setLookupProvider] = useState('epss'),
    [type, setType] = useState('CVE'),
    [value, setValue] = useState(''),
    [consent, setConsent] = useState(false),
    [result, setResult] = useState<unknown>(null);
  async function operation(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORKSPACE / CONNECTIONS / CONTROLS</div>
          <h1>
            Settings<span className="cyan-text">.</span>
          </h1>
          <p>Configure a real workspace, or keep exploring with device-local learning.</p>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="settings-grid">
        <section className="panel prose">
          <h2>
            <Shield size={22} /> Account & access
          </h2>
          {store.user ? (
            <>
              <p>
                Signed in as <strong>{store.user.email}</strong>.
              </p>
              <span className="badge cyan">{store.user.role}</span>{' '}
              <span className="badge">{store.user.plan}</span>
              <p>Server quotas follow the assigned plan. Billing is not connected.</p>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void operation(async () => {
                    await api('/api/auth/logout', {});
                    window.location.reload();
                  })
                }
              >
                <LogOut size={15} /> Sign out
              </button>
              {store.user.role === 'admin' && (
                <Link className="button" href="/admin">
                  Administration
                </Link>
              )}
            </>
          ) : (
            <>
              <p>
                Guest mode keeps learning and playbooks in this browser. Accounts require PostgreSQL
                and a seeded administrator.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void operation(async () => {
                    await api('/api/auth/login', { email, password });
                    window.location.reload();
                  });
                }}
              >
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={256}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  Sign in to workspace
                </button>
              </form>
              <p className="small muted">
                No default account or password is included. Setup instructions are in the source
                package.
              </p>
            </>
          )}
        </section>
        <section className="panel prose">
          <h2>
            <Cloud size={22} /> Your learning data
          </h2>
          <p>
            Guest and signed-in device storage are separate. Cloud operations only access the
            authenticated user and tenant.
          </p>
          <button
            className="button full"
            disabled={!store.user || busy}
            onClick={() =>
              void operation(async () => {
                await api('/api/state', store.data);
                store.notify('Learning state saved to your authenticated workspace.');
              })
            }
          >
            Save device state to cloud
          </button>
          <button
            className="button full"
            disabled={!store.user || busy}
            onClick={() =>
              void operation(async () => {
                const r = await api<{ data: LearningData | null }>('/api/state');
                if (r.data) {
                  store.update(() => r.data!);
                  store.notify('Loaded your cloud learning state.');
                } else store.notify('No cloud state has been saved yet.');
              })
            }
          >
            Load cloud state onto this device
          </button>
          <button
            className="button full"
            onClick={() => download('cyber-ai-backup.json', store.data)}
          >
            <Download size={15} /> Export device backup
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={store.quiet}
              onChange={(e) => store.setQuiet(e.target.checked)}
            />{' '}
            Low-motion performance mode
          </label>
          <p className="small muted">
            System reduced-motion preferences are also respected. No real telemetry uploads are
            supported in this release.
          </p>
        </section>
      </div>
      <section className="panel prose">
        <div className="panel-top">
          <div>
            <span className="eyebrow">PROVIDER HEALTH</span>
            <h2>Connections with evidence.</h2>
          </div>
          <button className="button small" onClick={providers.reload}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <p>
          Configured keys alone never mean connected. Last success is recorded only after a
          validated upstream response. CISA feed status also appears on the intelligence page.
        </p>
        {providers.error && <div className="notice error">{providers.error}</div>}
        <div className="provider-grid">
          {providers.data?.providers.map((p) => (
            <article key={p.id} className="provider-card">
              <div className="panel-top">
                <Radio size={20} />
                <span
                  className={`badge ${p.status === 'connected' ? 'green' : p.status === 'error' ? 'orange' : ''}`}
                >
                  {p.status}
                </span>
              </div>
              <h3>{p.name}</h3>
              <p>{p.purpose}</p>
              <small>
                Last success:{' '}
                {p.lastSuccess ? new Date(p.lastSuccess).toLocaleString() : 'Not verified'}
              </small>
              <a className="source-link" href={p.url} target="_blank" rel="noreferrer">
                Provider documentation <ArrowUpRight size={12} />
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className="panel prose">
        <span className="eyebrow">EXPLICIT ON-DEMAND LOOKUP</span>
        <h2>Investigate an indicator.</h2>
        <p>
          Third parties receive the submitted indicator. Do not submit private addresses,
          confidential domains, personal information or sensitive hashes. VirusTotal queries may
          become part of its dataset.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void operation(async () => {
              setResult(
                await api('/api/lookup', { provider: lookupProvider, type, value, consent }),
              );
              providers.reload();
            });
          }}
        >
          <div className="lookup-fields">
            <label>
              Provider
              <select value={lookupProvider} onChange={(e) => setLookupProvider(e.target.value)}>
                {['epss', 'nvd', 'otx', 'virustotal', 'abuseipdb'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {['CVE', 'IP', 'domain', 'hash'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="grow">
              Indicator
              <input
                required
                maxLength={253}
                value={value}
                onChange={(e) => setValue(e.target.value.trim())}
                placeholder="Public CVE, IPv4, domain or SHA-256"
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{' '}
            I am authorized to disclose this indicator to the selected provider.
          </label>
          <button className="button primary" disabled={!consent || busy}>
            Request lookup
          </button>
        </form>
        {result !== null && <pre>{JSON.stringify(result, null, 2)}</pre>}
        <p className="small muted">
          Requires authentication, ENABLE_EXTERNAL_LOOKUPS, shared database quotas and provider
          credentials where applicable. Public IPv4 only; IPv6 lookups are not implemented.
        </p>
      </section>
    </>
  );
}
export function Admin() {
  const { user } = useStore();
  const result = useResource<{
    audit: { action: string; metadata: unknown; created_at: string }[];
  }>('/api/admin');
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATOR / TENANT AUDIT</div>
          <h1>
            Administration<span className="cyan-text">.</span>
          </h1>
          <p>Review authenticated operations in your workspace.</p>
        </div>
      </div>
      {!user || user.role !== 'admin' ? (
        <div className="empty panel">
          <Shield size={32} />
          <h2>Administrator access required</h2>
          <p>The server enforces this role independently of the interface.</p>
          <Link className="button" href="/settings">
            Account settings
          </Link>
        </div>
      ) : (
        <section className="panel prose">
          <h2>
            <Database size={20} /> Audit trail
          </h2>
          {result.error && <div className="notice error">{result.error}</div>}
          {result.data?.audit.map((a, i) => (
            <div className="audit-row" key={i}>
              <strong>{a.action}</strong>
              <span>{new Date(a.created_at).toLocaleString()}</span>
              <pre>{JSON.stringify(a.metadata, null, 2)}</pre>
            </div>
          ))}
          {result.data && !result.data.audit.length && <p>No audited operations yet.</p>}
          <p className="small muted">
            Content is versioned in source. In-app user provisioning, content publishing and billing
            are future work.
          </p>
        </section>
      )}
    </>
  );
}
