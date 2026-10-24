'use client';
import { useEffect, useMemo, useReducer, useRef, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type Node,
  type NodeProps,
  type Connection,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  Shield,
  Radio,
  Database,
  GitBranch,
  UserCheck,
  Workflow as FlowIcon,
  Check,
  Play,
  Pause,
  RotateCcw,
  StepForward,
  SkipBack,
  Download,
  Save,
  Plus,
  Trash2,
  Sparkles,
  Send,
  ChevronRight,
  Code2,
  FileText,
  PanelRightClose,
  ArrowUpRight,
  Lock,
  Terminal,
  Search,
} from 'lucide-react';
import { automationTemplate, intelAutomationTemplate, topics, workflows } from '@/lib/content';
import {
  defaultParameters,
  type Workflow,
  type SimEvent,
  type Parameters,
  type CyberNode,
  type Threat,
} from '@/lib/model';
import { playbackReducer, simulate, validateWorkflow, scenarios } from '@/lib/engine';
import { api, download, useStore } from './store';
import { AutomationIdeas } from './Intel';
type NodeData = {
  title: string;
  op: string;
  state: string;
  index: number;
  selected: boolean;
  expanded: boolean;
  description: string;
};
type FlowNode = Node<NodeData, 'cyber'>;
const nodeIcons: Record<string, typeof Shield> = {
  trigger: Radio,
  source: Radio,
  parse: Code2,
  collect: Database,
  siem: Database,
  detect: Search,
  alert: Shield,
  enrich: Sparkles,
  investigate: Search,
  decide: GitBranch,
  approval: UserCheck,
  respond: Shield,
  notify: Send,
  audit: FileText,
  dns: Database,
  syn: Radio,
  synack: Radio,
  ack: Check,
  hello: Lock,
  certificate: Shield,
  keys: Lock,
  http: Database,
  normalize: Code2,
  correlate: GitBranch,
};
function CyberGraphNode({ data }: NodeProps<FlowNode>) {
  const Icon = nodeIcons[data.op] ?? FlowIcon;
  return (
    <div className={`cyber-node ${data.state} ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-top">
        <span className="node-icon">
          <Icon size={19} />
        </span>
        <span className="node-number">{String(data.index + 1).padStart(2, '0')}</span>
        {data.state === 'complete' && <Check size={13} className="node-check" />}
      </div>
      <strong>{data.title}</strong>
      <small>{data.state === 'idle' ? data.op.toUpperCase() : data.state.toUpperCase()}</small>
      {data.expanded && <p>{data.description}</p>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { cyber: CyberGraphNode };
type MentorAnswer = {
  answer: string;
  limitations: string;
  nextSteps: string[];
  citations: { title: string; url: string }[];
  mode: string;
};
export function Workspace({
  workflowId,
  topicId,
  editor = false,
  arena = false,
}: {
  workflowId: string;
  topicId?: string;
  editor?: boolean;
  arena?: boolean;
}) {
  const params = useSearchParams(),
    threatId = params.get('threat');
  const store = useStore();
  const [definition, setDefinition] = useState<Workflow>(() =>
    structuredClone(
      editor
        ? threatId
          ? intelAutomationTemplate
          : automationTemplate
        : (workflows[workflowId] ?? workflows.soc),
    ),
  );
  const [settings, setSettings] = useState<Parameters>(defaultParameters),
    [selected, setSelected] = useState(definition.nodes[0].id),
    [expanded, setExpanded] = useState(false),
    [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({}),
    [perspective, setPerspective] = useState('SOC analyst'),
    [mobileTab, setMobileTab] = useState('canvas'),
    [showInspector, setShowInspector] = useState(true),
    [mode, setMode] = useState<'simulation' | 'replay' | 'live'>(threatId ? 'live' : 'simulation'),
    [replay, setReplay] = useState<SimEvent[] | null>(null);
  const [playback, dispatch] = useReducer(playbackReducer, { cursor: 0, playing: false, speed: 1 }),
    [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState<MentorAnswer | null>(null),
    [thinking, setThinking] = useState(false),
    [useModel, setUseModel] = useState(false),
    [skill, setSkill] = useState('beginner'),
    [mentorError, setMentorError] = useState(''),
    [inspectorTab, setInspectorTab] = useState('explain'),
    [query, setQuery] = useState(''),
    [quizAnswer, setQuizAnswer] = useState<number | null>(null),
    [quizFeedback, setQuizFeedback] = useState('');
  const [threat, setThreat] = useState<Threat | null>(null),
    [threatError, setThreatError] = useState('');
  const [measurements, setMeasurements] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const graph = useRef<ReactFlowInstance<FlowNode> | null>(null),
    pendingHistory = useRef<string | null>(null),
    reachedEnd = useRef(false);
  const validation = useMemo(() => validateWorkflow(definition), [definition]);
  useEffect(() => {
    if (!threatId) return;
    api<{ item: Threat }>(`/api/intel/${encodeURIComponent(threatId)}`)
      .then((r) => setThreat(r.item))
      .catch((e) => setThreatError(e.message));
  }, [threatId]);
  const generated = useMemo(
    () =>
      validation.errors.length
        ? []
        : simulate(
            definition,
            settings,
            threat
              ? {
                  source: threat.source,
                  cve: threat.id,
                  title: threat.title,
                  requiredAction: threat.required_action,
                  ingestedAt: threat.ingested_at,
                }
              : undefined,
          ),
    [definition, settings, threat, validation.errors.length],
  );
  const events = mode === 'replay' && replay ? replay : generated,
    visible = events.slice(0, playback.cursor),
    current = visible.at(-1),
    node = definition.nodes.find((n) => n.id === selected) ?? definition.nodes[0],
    event = visible.find((e) => e.nodeId === node.id),
    topic =
      topics.find((t) => t.id === topicId) ??
      topics.find((t) => t.workflow === workflowId) ??
      topics.find((t) => t.id === 'automation')!;
  useEffect(() => {
    if (!playback.playing) return;
    const t = setTimeout(
      () => dispatch({ type: 'step', length: events.length }),
      1200 / playback.speed,
    );
    return () => clearTimeout(t);
  }, [playback.playing, playback.cursor, playback.speed, events.length]);
  useEffect(() => {
    if (current) setSelected(current.nodeId);
  }, [current]);
  useEffect(() => {
    if (events.length && playback.cursor === events.length) {
      reachedEnd.current = true;
      if (pendingHistory.current) {
        const id = pendingHistory.current;
        pendingHistory.current = null;
        store.update((d) => ({
          ...d,
          history: [
            {
              id,
              title: definition.title,
              at: new Date().toISOString(),
              steps: events.length,
              outcome: String(
                events.at(-1)?.output.outcome ?? events.at(-1)?.message ?? 'Completed',
              ),
            },
            ...d.history,
          ].slice(0, 30),
        }));
      }
    }
  }, [playback.cursor, events, definition.title, store]);
  function reset() {
    dispatch({ type: 'reset' });
    reachedEnd.current = false;
    setAnswer(null);
    setQuizFeedback('');
  }
  function changeSettings(value: Partial<Parameters>) {
    setSettings((s) => ({ ...s, ...value }));
    reset();
    setMode('simulation');
    setReplay(null);
  }
  const graphNodes: FlowNode[] = definition.nodes.map((n, i) => {
    const e = visible.find((e) => e.nodeId === n.id);
    return {
      id: n.id,
      type: 'cyber',
      ariaLabel: `${n.title} stage`,
      position: positions[n.id] ?? n.position,
      measured: measurements[n.id],
      data: {
        title: n.title,
        op: n.op,
        state: current?.nodeId === n.id && playback.playing ? 'active' : (e?.status ?? 'idle'),
        index: i,
        selected: selected === n.id,
        expanded,
        description: n.description,
      },
    };
  });
  const graphEdges = definition.edges.map((e) => {
    const traversed = visible.some((v) => v.edgeIds.includes(e.id));
    const active = playback.playing && current?.edgeIds.includes(e.id);
    return {
      ...e,
      label: e.when === 'always' ? undefined : e.when === 'yes' ? 'YES' : 'NO',
      animated: Boolean(active) && !store.quiet,
      style: {
        stroke: active ? '#00e5ff' : traversed ? '#308e99' : '#344354',
        strokeWidth: active ? 2.5 : 1.5,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: traversed ? '#00e5ff' : '#536176' },
      labelStyle: { fill: '#c3d2e4', fontSize: 10 },
      labelBgStyle: { fill: '#111b29' },
      interactionWidth: 24,
    };
  });
  function editNode(patch: Partial<CyberNode>) {
    setDefinition((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === selected ? { ...n, ...patch } : n)),
    }));
    reset();
  }
  function addNode(op: CyberNode['op'], position?: { x: number; y: number }) {
    let suffix = 1;
    while (definition.nodes.some((n) => n.id === `${op}-${suffix}`)) suffix++;
    const id = `${op}-${suffix}`;
    setDefinition((d) => ({
      ...d,
      nodes: [
        ...d.nodes,
        {
          id,
          title: op.charAt(0).toUpperCase() + op.slice(1),
          op,
          description: `${op} stage in the educational dry run.`,
          detail:
            'Configure this stage, connect it to the graph, then validate its input and output.',
          position: position ?? { x: 450, y: 700 },
          requires: op === 'respond' ? ['approved'] : [],
          produces: [],
          timeoutMs: 5000,
          retries: 1,
        },
      ],
    }));
    setSelected(id);
    reset();
  }
  function connect(c: Connection) {
    if (!c.source || !c.target) return;
    const id = `${c.source}-${c.target}`;
    setDefinition((d) =>
      d.edges.some((e) => e.id === id)
        ? d
        : {
            ...d,
            edges: [...d.edges, { id, source: c.source!, target: c.target!, when: 'always' }],
          },
    );
    dispatch({ type: 'reset' });
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    const op = e.dataTransfer.getData('application/cyber-node');
    if (['parse', 'enrich', 'decide', 'approval', 'respond', 'notify', 'audit'].includes(op)) {
      addNode(
        op as CyberNode['op'],
        graph.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      );
    }
  }
  async function ask(text = question) {
    if (!text.trim()) return;
    setThinking(true);
    setMentorError('');
    try {
      const value = await api<MentorAnswer>('/api/mentor', {
        question: text,
        workflowId: editor ? (threatId ? 'intel' : 'soc') : definition.id,
        nodeId: editor
          ? (workflows[threatId ? 'intel' : 'soc'].nodes.find((n) => n.op === node.op)?.id ??
            'approval')
          : node.id,
        topic: topic.id,
        cursor: playback.cursor,
        parameters: settings,
        threatId: threatId ?? undefined,
        level: skill,
        goal: 'Understand and investigate this selected stage',
        useModel,
      });
      setAnswer(value);
      setQuestion('');
      setInspectorTab('mentor');
    } catch (e) {
      setMentorError((e as Error).message);
    } finally {
      setThinking(false);
    }
  }
  function run() {
    if (!events.length) return;
    if (playback.cursor >= events.length) dispatch({ type: 'reset' });
    pendingHistory.current = editor ? `run-${Date.now()}` : null;
    dispatch({ type: 'play', length: events.length });
  }
  const matchingLogs = visible.filter((e) =>
    `${e.nodeId} ${e.message} ${JSON.stringify(e.output)}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading compact">
        <div>
          <div className="eyebrow">
            {editor
              ? 'DESIGN / VALIDATE / REHEARSE'
              : arena
                ? 'SYNTHETIC SECURITY OPERATIONS'
                : topicId
                  ? 'CONNECTED LEARNING'
                  : 'LIVING WORKFLOW LABORATORY'}
          </div>
          <h1>
            {editor
              ? 'Automation architect'
              : arena
                ? 'SOC simulation arena'
                : topicId
                  ? topic.title
                  : definition.title}
          </h1>
          <p>
            {editor
              ? 'Build a reviewable chain. Inspect every transformation. Execute nothing externally.'
              : definition.summary}
          </p>
        </div>
        <div className="heading-actions">
          {editor ? (
            <button
              className="button primary"
              disabled={!!validation.errors.length}
              onClick={() => {
                const saved = {
                  ...definition,
                  version:
                    Math.max(
                      definition.version,
                      ...store.data.workflows
                        .filter((w) => w.id === definition.id)
                        .map((w) => w.version),
                    ) + 1,
                  nodes: definition.nodes.map((n) => ({
                    ...n,
                    position: positions[n.id] ?? n.position,
                  })),
                };
                store.update((d) => ({ ...d, workflows: [...d.workflows, saved].slice(-20) }));
                setDefinition(saved);
                store.notify(`Saved version ${saved.version} on this device.`);
              }}
            >
              <Save size={16} /> Save version
            </button>
          ) : (
            <Link className="button" href={`/automation${threatId ? `?threat=${threatId}` : ''}`}>
              <FlowIcon size={16} /> Automate this
            </Link>
          )}
        </div>
      </div>
      {threat && (
        <div className="context-banner">
          <span className="badge cyan">PUBLIC EVIDENCE</span>
          <Link href={`/intel/${threat.id}`}>
            {threat.id} · {threat.title}
          </Link>
          <small>
            Retrieved {new Date(threat.ingested_at).toLocaleString()} · Lab asset correlation
          </small>
        </div>
      )}
      {threatError && (
        <div className="notice error">
          {threatError} · This lab is synthetic until a source record is loaded.
        </div>
      )}
      <div className="workspace-toolbar">
        <div className="segment-control" aria-label="Data mode">
          {(['simulation', 'replay', 'live'] as const).map((m) => (
            <button
              key={m}
              className={mode === m ? 'selected' : ''}
              onClick={() => {
                if (m === 'live' && !threat) {
                  store.notify(
                    'Select a public CISA record from Threat intelligence to open live source evidence.',
                  );
                  return;
                }
                if (m === 'replay') {
                  setReplay(events.slice(0, playback.cursor));
                  dispatch({ type: 'reset' });
                }
                setMode(m);
              }}
            >
              {m === 'live' ? 'Live source' : m === 'replay' ? 'Replay' : 'Simulation'}
            </button>
          ))}
        </div>
        <label className="inline-field">
          Perspective
          <select value={perspective} onChange={(e) => setPerspective(e.target.value)}>
            <option>Learner</option>
            <option>SOC analyst</option>
            <option>Detection engineer</option>
            <option>Automation engineer</option>
          </select>
        </label>
        <button className="button small" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Compact nodes' : 'Expand explanations'}
        </button>
        <button
          className="icon-button"
          aria-label="Toggle inspector"
          onClick={() => setShowInspector(!showInspector)}
        >
          <PanelRightClose size={17} />
        </button>
      </div>
      <div className="mobile-workspace-tabs">
        {['canvas', 'inspector', 'events'].map((t) => (
          <button
            key={t}
            className={mobileTab === t ? 'selected' : ''}
            onClick={() => {
              setMobileTab(t);
              if (t === 'inspector') setShowInspector(true);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className={`lab-layout ${showInspector ? '' : 'inspector-hidden'} mobile-${mobileTab}`}>
        <section className="panel canvas-panel">
          <div className="canvas-header">
            <span>
              <span className="tiny-dot cyan" />{' '}
              {editor
                ? 'PLAYBOOK CANVAS'
                : mode === 'replay'
                  ? 'RECORDED EVENT REPLAY'
                  : 'INVESTIGATION CANVAS'}
            </span>
            <span>
              {visible.length}/{events.length} events <span className="divider-dot">·</span>{' '}
              {mode === 'live' ? 'Public source / conceptual processing' : 'Synthetic lab'}
            </span>
          </div>
          {editor && (
            <div className="node-palette">
              {(
                ['parse', 'enrich', 'decide', 'approval', 'respond', 'notify', 'audit'] as const
              ).map((op) => (
                <button
                  key={op}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/cyber-node', op)}
                  onClick={() => addNode(op)}
                >
                  <Plus size={12} />
                  {op}
                </button>
              ))}
            </div>
          )}
          <div
            className="flow-canvas"
            onDragOver={(e) => {
              if (editor) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={editor ? onDrop : undefined}
          >
            <ReactFlow<FlowNode>
              nodes={graphNodes}
              edges={graphEdges}
              nodeTypes={nodeTypes}
              onInit={(instance) => {
                graph.current = instance;
              }}
              onNodeClick={(_, n) => {
                setSelected(n.id);
                setAnswer(null);
              }}
              onNodesChange={(changes) => {
                for (const c of changes) {
                  if (c.type === 'select' && c.selected) setSelected(c.id);
                  if (c.type === 'position' && c.position)
                    setPositions((old) => ({ ...old, [c.id]: c.position! }));
                  if (c.type === 'dimensions' && c.dimensions)
                    setMeasurements((old) => ({ ...old, [c.id]: c.dimensions! }));
                }
              }}
              onConnect={editor ? connect : undefined}
              nodesConnectable={editor}
              nodesDraggable
              edgesReconnectable={false}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.2}
              maxZoom={1.6}
              colorMode="dark"
              proOptions={{ hideAttribution: false }}
              deleteKeyCode={null}
            >
              <Background color="#1f3445" gap={28} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) =>
                  n.data.state === 'complete' ? '#27e5a3' : n.data.selected ? '#00e5ff' : '#2b4659'
                }
                maskColor="rgba(7,11,18,.7)"
              />
            </ReactFlow>
          </div>
          <div className="playback">
            <div className="play-buttons">
              <button className="icon-button" aria-label="Reset workflow" onClick={reset}>
                <RotateCcw size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Step backward"
                disabled={!playback.cursor}
                onClick={() =>
                  dispatch({ type: 'seek', value: playback.cursor - 1, length: events.length })
                }
              >
                <SkipBack size={17} />
              </button>
              <button
                className="play-button"
                aria-label={playback.playing ? 'Pause workflow' : 'Play workflow'}
                disabled={!events.length}
                onClick={() => (playback.playing ? dispatch({ type: 'pause' }) : run())}
              >
                {playback.playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button
                className="icon-button"
                aria-label="Step forward"
                disabled={playback.cursor >= events.length}
                onClick={() => dispatch({ type: 'step', length: events.length })}
              >
                <StepForward size={18} />
              </button>
            </div>
            <input
              aria-label="Timeline position"
              className="timeline-range"
              type="range"
              min={0}
              max={events.length}
              value={Math.min(playback.cursor, events.length)}
              onChange={(e) =>
                dispatch({ type: 'seek', value: Number(e.target.value), length: events.length })
              }
            />
            <span className="mono small">
              {String(playback.cursor).padStart(2, '0')} / {events.length}
            </span>
            <select
              aria-label="Playback speed"
              value={playback.speed}
              onChange={(e) => dispatch({ type: 'speed', value: Number(e.target.value) })}
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </div>
          <div className="lab-controls">
            <span className="eyebrow">WHAT IF</span>
            {['soc', 'automation'].includes(definition.id) && (
              <label>
                Scenario
                <select
                  value={settings.scenario}
                  disabled={mode === 'replay'}
                  onChange={(e) => changeSettings({ scenario: e.target.value })}
                >
                  {Object.entries(scenarios).map(([id, s]) => (
                    <option key={id} value={id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {['soc', 'intel', 'automation', 'automation-intel'].includes(definition.id) && (
              <>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.suspicious}
                    disabled={mode === 'replay'}
                    onChange={(e) => changeSettings({ suspicious: e.target.checked })}
                  />
                  {definition.id.includes('intel')
                    ? 'Hypothetical affected asset'
                    : 'Suspicious activity'}
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.approved}
                    disabled={mode === 'replay'}
                    onChange={(e) => changeSettings({ approved: e.target.checked })}
                  />{' '}
                  Approve simulated response
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.enrichmentFails}
                    disabled={mode === 'replay'}
                    onChange={(e) => changeSettings({ enrichmentFails: e.target.checked })}
                  />{' '}
                  Enrichment failure
                </label>
              </>
            )}
            {['tcp', 'tls'].includes(definition.id) && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.firewallOpen}
                  disabled={mode === 'replay'}
                  onChange={(e) => changeSettings({ firewallOpen: e.target.checked })}
                />{' '}
                Allow TCP 443
              </label>
            )}
            {definition.id === 'tls' && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.certificateValid}
                  disabled={mode === 'replay'}
                  onChange={(e) => changeSettings({ certificateValid: e.target.checked })}
                />{' '}
                Valid certificate
              </label>
            )}
            {settings.scenario === 'bruteforce' && (
              <label>
                Failure threshold
                <input
                  aria-label="Failure threshold"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.threshold}
                  onChange={(e) =>
                    changeSettings({ threshold: Math.max(1, Math.min(20, Number(e.target.value))) })
                  }
                />
              </label>
            )}
          </div>
          {validation.errors.length > 0 && (
            <div className="notice error">
              <strong>Workflow validation</strong>
              {validation.errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
        </section>
        {showInspector && (
          <aside className="panel inspector">
            <div className="inspector-heading">
              <span className="ai-mark">
                <Sparkles size={18} />
              </span>
              <div>
                <strong>Cyber AI</strong>
                <small>CONTEXT-AWARE INSPECTOR</small>
              </div>
              <span className="tiny-dot cyan" />
            </div>
            <div className="inspector-tabs">
              {['explain', 'data', 'mentor'].map((t) => (
                <button
                  key={t}
                  className={inspectorTab === t ? 'selected' : ''}
                  onClick={() => setInspectorTab(t)}
                >
                  {t === 'explain' ? 'Overview' : t === 'data' ? 'Input / output' : 'Ask mentor'}
                </button>
              ))}
            </div>
            <div className="inspector-body">
              <div className="selected-node-label">
                SELECTED NODE{' '}
                <span>{String(definition.nodes.indexOf(node) + 1).padStart(2, '0')}</span>
              </div>
              <h2>{node.title}</h2>
              <span className={`badge ${event ? 'green' : ''}`}>
                {event?.status ?? 'Not reached'}
              </span>
              {inspectorTab === 'explain' && (
                <>
                  <p>{node.description}</p>
                  <p className="muted">{node.detail}</p>
                  <div className="insight">
                    <span className="eyebrow">{perspective.toUpperCase()} LENS</span>
                    <p>
                      {perspective === 'Learner'
                        ? topic.concept
                        : perspective === 'Detection engineer'
                          ? topic.detection
                          : perspective === 'Automation engineer'
                            ? topic.automation
                            : topic.investigation}
                    </p>
                  </div>
                  {event && (
                    <div className={`notice ${event.status === 'error' ? 'error' : ''}`}>
                      {event.message}
                    </div>
                  )}
                  <button
                    className="button full"
                    onClick={() => void ask('Explain this node and its current evidence')}
                    disabled={thinking}
                  >
                    <Sparkles size={15} /> Explain this node <ChevronRight size={14} />
                  </button>
                  <h4>Recommended next step</h4>
                  <p className="small">{topic.response}</p>
                  {definition.references.map((r) => (
                    <a
                      key={r.url}
                      className="source-link"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.title}
                      <ArrowUpRight size={13} />
                    </a>
                  ))}
                </>
              )}
              {inspectorTab === 'data' && (
                <>
                  <p className="muted small">
                    {event
                      ? 'Captured at this exact simulation step.'
                      : 'Run or step the workflow to inspect this node’s actual event.'}
                  </p>
                  <h4>Input JSON</h4>
                  <pre>{JSON.stringify(event?.input ?? {}, null, 2)}</pre>
                  <h4>Output JSON</h4>
                  <pre>{JSON.stringify(event?.output ?? {}, null, 2)}</pre>
                  <h4>Contract</h4>
                  <p className="small">
                    Requires: {node.requires.join(', ') || 'No mandatory fields'}
                    <br />
                    Produces: {node.produces.join(', ') || 'Enriched event envelope'}
                  </p>
                </>
              )}
              {inspectorTab === 'mentor' && (
                <>
                  <div className="notice subtle">
                    {editor
                      ? 'For custom playbooks, mentor guidance uses the canonical investigation stage with the same operation.'
                      : 'Grounded in the selected node, replay position and curated lesson.'}{' '}
                    Local guidance works without a key.
                  </div>
                  <label>
                    Learning level
                    <select value={skill} onChange={(e) => setSkill(e.target.value)}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={useModel}
                      onChange={(e) => setUseModel(e.target.checked)}
                    />{' '}
                    Use configured AI provider
                  </label>
                  {useModel && (
                    <p className="small muted">
                      Your question and selected public/lab context will be sent to OpenAI. Do not
                      enter secrets or private telemetry.
                    </p>
                  )}
                  <div className="prompt-chips">
                    {[
                      'Why is this relevant?',
                      'How to detect?',
                      'Show the investigation chain',
                      'Suggest automation',
                    ].map((q) => (
                      <button key={q} disabled={thinking} onClick={() => void ask(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                  {thinking && (
                    <p role="status" className="cyan-text">
                      Building a contextual explanation…
                    </p>
                  )}
                  {answer && (
                    <div className="mentor-answer">
                      <span className="badge cyan">
                        {answer.mode === 'model'
                          ? 'MODEL · REVIEW REQUIRED'
                          : 'LOCAL CURATED MENTOR'}
                      </span>
                      <p>{answer.answer}</p>
                      <p className="muted small">{answer.limitations}</p>
                      <ol>
                        {answer.nextSteps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                      {answer.citations.map((c) => (
                        <a
                          className="source-link"
                          key={c.url}
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {c.title}
                          <ArrowUpRight size={12} />
                        </a>
                      ))}
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void ask();
                    }}
                  >
                    <label htmlFor="mentor-question" className="sr-only">
                      Ask about this node
                    </label>
                    <textarea
                      id="mentor-question"
                      placeholder="Ask about this node…"
                      maxLength={1200}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                    <button className="button primary full" disabled={thinking || !question.trim()}>
                      <Send size={15} /> Ask Cyber AI
                    </button>
                  </form>
                </>
              )}
              {mentorError && <div className="notice error">{mentorError}</div>}
              {editor && (
                <details className="editor-config" open>
                  <summary>Configure selected node</summary>
                  <label>
                    Label
                    <input
                      value={node.title}
                      maxLength={90}
                      onChange={(e) => editNode({ title: e.target.value })}
                    />
                  </label>
                  <div className="two-fields">
                    <label>
                      Timeout (ms)
                      <input
                        type="number"
                        min={1}
                        max={30000}
                        value={node.timeoutMs}
                        onChange={(e) => editNode({ timeoutMs: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Retries
                      <input
                        type="number"
                        min={0}
                        max={3}
                        value={node.retries}
                        onChange={(e) => editNode({ retries: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <label>
                    Required fields
                    <input
                      value={node.requires.join(',')}
                      onChange={(e) =>
                        editNode({
                          requires: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                  {definition.edges
                    .filter((e) => e.source === node.id)
                    .map((edge) => (
                      <div className="edge-config" key={edge.id}>
                        <span>→ {definition.nodes.find((n) => n.id === edge.target)?.title}</span>
                        <select
                          aria-label={`Branch to ${edge.target}`}
                          value={edge.when}
                          onChange={(e) => {
                            setDefinition((d) => ({
                              ...d,
                              edges: d.edges.map((item) =>
                                item.id === edge.id
                                  ? { ...item, when: e.target.value as 'yes' | 'no' | 'always' }
                                  : item,
                              ),
                            }));
                            reset();
                          }}
                        >
                          <option value="always">Always</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                        <button
                          className="icon-button"
                          aria-label={`Remove connection to ${edge.target}`}
                          onClick={() => {
                            setDefinition((d) => ({
                              ...d,
                              edges: d.edges.filter((e) => e.id !== edge.id),
                            }));
                            reset();
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  <button
                    className="button danger"
                    onClick={() => {
                      if (definition.nodes.length <= 2) {
                        store.notify('Keep at least two nodes.');
                        return;
                      }
                      setDefinition((d) => ({
                        ...d,
                        nodes: d.nodes.filter((n) => n.id !== selected),
                        edges: d.edges.filter(
                          (e) => e.source !== selected && e.target !== selected,
                        ),
                      }));
                      setSelected(definition.nodes.find((n) => n.id !== selected)!.id);
                      reset();
                    }}
                  >
                    <Trash2 size={14} /> Remove node
                  </button>
                </details>
              )}
            </div>
          </aside>
        )}
        <section className="panel event-panel">
          <div className="panel-top">
            <span className="eyebrow">
              <Terminal size={14} /> EVENT STREAM <span className="badge">{visible.length}</span>
            </span>
            <div className="event-tools">
              <input
                aria-label="Filter event logs"
                placeholder="Filter logs…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="icon-button"
                aria-label="Export execution trace"
                onClick={() =>
                  download('cyber-ai-trace.json', {
                    schemaVersion: 1,
                    mode,
                    workflow: definition,
                    parameters: settings,
                    events: visible,
                    exportedAt: new Date().toISOString(),
                  })
                }
              >
                <Download size={16} />
              </button>
            </div>
          </div>
          <div className="log-table">
            <div className="log-table-head">
              <span>TIME / UTC</span>
              <span>STAGE</span>
              <span>OBSERVATION</span>
              <span>STATE</span>
            </div>
            {matchingLogs.length ? (
              matchingLogs.map((e) => (
                <button
                  className={`log-row ${e.nodeId === selected ? 'selected' : ''}`}
                  key={e.id}
                  onClick={() => {
                    setSelected(e.nodeId);
                    setInspectorTab('data');
                    setMobileTab('inspector');
                    setShowInspector(true);
                  }}
                >
                  <span className="mono">{e.time.slice(11, 19)}</span>
                  <span>{definition.nodes.find((n) => n.id === e.nodeId)?.title}</span>
                  <span>{e.message}</span>
                  <span className={`log-status ${e.status}`}>{e.status}</span>
                </button>
              ))
            ) : (
              <div className="empty-log">
                <span className="tiny-dot orange" />{' '}
                {mode === 'replay' && !events.length
                  ? 'No recorded events yet. Run the simulation before entering Replay.'
                  : 'Waiting for events. Press play or step through the workflow.'}
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="workspace-bottom">
        <span>
          <Lock size={13} />{' '}
          {mode === 'live'
            ? 'Public source evidence; hypothetical asset matching and response.'
            : 'Synthetic data only. No external actions are executed.'}
        </span>
        <button
          className="text-link"
          onClick={() =>
            download('cyber-ai-workflow.json', {
              ...definition,
              nodes: definition.nodes.map((n) => ({
                ...n,
                position: positions[n.id] ?? n.position,
              })),
            })
          }
        >
          <Download size={14} /> Export workflow JSON
        </button>
      </div>
      {editor && (
        <div className="panel saved-workflows">
          <h3>Saved versions</h3>
          {store.data.workflows.length ? (
            store.data.workflows.map((w) => (
              <button
                className="button"
                key={`${w.id}-${w.version}`}
                onClick={() => {
                  const result = validateWorkflow(w);
                  if (result.workflow) {
                    setDefinition(result.workflow);
                    setPositions({});
                    setSelected(result.workflow.nodes[0].id);
                    reset();
                  } else store.notify('Saved workflow is invalid.');
                }}
              >
                {w.title} · v{w.version}
              </button>
            ))
          ) : (
            <p className="muted">Save a validated playbook to retain it on this device.</p>
          )}
        </div>
      )}
      {topicId && (
        <section className="lesson-grid">
          <div className="panel prose">
            <span className="eyebrow">CONCEPT → EVIDENCE → RESPONSE</span>
            <h2>{topic.title}</h2>
            {[
              ['Concept', topic.concept],
              ['Evidence & logs', topic.evidence],
              ['Detection', topic.detection],
              ['Investigation', topic.investigation],
              ['Response', topic.response],
            ].map(([title, text]) => (
              <div key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <div className="panel prose">
            <span className="eyebrow">KNOWLEDGE CHECK</span>
            <h3>{topic.question}</h3>
            <p className="muted">
              Complete the workflow and answer correctly to record this lesson.
            </p>
            {topic.answers.map((a, i) => (
              <label className={`quiz-option ${quizAnswer === i ? 'selected' : ''}`} key={a}>
                <input
                  type="radio"
                  name="quiz"
                  checked={quizAnswer === i}
                  onChange={() => setQuizAnswer(i)}
                />
                {a}
              </label>
            ))}
            <button
              className="button primary"
              disabled={quizAnswer === null}
              onClick={() => {
                if (!reachedEnd.current) {
                  setQuizFeedback(
                    'Finish the workflow first. You can step through or play at 4× speed.',
                  );
                  return;
                }
                if (quizAnswer !== topic.correct) {
                  setQuizFeedback(
                    'Not quite. Review the concept and source reference, then try again.',
                  );
                  return;
                }
                store.update((d) => ({
                  ...d,
                  completed: [...new Set([...d.completed, topic.id])],
                }));
                setQuizFeedback('Correct. Lesson completed and saved on this device.');
              }}
            >
              Check understanding
            </button>
            {quizFeedback && (
              <div className="notice" role="status">
                {quizFeedback}
              </div>
            )}
          </div>
        </section>
      )}
      {!editor && <AutomationIdeas topic={topic.id} />}
    </>
  );
}
