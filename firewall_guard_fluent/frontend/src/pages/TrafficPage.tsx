import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge, Button, Card, Input, Label, MessageBar, MessageBarBody, SearchBox, Select, Drawer,
  DrawerBody, DrawerHeader, DrawerHeaderTitle, Switch, Text, Toolbar, ToolbarGroup, Tooltip,
  makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import {
  ArrowDown24Regular, ArrowUp24Regular, ArrowTrendingDown24Regular, ArrowTrending24Regular,
  Dismiss24Regular, Globe24Regular, LockClosed24Regular, Search24Regular, Add24Regular, Delete24Regular,
} from '@fluentui/react-icons';
import { api, type DomainPattern, type TrafficRow } from '../api';
import { useApp } from '../appContext';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { DetailDrawer } from '../components/DetailDrawer';
import { PageIntro, Panel, PathCell, Secondary, matchAny } from '../components/ui';

const useStyles = makeStyles({
  filterRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const, marginBottom: tokens.spacingVerticalS },
  selectWrap: { display: 'flex', flexDirection: 'column', gap: '2px' },
  selectLabel: { fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3 },
  searchBox: { minWidth: '220px', flex: '1 1 240px' },
  selectionBar: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, padding: '6px 10px', marginBottom: tokens.spacingVerticalXS, borderRadius: tokens.borderRadiusMedium, background: tokens.colorBrandBackground2 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalS },
  statCard: { padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`, border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, background: tokens.colorNeutralBackground1, display: 'flex', alignItems: 'center', gap: '10px' },
  statValue: { fontWeight: tokens.fontWeightBold, fontSize: tokens.fontSizeBase400 },
  statLabel: { fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3 },
  newPulse: { color: tokens.colorPaletteGreenForeground1 },
  msgPre: { fontFamily: 'Consolas, "Cascadia Code", monospace', fontSize: tokens.fontSizeBase100, whiteSpace: 'pre-wrap' as const, background: tokens.colorNeutralBackground3, padding: '10px', borderRadius: tokens.borderRadiusMedium, overflowWrap: 'anywhere' },
  patternRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  toggleRow: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalS },
});

type Side = 'all' | 'inbound' | 'outbound';
type Verdict = 'all' | 'permitted' | 'blocked' | 'live';

function relTime(t: string): string {
  if (!t) return 'live';
  const d = Date.parse(t);
  if (Number.isNaN(d)) return t.slice(11, 19);
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 0) return t.slice(11, 19);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  return t.slice(11, 19);
}

function verdictColor(v: TrafficRow['verdict']): 'success' | 'danger' | 'brand' | 'subtle' | 'warning' {
  if (v === 'permitted') return 'success';
  if (v === 'blocked') return 'danger';
  if (v === 'live') return 'brand';
  if (v === 'rule-event') return 'warning';
  return 'subtle';
}

export function TrafficPage() {
  const s = useStyles();
  const app = useApp();
  const qc = useQueryClient();
  const [side, setSide] = useState<Side>('all');
  const [verdict, setVerdict] = useState<Verdict>('all');
  const [proto, setProto] = useState<'all' | 'TCP' | 'UDP'>('all');
  const [appFilter, setAppFilter] = useState<'all' | string>('all');
  const [query, setQuery] = useState('*');
  const [autoRun, setAutoRun] = useState(true);
  const [includeListeners, setIncludeListeners] = useState(false);
  const [detail, setDetail] = useState<TrafficRow | null>(null);
  const [patternDetail, setPatternDetail] = useState<DomainPattern | null>(null);
  const [patternInput, setPatternInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [captureOn, setCaptureOn] = useState<boolean | null>(null);
  const unseen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const traffic = useQuery({
    queryKey: ['traffic', includeListeners],
    queryFn: () => api.traffic(includeListeners),
    refetchInterval: autoRun ? 3000 : false,
  });
  const broker = useQuery({ queryKey: ['broker'], queryFn: api.brokerStatus, refetchInterval: 10000 });
  const patterns = useQuery({ queryKey: ['domainPatterns'], queryFn: api.domainPatterns, refetchInterval: 15000 });
  const status = useQuery({ queryKey: ['domainStatus'], queryFn: api.domainPatternStatus, refetchInterval: 10000 });
  const capture = useQuery({ queryKey: ['captureState'], queryFn: api.captureState, refetchInterval: captureOn ? 5000 : false, enabled: captureOn !== null });

  useEffect(() => {
    if (captureOn === null && capture.data) setCaptureOn(capture.data.on);
  }, [capture.data, captureOn]);

  // Merge rolling rows (append newest, cap at 1800) and mark first unseen ids for pulse.
  const merged = useMemo(() => {
    const incoming = traffic.data?.rows || [];
    const next = new Map<string, TrafficRow>();
    if (initialized.current) {
      for (const r of incoming) unseen.current.add(r.id);
    } else {
      initialized.current = true;
    }
    for (const r of incoming) next.set(r.id, r);
    // rows decay out after they no longer appear for 6 consecutive polls is emulated by cap; order: incoming sorted by id then time desc
    return Array.from(next.values()).sort((a, b) => String(b.time).localeCompare(String(a.time)));
  }, [traffic.data]);

  useEffect(() => {
    const t = setTimeout(() => { unseen.current = new Set(unseen.current); }, 500);
    return () => clearTimeout(t);
  }, [merged.length]);

  const rows = useMemo(() => merged.filter(r =>
    (side === 'all' || r.direction === side) &&
    (verdict === 'all' || r.verdict === verdict) &&
    (proto === 'all' || r.protocol === proto) &&
    (appFilter === 'all' || (r.process || '').toLowerCase() === appFilter) &&
    matchAny([r.remote_ip, String(r.remote_port), r.remote_address, r.local_address, r.state, r.protocol, r.process, r.app, r.hostname, r.direction, r.verdict, r.message], query)
  ).slice(0, 800), [merged, side, verdict, proto, appFilter, query]);

  const appOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of traffic.data?.rows || []) if (r.process) set.set((r.process || '').toLowerCase(), r.process);
    return Array.from(set.values()).sort().slice(0, 300);
  }, [traffic.data]);

  const selectedRows = useMemo(() => {
    const m = new Map(merged.map(r => [r.id, r]));
    return selectedIds.map(id => m.get(id)).filter(Boolean) as TrafficRow[];
  }, [selectedIds, merged]);
  const selectedIps = Array.from(new Set(selectedRows.map(r => r.remote_ip).filter(Boolean)));
  const selectedApps = Array.from(new Set(
    selectedRows.map(r => r.program_path || r.app).filter((p): p is string => !!p && p.toLowerCase().endsWith('.exe')),
  ));

  const addPattern = useMutation({
    mutationFn: (p: string) => api.addDomainPattern(p),
    onSuccess: (_, p) => { app.toast('success', 'Pattern added', `'${p}' resolves against the DNS cache and becomes active on Apply.`); setPatternInput(''); void qc.invalidateQueries(); },
    onError: e => app.toast('error', 'Could not add pattern', String(e)),
  });
  const removePattern = useMutation({
    mutationFn: (id: number) => api.deleteDomainPattern(id),
    onSuccess: () => { void qc.invalidateQueries(); },
  });
  const togglePattern = useMutation({
    mutationFn: (v: { id: number; enabled: boolean }) => api.setDomainPatternEnabled(v.id, v.enabled),
    onSuccess: () => void qc.invalidateQueries(),
  });
  const applyPatterns = useMutation({
    mutationFn: () => api.applyDomainPatterns(),
    onSuccess: r => {
      const ok = r.status === 'ok' || r.status === 'noop' || r.status === 'dry_run';
      app.toast(ok ? 'success' : 'warning', `Apply: ${r.status}`, ok ? `added ${r.add_n} Â· removed ${r.remove_n}` : 'See the pop-up for why â€” broker may need approval.');
      void qc.invalidateQueries();
    },
    onError: e => app.toast('error', 'Apply failed', String(e)),
  });
  const brokerStart = useMutation({
    mutationFn: () => api.brokerStart(),
    onSuccess: r => {
      if (r.status === 'started') app.toast('success', 'Elevated worker running', 'Auto-apply and capture can now run without extra prompts.');
      else app.toast('warning', 'Awaiting UAC approval', r.hint || 'Approve the Windows prompt to start the worker.');
      void qc.invalidateQueries();
    },
    onError: e => app.toast('error', 'Could not start worker', String(e)),
  });
  const auditEnable = useMutation({
    mutationFn: () => api.auditEnable(),
    onSuccess: () => { app.toast('success', 'Packet audit enabled', 'Permitted/blocked connection events now stream into the inspector.'); void qc.invalidateQueries(); },
    onError: e => app.toast('error', 'Could not enable audit', String(e)),
  });
  const captureToggle = useMutation({
    mutationFn: (on: boolean) => api.captureToggle(on),
    onSuccess: r => { setCaptureOn(r.on); app.toast(r.on ? 'success' : 'info', r.on ? 'Kernel capture on' : 'Kernel capture off', r.on ? 'Byte counters per remote endpoint are now collected (admin ETW session).' : 'ETW session stopped.'); void qc.invalidateQueries(); },
    onError: e => app.toast('error', 'Capture toggle failed', String(e)),
  });

  const blockIps = () => app.requestBlock(selectedIps.map(ip => ({
    kind: 'ip' as const, label: ip,
    detail: { remote_ip: ip },
  })));
  const blockApps = () => app.requestBlock(selectedApps.map(p => ({ kind: 'app' as const, label: p.split('\\').pop() || p, sub: p, detail: { program_path: p } })));

  const blockDomainFromRow = (r: TrafficRow) => {
    const dom = r.hostname || '';
    if (!dom) { app.toast('warning', 'No domain to block', 'No DNS cache entry maps this IP to a domain yet.'); return; }
    addPattern.mutate(`*${dom}*`);
  };

  const auditBad = (traffic.data?.audit || []).some(a => {
    const st = (a.state || '').toLowerCase();
    return st.includes('no auditing') || st.startsWith('unknown');
  });

  const columns: DataTableColumn<TrafficRow>[] = [
    {
      columnId: 'time', title: 'Time', compare: (a, b) => String(a.time).localeCompare(String(b.time)), filterValue: r => `${r.time} ${r.state} ${r.event_id}`, defaultSort: 'descending', minWidth: 150,
      cell: r => (
        <span>
          {relTime(r.time)}
          {r.kind === 'conn' && <Secondary>live · {r.state || ''}</Secondary>}
          {r.kind === 'event' && <Secondary>{r.event_id}</Secondary>}
        </span>
      ),
    },
    { columnId: 'verdict', title: 'Verdict', filter: 'select', compare: (a, b) => a.verdict.localeCompare(b.verdict), filterValue: r => r.verdict, cell: r => <Badge appearance="filled" color={verdictColor(r.verdict)}>{r.verdict}</Badge> },
    {
      columnId: 'direction', title: 'Dir', filter: 'select', compare: (a, b) => a.direction.localeCompare(b.direction), filterValue: r => r.direction || 'unknown',
      cell: r => r.direction === 'inbound' ? <Tooltip content="Inbound" relationship="label"><ArrowDown24Regular /></Tooltip>
        : r.direction === 'outbound' ? <Tooltip content="Outbound" relationship="label"><ArrowUp24Regular /></Tooltip> : <Text size={100}>?</Text>,
    },
    {
      columnId: 'app', title: 'Application', compare: (a, b) => (a.process || a.app).localeCompare(b.process || b.app), filterValue: r => `${r.process} ${r.app} ${r.pid} ${(r.services || []).join(' ')}`, minWidth: 220,
      cell: r => (
        <span>
          <b>{r.process || (r.app ? r.app.split('\\').pop() : '(system / no process)')}</b>
          {(r.pid > 0) && <Secondary>PID {r.pid}</Secondary>}
          {r.services?.length ? <Secondary>{r.services.join(', ')}</Secondary> : null}
        </span>
      ),
    },
    { columnId: 'local', title: 'Local', compare: (a, b) => a.local_address.localeCompare(b.local_address), filterValue: r => r.local_address, cell: r => <span style={{ fontFamily: 'Consolas, monospace', fontSize: tokens.fontSizeBase100 }}>{r.local_address || '—'}</span> },
    {
      columnId: 'remote', title: 'Remote', compare: (a, b) => (a.remote_ip + ':' + a.remote_port).localeCompare(b.remote_ip + ':' + b.remote_port), filterValue: r => `${r.remote_ip} ${r.remote_port} ${r.hostname}`, minWidth: 220,
      cell: r => (
        <span>
          <b style={{ fontFamily: 'Consolas, monospace', fontSize: tokens.fontSizeBase200 }}>{r.remote_ip || '—'}</b>
          {r.remote_port ? <Secondary>Port {r.remote_port}</Secondary> : null}
          {r.hostname && <Secondary>{r.hostname}</Secondary>}
        </span>
      ),
    },
    { columnId: 'protocol', title: 'Proto', filter: 'select', compare: (a, b) => a.protocol.localeCompare(b.protocol), filterValue: r => r.protocol || '—', cell: r => <Badge appearance="outline">{r.protocol || '—'}</Badge> },
  ];

  const patternColumns: DataTableColumn<DomainPattern>[] = [
    {
      columnId: 'pattern', title: 'Pattern', compare: (a, b) => a.pattern.localeCompare(b.pattern), filterValue: p => p.pattern, defaultSort: 'ascending', minWidth: 220,
      cell: p => <b>{p.pattern}</b>,
    },
    { columnId: 'enabled', title: 'Active', filter: 'select', compare: (a, b) => Number(a.enabled) - Number(b.enabled), filterValue: p => p.enabled ? 'on' : 'off', cell: p => <Switch size="small" checked={p.enabled} onChange={(_, d) => togglePattern.mutate({ id: p.id, enabled: d.checked })} /> },
    {
      columnId: 'domains', title: 'Resolved domains', compare: (a, b) => (a.resolved?.domains || []).join(',').localeCompare((b.resolved?.domains || []).join(',')), filterValue: p => (p.resolved?.domains || []).join(', '), cell: p => (
        <span>{(p.resolved?.domains || []).slice(0, 3).join(', ') || '—'}{(p.resolved?.domains?.length || 0) > 3 ? ` +${(p.resolved!.domains?.length || 0) - 3}` : ''}</span>
      ),
    },
    { columnId: 'ips', title: 'IPs', filter: 'number', cell: p => String(p.resolved?.ips?.length || 0), compare: (a, b) => (a.resolved?.ips?.length || 0) - (b.resolved?.ips?.length || 0), filterValue: p => p.resolved?.ips?.length || 0 },
    { columnId: 'delta', title: 'Pending', filter: 'select', compare: (a, b) => ((a.resolved?.add_n || 0) + (a.resolved?.remove_n || 0)) - ((b.resolved?.add_n || 0) + (b.resolved?.remove_n || 0)), filterValue: p => ((p.resolved?.add_n || 0) || (p.resolved?.remove_n || 0)) ? 'pending' : 'in sync', cell: p => <>{(p.resolved?.add_n || 0) > 0 && <Badge appearance="filled" color="warning">+{p.resolved?.add_n}</Badge>}{(p.resolved?.remove_n || 0) > 0 && <Badge appearance="filled" color="danger">-{p.resolved?.remove_n}</Badge>}{!(p.resolved?.add_n || 0) && !(p.resolved?.remove_n || 0) && <Badge appearance="outline">in sync</Badge>}</> },
    { columnId: 'created', title: 'Added', cell: p => new Date(p.created).toLocaleString(), compare: (a, b) => a.created.localeCompare(b.created), filterValue: p => new Date(p.created).toLocaleString() },
    { columnId: 'actions', title: 'Action', filter: 'none', cell: p => <Button size="small" appearance="subtle" aria-label="remove" icon={<Delete24Regular />} onClick={() => removePattern.mutate(p.id)}>Remove</Button> },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Live traffic"
        title="Connection inspector"
        desc="Everything this PC exchanges with the network, like your browser's network tab: who is calling, in or out, permitted or blocked, and where the traffic is going."
      />

      <div className={s.stats}>
        <div className={s.statCard}><Globe24Regular /><div><div className={s.statValue}>{traffic.data?.count ?? 'â€”'}</div><div className={s.statLabel}>rows captured</div></div></div>
        <div className={s.statCard}><LockClosed24Regular /><div><div className={s.statValue}>{(traffic.data?.rows || []).filter(r => r.verdict === 'blocked').length}</div><div className={s.statLabel}>blocked events visible</div></div></div>
        <div className={s.statCard}><ArrowTrending24Regular /><div><div className={s.statValue}>{(traffic.data?.rows || []).filter(r => r.direction === 'outbound').length}</div><div className={s.statLabel}>outbound</div></div></div>
        <div className={s.statCard}><ArrowTrendingDown24Regular /><div><div className={s.statValue}>{(traffic.data?.rows || []).filter(r => r.direction === 'inbound').length}</div><div className={s.statLabel}>inbound</div></div></div>
      </div>

      {auditBad && (
        <MessageBar intent="warning" style={{ marginBottom: tokens.spacingVerticalS }}>
          <MessageBarBody>
            Direction/permitted events need the Windows audit policy.{' '}
            <Button size="small" appearance="primary" onClick={() => auditEnable.mutate()} disabled={auditEnable.isPending}>Enable packet audit (one UAC)</Button>
          </MessageBarBody>
        </MessageBar>
      )}

      <div className={s.toggleRow}>
        <Text size={200} weight="semibold">Live stream</Text>
        <Switch checked={autoRun} onChange={(_, d) => setAutoRun(d.checked)} title="Poll every 3 s" />
        <Badge appearance={broker.data?.alive ? 'filled' : 'outline'} color={broker.data?.alive ? 'success' : 'warning'}>
          {broker.data?.alive ? `worker pid ${broker.data.info?.pid} Â· ${Math.round(broker.data.info?.age || 0)}s` : 'worker off'}
        </Badge>
        {!broker.data?.alive && (
          <Button size="small" appearance="primary" onClick={() => brokerStart.mutate()} disabled={brokerStart.isPending}>Start elevated worker (one-time UAC)</Button>
        )}
        <Switch checked={captureOn ?? false} onChange={(_, d) => captureToggle.mutate(d.checked)} disabled={captureOn === null} title="Kernel Network ETW byte capture (admin)" />
        <Text size={200}>{captureOn ? 'Byte capture: ON' : 'Byte capture: off'}</Text>
        <Switch checked={includeListeners} onChange={(_, d) => setIncludeListeners(d.checked)} />
        <Text size={200}>Show listeners</Text>
      </div>

      <Panel title="Live network traffic" subtitle={`${rows.length} of ${merged.length} rows shown Â· auto-run ${autoRun ? 'on' : 'paused'}`}
        action={
          <Button size="small" appearance="subtle" aria-label="clear-filters" onClick={() => { setSide('all'); setVerdict('all'); setProto('all'); setAppFilter('all'); setQuery('*'); setSelectedIds([]); }}>Reset filters</Button>
        }>
        <div className={s.filterRow}>
          <Select size="small" value={side} onChange={(_, d) => setSide(d.value as Side)} aria-label="Direction filter">
            <option value="all">Direction: all</option><option value="outbound">Outbound</option><option value="inbound">Inbound</option>
          </Select>
          <Select size="small" value={verdict} onChange={(_, d) => setVerdict(d.value as Verdict)} aria-label="Verdict filter">
            <option value="all">Verdict: all</option><option value="permitted">Permitted</option><option value="blocked">Blocked</option><option value="live">Live</option>
          </Select>
          <Select size="small" value={proto} onChange={(_, d) => setProto(d.value as 'all' | 'TCP' | 'UDP')} aria-label="Protocol filter">
            <option value="all">Protocol: all</option><option value="TCP">TCP</option><option value="UDP">UDP</option>
          </Select>
          <Select size="small" value={appFilter} onChange={(_, d) => setAppFilter(d.value as string)} aria-label="Application filter">
            <option value="all">Application: all</option>
            {appOptions.map(o => <option key={o} value={(o || '').toLowerCase()}>{o}</option>)}
          </Select>
          <SearchBox className={s.searchBox} placeholder="Filter with wildcardsâ€¦"
            value={query === '*' ? '' : query} onChange={(_, d) => setQuery(d.value || '*')} contentBefore={<Search24Regular />} aria-label="Wildcard search" />
        </div>

        {selectedIds.length > 0 && (
          <div className={s.selectionBar}>
            <Text size={200} weight="semibold">{selectedRows.length} selected</Text>
            <Toolbar aria-label="Selection actions" style={{ background: 'transparent' }}>
              <ToolbarGroup>
                <Button size="small" appearance="primary" icon={<LockClosed24Regular />} disabled={!selectedIps.length} onClick={blockIps}>Block {selectedIps.length} IP{selectedIps.length === 1 ? '' : 's'}</Button>
                <Button size="small" appearance="secondary" icon={<LockClosed24Regular />} disabled={!selectedApps.length} onClick={blockApps}>Block {selectedApps.length} app{selectedApps.length === 1 ? '' : 's'}</Button>
                <Button size="small" appearance="subtle" onClick={() => setSelectedIds([])}>Clear</Button>
              </ToolbarGroup>
            </Toolbar>
          </div>
        )}

        <DataTable<TrafficRow>
          items={rows}
          columns={columns}
          getRowId={r => r.id}
          ariaLabel="Live traffic rows"
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={setDetail}
          loading={traffic.isLoading}
          loadingLabel="Sampling live trafficâ€¦"
          emptyText="No traffic matches the filters yet. Enable packet audit for direction and verdict coverage."
        />
      </Panel>

      <p style={{ color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100 }}>
        Domains come from the local Windows DNS resolver cache (no TLS inspection, privacy-respecting). Byte counts appear with "Kernel capture" on and cover TCP; exact figures refresh every ~5 s.
      </p>

      <Panel title="Domain block rules" subtitle={`Wildcard patterns auto-resolved into IP block rules Â· ${status.data ? `${status.data.add_n} new, ${status.data.remove_n} stale` : 'â€¦'}`}
        action={
          <Button size="small" appearance="primary" icon={<LockClosed24Regular />} onClick={() => applyPatterns.mutate()} disabled={applyPatterns.isPending}>
            {applyPatterns.isPending ? 'Applyingâ€¦' : `Refresh & apply${status.data?.add_n ? ` (+${status.data.add_n})` : ''}`}
          </Button>
        }>
        <div className={s.filterRow}>
          <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Label size="small">Add pattern (wildcards, e.g. *microsoft.com*)</Label>
              <Input value={patternInput} onChange={(_, d) => setPatternInput(d.value)}
                placeholder="*ads.example.com*"
                contentBefore={<Search24Regular />} aria-label="New wildcard pattern"
                onKeyDown={e => { if (e.key === 'Enter' && patternInput.trim()) addPattern.mutate(patternInput.trim()); }} />
            </div>
            <Button appearance="primary" icon={<Add24Regular />} disabled={!patternInput.trim() || addPattern.isPending} onClick={() => addPattern.mutate(patternInput.trim())}>Add pattern</Button>
          </div>
        </div>
        <DataTable<DomainPattern>
          items={patterns.data?.patterns || []}
          columns={patternColumns}
          getRowId={p => String(p.id)}
          ariaLabel="Domain block patterns"
          onRowClick={setPatternDetail}
          loading={patterns.isLoading}
          loadingLabel="Evaluating patterns against DNS cacheâ€¦"
          emptyText="No domain patterns yet. Add *example.com* style patterns above; the worker keeps their IPs blocked automatically."
        />
        {status.data?.dry_run && (
          <MessageBar intent="warning" style={{ marginTop: tokens.spacingVerticalS }}>
            <MessageBarBody>Dry-run is on: Apply only records intent. Turn dry-run off (header switch) for live blocking.</MessageBarBody>
          </MessageBar>
        )}
      </Panel>

      {patternDetail && (
        <DetailDrawer
          title={patternDetail.pattern}
          subtitle={patternDetail.enabled ? 'Enabled' : 'Disabled'}
          onClose={() => setPatternDetail(null)}
          items={[
            { label: 'Resolved domains', value: (patternDetail.resolved?.domains || []).join(', ') },
            { label: 'Resolved IPs', value: (patternDetail.resolved?.ips || []).join(', ') },
            { label: 'Active rules', value: patternDetail.resolved?.active_rules },
            { label: 'To add', value: patternDetail.resolved?.add_n },
            { label: 'To remove', value: patternDetail.resolved?.remove_n },
            { label: 'Added', value: patternDetail.created ? new Date(patternDetail.created).toLocaleString() : undefined },
            { label: 'Last applied', value: patternDetail.last_applied ? new Date(patternDetail.last_applied).toLocaleString() : undefined },
          ]}
        />
      )}
      <Drawer open={!!detail} position="end" type="overlay" onOpenChange={(_, d) => { if (!d.open) setDetail(null); }} style={{ minWidth: 420, maxWidth: 560 }}>
        <DrawerHeader>
          <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={() => setDetail(null)} />}>
            {detail?.process || detail?.hostname || detail?.remote_ip || 'Traffic detail'}
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody>
          {detail && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <Badge appearance="filled" color={verdictColor(detail.verdict)}>{detail.verdict}</Badge>
                {detail.direction && <Badge appearance="outline">{detail.direction}</Badge>}
                <Badge appearance="outline">{detail.kind === 'conn' ? 'live socket' : 'WFP event'}</Badge>
                {detail.protocol && <Badge appearance="outline">{detail.protocol}</Badge>}
                {detail.state && <Badge appearance="outline">{detail.state}</Badge>}
              </div>
              <div className={s.msgPre}>{detail.message || 'No event message for live sockets.'}</div>
              <div style={{ display: 'grid', gap: '4px', fontSize: tokens.fontSizeBase200 }}>
                <span><b>Remote:</b> {detail.remote_ip + (detail.remote_port ? ':' + detail.remote_port : '')}</span>
                <span><b>Hostname:</b> {detail.hostname || 'â€”'}</span>
                <span><b>Local:</b> {detail.local_address || 'â€”'}</span>
                <span><b>App:</b> <PathCell value={detail.program_path || detail.app} /></span>
                <span><b>PID:</b> {detail.pid || 'â€”'}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {detail.remote_ip && <Button size="small" appearance="primary" icon={<LockClosed24Regular />} onClick={() => { app.requestBlock([{ kind: 'ip', label: detail.remote_ip, detail: { remote_ip: detail.remote_ip } }]); setDetail(null); }}>Block IP {detail.remote_ip}</Button>}
                {(detail.program_path || detail.app || '').toLowerCase().endsWith('.exe') && <Button size="small" icon={<LockClosed24Regular />} onClick={() => { app.requestBlock([{ kind: 'app', label: ((detail.program_path || detail.app).split('\\').pop() || 'app'), sub: detail.program_path || detail.app, detail: { program_path: detail.program_path || detail.app } }]); setDetail(null); }}>Block app</Button>}
                <Button size="small" onClick={() => { blockDomainFromRow(detail); setDetail(null); }}>Block domain pattern{detail.hostname ? '' : ' (no hostname yet)'}</Button>
              </div>
            </div>
          )}
        </DrawerBody>
      </Drawer>
    </>
  );
}

