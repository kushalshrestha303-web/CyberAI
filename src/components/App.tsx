'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  Shield,
  LayoutDashboard,
  Globe2,
  Radio,
  Workflow,
  GraduationCap,
  FlaskConical,
  Settings,
  Folder,
  Menu,
  ChevronRight,
  ArrowUpRight,
  Command,
  Activity,
  PanelLeftClose,
} from 'lucide-react';
import { StoreProvider, useStore, useResource } from './store';
import { IntelFeed, ThreatDetail } from './Intel';
const Workspace = dynamic(() => import('./Workspace').then((m) => m.Workspace), {
  ssr: false,
  loading: () => <div className="empty panel">Loading interactive workspace…</div>,
});
const Academy = dynamic(() => import('./Screens').then((m) => m.Academy));
const Universe = dynamic(() => import('./Screens').then((m) => m.Universe), { ssr: false });
const SettingsScreen = dynamic(() => import('./Screens').then((m) => m.SettingsScreen));
const Projects = dynamic(() => import('./Screens').then((m) => m.Projects));
const Admin = dynamic(() => import('./Screens').then((m) => m.Admin));
import { topics, workflows } from '@/lib/content';
import type { Feed } from '@/lib/model';
const nav = [
  { href: 'dashboard', label: 'Command center', icon: LayoutDashboard },
  { href: 'intel', label: 'Threat intelligence', icon: Radio },
  { href: 'universe', label: 'Cyber universe', icon: Globe2 },
  { href: 'soc', label: 'SOC arena', icon: FlaskConical },
  { href: 'automation', label: 'Automation architect', icon: Workflow },
  { href: 'academy', label: 'Learning academy', icon: GraduationCap },
  { href: 'projects', label: 'Saved projects', icon: Folder },
];
export default function App(props: { section: string; id?: string }) {
  return (
    <StoreProvider>
      <Shell {...props} />
    </StoreProvider>
  );
}
function Shell({ section, id }: { section: string; id?: string }) {
  const [menu, setMenu] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const { user, quiet, setQuiet } = useStore();
  const title =
    nav.find((n) => n.href === section)?.label ??
    (section === 'learn'
      ? 'Learning workspace'
      : section === 'workflow'
        ? 'Workflow laboratory'
        : section === 'admin'
          ? 'Administration'
          : 'Workspace settings');
  return (
    <>
      <div className="atmosphere" aria-hidden="true">
        <div className="window-grid" />
        <div className="cityline" />
        <div className="copper-light" />
        <div className="lounge-floor" />
      </div>
      <div className={`app-shell ${collapsed ? 'rail-collapsed' : ''}`}>
        <aside className={`sidebar ${menu ? 'open' : ''}`}>
          <Link className="brand" href="/dashboard">
            <span className="brand-mark">
              <Shield size={22} />
            </span>
            <span>
              CYBER<span className="brand-ai">AI</span>
              <small>INTELLIGENCE IN MOTION</small>
            </span>
          </Link>
          <div className="workspace-label">
            <span className="tiny-dot" /> PERSONAL WORKSPACE <span className="version">2.0</span>
          </div>
          <nav aria-label="Main navigation">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={`/${n.href}`}
                className={`nav-link ${section === n.href ? 'active' : ''}`}
                onClick={() => setMenu(false)}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                {section === n.href && <span className="nav-indicator" />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-divider" />
          <div className="sidebar-caption">QUICK LABS</div>
          <Link className="nav-link sub" href="/workflow/tcp">
            <span className="tiny-dot cyan" /> TCP connection
          </Link>
          <Link className="nav-link sub" href="/workflow/tls">
            <span className="tiny-dot orange" /> TLS & trust
          </Link>
          <Link className="nav-link sub" href="/workflow/soc">
            <span className="tiny-dot green" /> Identity investigation
          </Link>
          <div className="sidebar-bottom">
            <div className="safety-card">
              <Shield size={18} />
              <strong>Explore with confidence</strong>
              <p>
                Real public intelligence.
                <br />
                Safe, synthetic investigations.
              </p>
              <Link href="/settings">
                View connection status <ChevronRight size={13} />
              </Link>
            </div>
            <Link className="nav-link" href="/settings">
              <Settings size={18} />
              <span>Settings & connections</span>
            </Link>
            <Link className="profile" href="/settings">
              <span className="avatar">{user ? 'CA' : 'G'}</span>
              <span>
                <strong>{user ? user.email.split('@')[0] : 'Guest explorer'}</strong>
                <small>{user ? `${user.role} · ${user.plan}` : 'Device-local learning'}</small>
              </span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </aside>
        <div className="main-column">
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={19} />
            </button>
            <button
              className="icon-button desktop-collapse"
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              onClick={() => setCollapsed(!collapsed)}
            >
              <PanelLeftClose size={18} />
            </button>
            <div className="breadcrumbs">
              Workspace <ChevronRight size={13} /> <strong>{title}</strong>
            </div>
            <div className="topbar-right">
              <span className="top-status">
                <span className="tiny-dot green" /> LEARNING ENVIRONMENT
              </span>
              <button
                className={`mode-toggle ${quiet ? 'on' : ''}`}
                onClick={() => setQuiet(!quiet)}
                aria-pressed={quiet}
              >
                {quiet ? 'Low motion' : 'Cinematic'}
                <Activity size={14} />
              </button>
              <Link className="icon-button" aria-label="Find a topic" href="/universe">
                <Command size={18} />
              </Link>
            </div>
          </header>
          <main id="main-content" className="content" key={`${section}-${id ?? ''}`}>
            {section === 'dashboard' && <Dashboard />}
            {section === 'intel' && (id ? <ThreatDetail id={id} /> : <IntelFeed />)}
            {(section === 'workflow' ||
              section === 'soc' ||
              section === 'learn' ||
              section === 'automation') && (
              <Workspace
                workflowId={
                  section === 'learn'
                    ? (topics.find((t) => t.id === id)?.workflow ?? 'soc')
                    : section === 'workflow'
                      ? (id ?? 'soc')
                      : section === 'automation'
                        ? 'automation'
                        : 'soc'
                }
                topicId={section === 'learn' ? id : undefined}
                editor={section === 'automation'}
                arena={section === 'soc'}
              />
            )}
            {section === 'universe' && <Universe />}
            {section === 'academy' && <Academy />}
            {section === 'settings' && <SettingsScreen />}
            {section === 'projects' && <Projects />}
            {section === 'admin' && <Admin />}
          </main>
          <footer className="footer">
            <span>
              CYBER AI <span className="muted">/</span> Learn cybersecurity by watching it work.
            </span>
            <span>PUBLIC INTELLIGENCE · SYNTHETIC LABS</span>
          </footer>
        </div>
      </div>
    </>
  );
}
function Dashboard() {
  const { data } = useStore(),
    feed = useResource<Feed>('/api/intel');
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-dot orange" /> YOUR CONNECTED SECURITY WORKSPACE
          </div>
          <h1>
            Intelligence in motion<span className="cyan-text">.</span>
          </h1>
          <p>Follow the evidence. Understand the system. Build the response.</p>
        </div>
        <Link className="button primary" href="/workflow/soc">
          <FlaskConical size={16} /> Enter the lab <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="metrics">
        <Metric
          label="PUBLIC INTELLIGENCE"
          value={feed.data?.total.toLocaleString() ?? '—'}
          note={feed.data ? `CISA KEV · ${feed.data.status}` : 'Connecting to CISA'}
          color="cyan"
        />
        <Metric
          label="LIVING WORKFLOWS"
          value={String(Object.keys(workflows).length).padStart(2, '0')}
          note="Deterministic & replayable"
          color="orange"
        />
        <Metric
          label="LEARNING PROGRESS"
          value={`${data.completed.length}/${topics.length}`}
          note="Validated lesson checks"
          color="green"
        />
        <Metric
          label="AUTOMATION RUNS"
          value={String(data.history.length).padStart(2, '0')}
          note="Saved dry-run executions"
          color="purple"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel feature-lab">
          <div className="panel-top">
            <span className="eyebrow">FEATURED INVESTIGATION</span>
            <span className="badge orange">SIMULATION</span>
          </div>
          <div className="feature-copy">
            <h2>
              One signal.
              <br />
              The whole story.
            </h2>
            <p>
              Follow a suspicious sign-in from its first log entry to a reviewed, authorized
              response.
            </p>
          </div>
          <div className="journey-illustration" aria-label="Investigation stages">
            <span className="journey-orbit" />
            <div className="signal-center">
              <Shield size={38} />
              <span>INVESTIGATE</span>
            </div>
            <div className="satellite s1">
              <Radio size={19} />
              <span>01 · SIGNAL</span>
            </div>
            <div className="satellite s2">
              <Activity size={19} />
              <span>02 · DETECT</span>
            </div>
            <div className="satellite s3">
              <Workflow size={19} />
              <span>03 · RESPOND</span>
            </div>
          </div>
          <div className="feature-bottom">
            <span>
              <span className="tiny-dot cyan" /> 12 inspectable stages{' '}
              <span className="muted">/</span> 6 lab scenarios
            </span>
            <Link className="button primary" href="/workflow/soc">
              Open investigation <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
        <section className="panel feed-preview">
          <div className="panel-top">
            <div>
              <span className="eyebrow">INTELLIGENCE RADAR</span>
              <h3>From the source</h3>
            </div>
            <Link href="/intel" className="text-link">
              View feed <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="provenance-line">
            <span
              className={`tiny-dot ${feed.data?.status === 'unavailable' ? 'orange' : 'green'}`}
            />
            {feed.data ? `CISA KEV · ${feed.data.status}` : 'Fetching public catalog…'}
          </div>
          {feed.error && <div className="notice error">{feed.error}</div>}
          {feed.data?.items.slice(0, 4).map((t) => (
            <Link key={t.id} href={`/intel/${t.id}`} className="feed-row">
              <div className="feed-glyph">
                <Shield size={18} />
              </div>
              <div>
                <span className="mono cyan-text">{t.id}</span>
                <strong>{t.title}</strong>
                <small>{t.affected_products[0]}</small>
              </div>
              <ChevronRight size={16} />
            </Link>
          ))}
          {!feed.loading && !feed.data?.items.length && (
            <div className="empty">
              <Radio />
              <h3>Public feed unavailable</h3>
              <p>No synthetic data is substituted for live intelligence.</p>
              <button className="button" onClick={feed.reload}>
                Retry connection
              </button>
            </div>
          )}
          <div className="panel-foot">
            {feed.data?.updatedAt
              ? `Retrieved ${new Date(feed.data.updatedAt).toLocaleString()}`
              : 'Evidence and source timestamps appear after a successful fetch.'}
          </div>
        </section>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">CONTINUE EXPLORING</span>
          <h2>Understand the connections.</h2>
        </div>
        <Link href="/academy" className="text-link">
          Open academy <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="learning-grid">
        {[
          ['tcp', '01', 'Networking foundations'],
          ['tls', '02', 'Trust & cryptography'],
          ['intel', '03', 'Evidence into action'],
        ].map(([id, num, label]) => {
          const t = topics.find((t) => t.id === id)!;
          return (
            <Link className="panel learning-card" key={id} href={`/learn/${id}`}>
              <div className="card-index">
                {num}
                <ArrowUpRight size={19} />
              </div>
              <span className="eyebrow">{label}</span>
              <h3>{t.title}</h3>
              <p>{t.concept}</p>
              <div className="card-meta">
                <span>{t.minutes} min</span>
                <span>{t.level}</span>
                <span>{data.completed.includes(id) ? 'Completed' : 'Interactive lesson'}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <div className={`metric ${color}`}>
      <span className="metric-label">{label}</span>
      <div className="metric-value">
        {value}
        <span className="metric-mark">
          <Activity size={21} />
        </span>
      </div>
      <span className="metric-note">
        <span className={`tiny-dot ${color}`} />
        {note}
      </span>
    </div>
  );
}
