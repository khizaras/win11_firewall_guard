import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, MessageBar, MessageBarBody, SearchBox, Text, Toolbar, ToolbarGroup, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowShuffle24Regular, Desktop24Regular, LockClosed24Regular, PlugConnected24Regular, Search24Regular } from '@fluentui/react-icons';
import { api, type Proc, type Service } from '../api';
import { useApp } from '../appContext';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { DetailDrawer } from '../components/DetailDrawer';
import { ProcessDetailDrawer } from '../components/ProcessDetailDrawer';
import { PageIntro, Panel, PathCell, Secondary, StatusBadge, fmtBytes, fmtRate, matchAny } from '../components/ui';

const useStyles = makeStyles({
  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: tokens.spacingVerticalS, flexWrap: 'wrap' as const },
  searchBox: { maxWidth: '420px', flex: '1 1 320px' },
  selectionBar: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, padding: '6px 10px', marginBottom: tokens.spacingVerticalXS, borderRadius: tokens.borderRadiusMedium, background: tokens.colorBrandBackground2 },
  tabsRow: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center', marginBottom: tokens.spacingVerticalS },
});

export function ProcessesPage() {
  const s = useStyles();
  const app = useApp();
  const [tab, setTab] = useState<'services' | 'processes'>('services');
  const [filter, setFilter] = useState('*');
  const [selServiceIds, setSelServiceIds] = useState<string[]>([]);
  const [selProcIds, setSelProcIds] = useState<string[]>([]);
  const [detailProc, setDetailProc] = useState<Proc | null>(null);
  const [detailService, setDetailService] = useState<Service | null>(null);

  const services = useQuery({ queryKey: ['services'], queryFn: api.services, refetchInterval: 10000 });
  const processes = useQuery({ queryKey: ['processes'], queryFn: api.processes, refetchInterval: 5000 });

  const svcRows = (services.data || []).filter(x => matchAny([x.name, x.display_name, x.status, x.username, x.binpath, String(x.pid), x.start_type, x.description], filter));
  const procRows = (processes.data || []).filter(p => matchAny([p.pid, p.process, p.program_path, p.username, p.status, p.ppid, ...(p.services || [])], filter));
  const svcById = useMemo(() => new Map((services.data || []).map(x => [x.name, x])), [services.data]);
  const procById = useMemo(() => new Map((processes.data || []).map(p => [String(p.pid), p])), [processes.data]);

  const serviceColumns: DataTableColumn<Service>[] = [
    { columnId: 'display_name', title: 'Service', compare: (a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name), filterValue: x => `${x.display_name || x.name} ${x.name}`, defaultSort: 'ascending', minWidth: 240, cell: x => (<><b>{x.display_name || x.name}</b><Secondary>{x.name}</Secondary></>) },
    { columnId: 'status', title: 'Status', filter: 'select', compare: (a, b) => a.status.localeCompare(b.status), filterValue: x => x.status, cell: x => <StatusBadge value={x.status} /> },
    { columnId: 'pid', title: 'PID', filter: 'number', compare: (a, b) => a.pid - b.pid, filterValue: x => x.pid, cell: x => x.pid || '—' },
    { columnId: 'start_type', title: 'Start type', filter: 'select', compare: (a, b) => a.start_type.localeCompare(b.start_type), filterValue: x => x.start_type, cell: x => x.start_type },
    { columnId: 'username', title: 'Logon account', compare: (a, b) => a.username.localeCompare(b.username), filterValue: x => x.username, cell: x => x.username || '—' },
    { columnId: 'binpath', title: 'Executable / command', compare: (a, b) => a.binpath.localeCompare(b.binpath), filterValue: x => x.binpath, minWidth: 320, cell: x => <PathCell value={x.binpath} /> },
  ];

  const procColumns: DataTableColumn<Proc>[] = [
    { columnId: 'process', title: 'Process', compare: (a, b) => a.process.localeCompare(b.process), filterValue: x => `${x.process} ${x.status} ${x.parent_name || ''}`, defaultSort: 'ascending', minWidth: 220, cell: x => (<><b>{x.process || '(unknown)'}</b><Secondary>{x.status}{x.parent_name ? ` · parent ${x.parent_name}` : x.ppid ? ` · pid ${x.ppid}` : ''}</Secondary></>) },
    { columnId: 'pid', title: 'PID', filter: 'number', compare: (a, b) => a.pid - b.pid, filterValue: x => x.pid, cell: x => x.pid },
    { columnId: 'services', title: 'Service association', compare: (a, b) => a.services.join(',').localeCompare(b.services.join(',')), filterValue: x => x.services.join(', '), cell: x => x.services.join(', ') || '—' },
    { columnId: 'cpu', title: 'CPU %', filter: 'number', compare: (a, b) => (a.cpu_percent || 0) - (b.cpu_percent || 0), filterValue: x => x.cpu_percent ?? 0, cell: x => (x.cpu_percent ?? '—') + '%' },
    { columnId: 'memory', title: 'Memory', filter: 'number', compare: (a, b) => (a.memory_bytes || 0) - (b.memory_bytes || 0), filterValue: x => x.memory_percent ?? 0, cell: x => <span>{fmtBytes(x.memory_bytes)}<Secondary>{x.memory_percent ?? '—'}% · {x.threads || 0} threads</Secondary></span> },
    { columnId: 'io', title: 'Disk I/O', filter: 'number', compare: (a, b) => ((a.io_read_bytes_per_sec || 0) + (a.io_write_bytes_per_sec || 0)) - ((b.io_read_bytes_per_sec || 0) + (b.io_write_bytes_per_sec || 0)), filterValue: x => Math.round((x.io_read_bytes_per_sec || 0) + (x.io_write_bytes_per_sec || 0)), cell: x => <span>{fmtRate(x.io_read_bytes_per_sec)} rd<br />{fmtRate(x.io_write_bytes_per_sec)} wr</span> },
    { columnId: 'path', title: 'Executable path', compare: (a, b) => a.program_path.localeCompare(b.program_path), filterValue: x => x.program_path, minWidth: 300, cell: x => <PathCell value={x.program_path} /> },
  ];

  const selectedServices = selServiceIds.map(id => svcById.get(id)).filter(Boolean) as Service[];
  const selectedProcs = selProcIds.map(id => procById.get(id)).filter(Boolean) as Proc[];
  const blockableProcs = selectedProcs.filter(p => p.program_path?.toLowerCase().endsWith('.exe'));

  const blockSelectedServices = () => app.requestBlock(selectedServices.map(x => ({
    kind: 'service' as const, label: x.display_name || x.name, sub: x.name,
    detail: { service_name: x.name },
  })));
  const blockSelectedProcs = () => app.requestBlock(blockableProcs.map(p => ({
    kind: 'app' as const, label: p.process, sub: p.program_path,
    detail: { program_path: p.program_path },
  })));

  return (
    <>
      <PageIntro
        eyebrow="Process intelligence"
        title="Processes & Windows services"
        desc="Search by wildcard, inspect a process in detail, and create scoped outbound block rules for one or many executables or services."
      />
      <div className={s.toolbar}>
        <SearchBox
          className={s.searchBox}
          placeholder="Search with wildcards: *update*, *svc*, 1??4…"
          value={filter === '*' ? '' : filter}
          onChange={(_, d) => setFilter(d.value || '*')}
          contentBefore={<Search24Regular />}
          aria-label="Wildcard search"
        />
        {filter === '*' && <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Leave empty to show everything (implicit *).</Text>}
      </div>
      <div className={s.tabsRow}>
        <Button appearance={tab === 'services' ? 'primary' : 'secondary'} icon={<PlugConnected24Regular />} onClick={() => setTab('services')}>Services</Button>
        <Button appearance={tab === 'processes' ? 'primary' : 'secondary'} icon={<Desktop24Regular />} onClick={() => setTab('processes')}>Processes</Button>
      </div>

      {tab === 'services' && (
        <Panel title="Windows service inventory" subtitle={`${svcRows.length} matching services · selection: ${selServiceIds.length}`}>
          {selServiceIds.length > 0 && (
            <div className={s.selectionBar} style={{ background: tokens.colorBrandBackground2 }}>
              <Text size={200} weight="semibold">{selServiceIds.length} selected</Text>
              <Toolbar aria-label="Bulk service actions" style={{ background: 'transparent' }}>
                <ToolbarGroup>
                  <Button size="small" appearance="primary" icon={<LockClosed24Regular />} disabled={!selectedServices.length} onClick={blockSelectedServices}>Block services (1 rule each)</Button>
                  <Button size="small" appearance="subtle" onClick={() => setSelServiceIds([])}>Clear</Button>
                </ToolbarGroup>
              </Toolbar>
            </div>
          )}
          <DataTable<Service>
            items={svcRows.slice(0, 600)}
            columns={serviceColumns}
            getRowId={x => x.name}
            ariaLabel="Windows service inventory"
            selectable
            selectedIds={selServiceIds}
            onSelectionChange={setSelServiceIds}
            onRowClick={setDetailService}
            loading={services.isLoading}
            loadingLabel="Loading Windows services…"
            emptyText="No services match. Try * to list all services."
          />
        </Panel>
      )}

      {tab === 'processes' && (
        <Panel title="Running process inventory" subtitle={`${procRows.length} matching processes`}>
          {selProcIds.length > 0 && (
            <div className={s.selectionBar}>
              <Text size={200} weight="semibold">{selProcIds.length} selected</Text>
              <Toolbar aria-label="Bulk process actions" style={{ background: 'transparent' }}>
                <ToolbarGroup>
                  <Button size="small" appearance="primary" icon={<LockClosed24Regular />} disabled={!blockableProcs.length} onClick={blockSelectedProcs}>Block {blockableProcs.length} .exe target{blockableProcs.length === 1 ? '' : 's'}</Button>
                  <Button size="small" appearance="subtle" onClick={() => setSelProcIds([])}>Clear</Button>
                </ToolbarGroup>
              </Toolbar>
              {!blockableProcs.length && <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Selections without an .exe path cannot be blocked.</Text>}
            </div>
          )}
          <DataTable<Proc>
            items={procRows.slice(0, 400)}
            columns={procColumns}
            getRowId={p => String(p.pid)}
            ariaLabel="Running process inventory"
            selectable
            selectedIds={selProcIds}
            onSelectionChange={setSelProcIds}
            onRowClick={setDetailProc}
            loading={processes.isLoading}
            loadingLabel="Loading process inventory…"
            emptyText="No processes match."
          />
          <MessageBar intent="info" style={{ marginTop: tokens.spacingVerticalS }}>
            <MessageBarBody><ArrowShuffle24Regular style={{ verticalAlign: 'middle', marginRight: 8 }} />Click any row to open the detail drawer before deciding to block.</MessageBarBody>
          </MessageBar>
        </Panel>
      )}

      <ProcessDetailDrawer proc={detailProc} onOpenChange={open => { if (!open) setDetailProc(null); }} />
      {detailService && (
        <DetailDrawer
          title={detailService.display_name || detailService.name}
          subtitle={detailService.name}
          pid={detailService.pid || undefined}
          onClose={() => setDetailService(null)}
          items={[
            { label: 'Status', value: detailService.status },
            { label: 'PID', value: detailService.pid || 'Not running' },
            { label: 'Start type', value: detailService.start_type },
            { label: 'Logon account', value: detailService.username },
            { label: 'Executable', value: <PathCell value={detailService.binpath} /> },
            { label: 'Description', value: detailService.description },
            { label: 'Installed', value: detailService.install_date },
          ]}
        />
      )}
    </>
  );
}

