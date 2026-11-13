import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge, Button, MessageBar, MessageBarBody, MessageBarTitle, SearchBox, Tab, TabList, Text,
  makeStyles, tokens,
} from '@fluentui/react-components';
import { Delete24Regular, Search24Regular } from '@fluentui/react-icons';
import { api, type LiveRule, type ManagedRule } from '../api';
import { useApp } from '../appContext';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { DetailDrawer } from '../components/DetailDrawer';
import { PageIntro, Panel, PathCell, Secondary, StatusBadge, matchAny } from '../components/ui';

const useStyles = makeStyles({
  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: tokens.spacingVerticalS },
  searchBox: { maxWidth: '420px', flex: '1 1 320px' },
  selectionBar: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, padding: '6px 10px', marginBottom: tokens.spacingVerticalXS, borderRadius: tokens.borderRadiusMedium, background: tokens.colorBrandBackground2 },
});

function targetLabelFromJson(raw: string): string {
  try {
    const t = JSON.parse(raw);
    if (t.program_path) return String(t.program_path);
    if (t.service_name) return `service ${t.service_name}`;
    if (t.remote_ip) return String(t.remote_ip);
    return 'unscoped target';
  } catch {
    return raw.slice(0, 200);
  }
}

export function RulesPage() {
  const s = useStyles();
  const app = useApp();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'managed' | 'live'>('managed');
  const [filter, setFilter] = useState('*');
  const [selectedManaged, setSelectedManaged] = useState<string[]>([]);
  const [selectedLive, setSelectedLive] = useState<string[]>([]);
  const [managedDetail, setManagedDetail] = useState<ManagedRule | null>(null);
  const [liveDetail, setLiveDetail] = useState<LiveRule | null>(null);

  const managed = useQuery({ queryKey: ['rules'], queryFn: api.managedRules, refetchInterval: 5000 });
  const live = useQuery({
    queryKey: ['firewallRules'],
    queryFn: () => api.firewallRules('block'),
    staleTime: 30_000,
    refetchInterval: 0,
  });

  const managedRows = useMemo(() => (managed.data || []).filter(r =>
    matchAny([r.name, r.policy_id, r.status, r.target, r.created], filter)), [managed.data, filter]);
  const liveRules = live.data || [];
  const liveRows = useMemo(() => liveRules.filter(r =>
    matchAny([r.name, r.group, r.action, r.direction, r.profile, r.program, r.service, r.protocol], filter)), [liveRules, filter]);

  const removeSingle = useMutation({
    mutationFn: (name: string) => api.remove(name),
    onSuccess: () => { void qc.invalidateQueries(); app.toast('success', 'Rule removed and verified', 'Check Windows Firewall if connectivity remains blocked.'); },
    onError: e => app.toast('error', 'Rule removal failed', String(e)),
  });

  const managedById = useMemo(() => new Map((managed.data || []).map(r => [r.name, r])), [managed.data]);
  const selectedManagedRules = selectedManaged.map(n => managedById.get(n)).filter(Boolean) as ManagedRule[];

  const liveById = useMemo(() => new Map(liveRules.map(r => [r.name, r])), [liveRules]);
  const selectedLiveRules = selectedLive.map(n => liveById.get(n)).filter(Boolean) as LiveRule[];

  const managedColumns: DataTableColumn<ManagedRule>[] = [
    { columnId: 'created', title: 'Created', compare: (a, b) => a.created.localeCompare(b.created), filterValue: r => new Date(r.created).toLocaleString(), defaultSort: 'descending', minWidth: 180, cell: r => new Date(r.created).toLocaleString() },
    { columnId: 'name', title: 'Rule name', compare: (a, b) => a.name.localeCompare(b.name), filterValue: r => `${r.name} ${r.policy_id}`, minWidth: 260, cell: r => <><b>{r.name}</b><Secondary>{r.policy_id}</Secondary></> },
    { columnId: 'target', title: 'Scope / target', compare: (a, b) => targetLabelFromJson(a.target).localeCompare(targetLabelFromJson(b.target)), filterValue: r => targetLabelFromJson(r.target), cell: r => <PathCell value={targetLabelFromJson(r.target)} /> },
    { columnId: 'status', title: 'Status', filter: 'select', compare: (a, b) => a.status.localeCompare(b.status), filterValue: r => r.status, cell: r => <StatusBadge value={r.status} /> },
    {
      columnId: 'actions', title: 'Action', filter: 'none', cell: r => (
        <Button size="small" appearance="secondary" icon={<Delete24Regular />} disabled={r.status !== 'created' || removeSingle.isPending} aria-label="unblock" onClick={e => { e.stopPropagation(); removeSingle.mutate(r.name); }}>
          Unblock / remove
        </Button>
      ),
    },
  ];

  const liveColumns: DataTableColumn<LiveRule>[] = [
    { columnId: 'name', title: 'Rule', compare: (a, b) => a.name.localeCompare(b.name), filterValue: x => `${x.name} ${x.group}`, defaultSort: 'ascending', minWidth: 260, cell: x => <><b>{x.name}</b><Secondary>{x.group}</Secondary></> },
    { columnId: 'direction', title: 'Direction', filter: 'select', compare: (a, b) => a.direction.localeCompare(b.direction), filterValue: x => x.direction, cell: x => <Badge appearance="outline">{x.direction}</Badge> },
    { columnId: 'action', title: 'Action', filter: 'select', compare: (a, b) => a.action.localeCompare(b.action), filterValue: x => x.action, cell: x => <StatusBadge value={x.action} /> },
    { columnId: 'profile', title: 'Profile', filter: 'select', compare: (a, b) => a.profile.localeCompare(b.profile), filterValue: x => x.profile, cell: x => x.profile },
    { columnId: 'program', title: 'Program', compare: (a, b) => a.program.localeCompare(b.program), filterValue: x => x.program, minWidth: 240, cell: x => <PathCell value={x.program} /> },
    { columnId: 'service', title: 'Service', compare: (a, b) => a.service.localeCompare(b.service), filterValue: x => x.service, minWidth: 200, cell: x => x.service || '—' },
    { columnId: 'filters', title: 'Addresses / ports', compare: (a, b) => (a.remote_addresses || '').localeCompare(b.remote_addresses || ''), filterValue: x => `${x.remote_addresses || ''} ${x.remote_ports || ''} ${x.local_ports || ''} ${x.protocol || ''}`, cell: x => <><span>{x.remote_addresses || 'Any'}</span>{x.remote_ports ? <Secondary>ports: {x.remote_ports}</Secondary> : null}</> },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Enforcement control"
        title="Managed firewall rules"
        desc="Inspect and unblock rules this app created, plus honour the full live Windows block-rule inventory in one view."
      />
      <div className={s.toolbar}>
        <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as 'managed' | 'live')}>
          <Tab value="managed">Managed ({managed.data?.length ?? 0})</Tab>
          <Tab value="live">Live Windows block rules ({liveRules.length})</Tab>
        </TabList>
        <SearchBox
          className={s.searchBox}
          placeholder="Filter rules, group, program, target…"
          value={filter === '*' ? '' : filter}
          onChange={(_, d) => setFilter(d.value || '*')}
          contentBefore={<Search24Regular />}
          aria-label="Wildcard search"
        />
      </div>

      {tab === 'managed' && (
        <Panel title="App-managed rules" subtitle={`${managedRows.length} matching rules recorded`}>
          {selectedManaged.length > 0 && (
            <div className={s.selectionBar}>
              <Text size={200} weight="semibold">{selectedManaged.length} selected</Text>
              <Button size="small" appearance="primary" icon={<Delete24Regular />} onClick={() =>
                app.requestUnblock(selectedManagedRules.map(r => ({ name: r.name, label: r.name, sub: targetLabelFromJson(r.target) })))
              }>Unblock selected ({app.dry ? 'dry-run' : 'live'})</Button>
              <Button size="small" appearance="subtle" onClick={() => setSelectedManaged([])}>Clear</Button>
            </div>
          )}
          <DataTable<ManagedRule>
            items={managedRows}
            columns={managedColumns}
            getRowId={r => r.name}
            ariaLabel="Managed firewall rules"
            selectable
            selectedIds={selectedManaged}
            onSelectionChange={setSelectedManaged}
            onRowClick={setManagedDetail}
            loading={managed.isLoading}
            loadingLabel="Loading rule inventory…"
            emptyText="No managed rules yet. Select a process, service or IP and choose Block."
          />
          <MessageBar intent="info" style={{ marginTop: tokens.spacingVerticalS }}>
            <MessageBarBody><MessageBarTitle>Unblock removes the app-owned block rule</MessageBarTitle>Other Windows or third-party rules may still block the same traffic.</MessageBarBody>
          </MessageBar>
        </Panel>
      )}

      {tab === 'live' && (
        <Panel title="Live Windows block rules" subtitle={`${liveRows.length} enabled block rules · loaded once per visit`}>
          {selectedLive.length > 0 && (
            <div className={s.selectionBar}>
              <Text size={200} weight="semibold">{selectedLive.length} selected</Text>
              <Button size="small" appearance="subtle" onClick={() => setSelectedLive([])}>Clear</Button>
            </div>
          )}
          <DataTable<LiveRule>
            items={liveRows}
            columns={liveColumns}
            getRowId={x => x.name}
            ariaLabel="Live Windows block rules"
            selectable
            selectedIds={selectedLive}
            onSelectionChange={setSelectedLive}
            onRowClick={setLiveDetail}
            loading={live.isLoading}
            loadingLabel="Querying Get-NetFirewallRule…"
            emptyText="No enabled block rules match the filter."
          />
          <MessageBar intent="info" style={{ marginTop: tokens.spacingVerticalS }}>
            <MessageBarBody>Selection on this tab is informational: inventory only. Create new block rules from the Processes, Connections, or Events pages.</MessageBarBody>
          </MessageBar>
        </Panel>
      )}
      {managedDetail && (
        <DetailDrawer
          title={managedDetail.name}
          subtitle={managedDetail.policy_id}
          onClose={() => setManagedDetail(null)}
          items={[
            { label: 'Status', value: managedDetail.status },
            { label: 'Created', value: new Date(managedDetail.created).toLocaleString() },
            { label: 'Scope', value: targetLabelFromJson(managedDetail.target) },
            { label: 'Target', value: <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'Consolas, monospace', fontSize: 12 }}>{managedDetail.target}</pre> },
          ]}
        />
      )}
      {liveDetail && (
        <DetailDrawer
          title={liveDetail.name}
          subtitle={liveDetail.group}
          onClose={() => setLiveDetail(null)}
          items={[
            { label: 'Direction', value: liveDetail.direction },
            { label: 'Action', value: liveDetail.action },
            { label: 'Profile', value: liveDetail.profile },
            { label: 'Enabled', value: liveDetail.enabled },
            { label: 'Protocol', value: liveDetail.protocol },
            { label: 'Program', value: <PathCell value={liveDetail.program} /> },
            { label: 'Service', value: liveDetail.service },
            { label: 'Remote addresses', value: liveDetail.remote_addresses },
            { label: 'Remote ports', value: liveDetail.remote_ports },
            { label: 'Local ports', value: liveDetail.local_ports },
          ]}
        />
      )}
    </>
  );
}

