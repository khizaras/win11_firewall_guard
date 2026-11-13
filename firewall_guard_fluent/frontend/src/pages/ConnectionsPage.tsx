import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, MessageBar, MessageBarBody, SearchBox, Switch, Text, Toolbar, ToolbarGroup, Badge, makeStyles, tokens } from '@fluentui/react-components';
import { Globe24Regular, LockClosed24Regular, Search24Regular } from '@fluentui/react-icons';
import { api, type Conn } from '../api';
import { useApp } from '../appContext';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { DetailDrawer } from '../components/DetailDrawer';
import { PageIntro, Panel, PathCell, Secondary, matchAny } from '../components/ui';

const useStyles = makeStyles({
  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: tokens.spacingVerticalS, flexWrap: 'wrap' as const },
  searchBox: { maxWidth: '420px', flex: '1 1 320px' },
  selectionBar: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, padding: '6px 10px', marginBottom: tokens.spacingVerticalXS, borderRadius: tokens.borderRadiusMedium, background: tokens.colorBrandBackground2 },
  panelRow: { marginTop: tokens.spacingVerticalS },
});

export function ConnectionsPage() {
  const s = useStyles();
  const app = useApp();
  const [filter, setFilter] = useState('*');
  const [showListeners, setShowListeners] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Conn | null>(null);

  const conns = useQuery({
    queryKey: ['connections', showListeners],
    queryFn: () => api.connections(showListeners),
    refetchInterval: 5000,
  });

  const rows = (conns.data || []).filter((c: Conn) =>
    matchAny([c.pid, c.process, c.protocol as string, c.family, c.local_address, c.remote_address, c.state as string, c.program_path, ...(c.services || [])], filter));
  const byId = useMemo(() => new Map((conns.data || []).map((c: Conn) => [String(c.pid) + (c as Conn).remote_address, c])), [conns.data]);

  const columns: DataTableColumn<Conn>[] = [
    { columnId: 'process', title: 'Process', compare: (a, b) => a.process.localeCompare(b.process), filterValue: x => `${x.process} ${x.pid} ${(x.services || []).join(' ')}`, defaultSort: 'ascending', minWidth: 220, cell: x => (<><b>{x.process}</b><Secondary>PID {x.pid}{x.services?.length ? ' · ' + x.services.join(', ') : ''}</Secondary></>) },
    { columnId: 'protocol', title: 'Protocol', filter: 'select', compare: (a, b) => a.protocol.localeCompare(b.protocol), filterValue: x => x.protocol, cell: x => <Badge appearance="outline">{x.protocol}</Badge> },
    { columnId: 'local', title: 'Local endpoint', compare: (a, b) => a.local_address.localeCompare(b.local_address), filterValue: x => x.local_address, minWidth: 170, cell: x => x.local_address || '—' },
    { columnId: 'remote', title: 'Remote endpoint', compare: (a, b) => a.remote_address.localeCompare(b.remote_address), filterValue: x => `${x.remote_ip} ${x.remote_port} ${x.listener ? 'listener' : ''}`, minWidth: 220, cell: x => <><b>{x.remote_ip || '—'}</b><Secondary>Port {x.remote_port || '—'}{x.listener ? ' · listener' : ''}</Secondary></> },
    { columnId: 'state', title: 'State', filter: 'select', compare: (a, b) => String(a.state).localeCompare(String(b.state)), filterValue: x => x.state || '—', cell: x => x.state || '—' },
    { columnId: 'path', title: 'Executable', compare: (a, b) => a.program_path.localeCompare(b.program_path), filterValue: x => x.program_path, minWidth: 280, cell: x => <PathCell value={x.program_path} /> },
  ];

  const selectedConns = selected.map(id => byId.get(id)).filter(Boolean) as Conn[];
  const selectedIps = useMemo(() => Array.from(new Set(selectedConns.map(c => c.remote_ip).filter(Boolean))), [selectedConns]);

  const blockSelected = () => {
    const items = selectedIps.map(ip => {
      const sample = selectedConns.find(c => c.remote_ip === ip);
      return {
        kind: 'ip' as const,
        label: ip,
        sub: sample?.remote_address,
        detail: { remote_ip: ip },
      };
    });
    app.requestBlock(items);
  };

  return (
    <>
      <PageIntro
        eyebrow="Network activity"
        title="Know where your PC is connecting."
        desc="Live TCP/UDP endpoint inventory across IPv4 and IPv6. Select one row or many, group them by destination, and apply destination blocks."
      />
      <div className={s.toolbar}>
        <SearchBox
          className={s.searchBox}
          placeholder="Filter process, IP, port, protocol, service…"
          value={filter === '*' ? '' : filter}
          onChange={(_, d) => setFilter(d.value || '*')}
          contentBefore={<Search24Regular />}
          aria-label="Wildcard search"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch checked={showListeners} onChange={(_, d) => setShowListeners(d.checked)} />
          <Text size={200}>Show listeners (local, no remote address)</Text>
        </div>
      </div>
      <Panel title="Active remote endpoints" subtitle={`${rows.length} matching connections · refreshes every 5 seconds`}>
        {selected.length > 0 && (
          <div className={s.selectionBar}>
            <Text size={200} weight="semibold">{selectedConns.length} connections selected</Text>
            <Toolbar aria-label="Bulk connection actions" style={{ background: 'transparent' }}>
              <ToolbarGroup>
                <Button size="small" appearance="primary" icon={<LockClosed24Regular />} disabled={!selectedIps.length} onClick={blockSelected}>
                  Block {selectedIps.length} destination IP{selectedIps.length === 1 ? '' : 's'}
                </Button>
                <Button size="small" appearance="subtle" onClick={() => setSelected([])}>Clear</Button>
              </ToolbarGroup>
            </Toolbar>
          </div>
        )}
        <DataTable<Conn>
          items={rows.slice(0, 600)}
          columns={columns}
          getRowId={x => String(x.pid) + x.remote_address}
          ariaLabel="Active network connections"
          selectable
          selectedIds={selected}
          onSelectionChange={setSelected}
          onRowClick={setDetail}
          loading={conns.isLoading}
          loadingLabel="Sampling connection table…"
          emptyText="No matching connections. Some Windows processes may require administrator permissions to inspect."
        />
        {rows.length > 600 && (
          <MessageBar intent="info" className={s.panelRow}>
            <MessageBarBody>Showing the first 600 of {rows.length} sorted rows. Refine with the wildcard filter to narrow the table.</MessageBarBody>
          </MessageBar>
        )}
      </Panel>
      {detail && (
        <DetailDrawer
          title={detail.process || 'Connection'}
          subtitle={`PID ${detail.pid || 'unknown'}`}
          pid={detail.pid || undefined}
          onClose={() => setDetail(null)}
          items={[
            { label: 'Protocol', value: detail.protocol },
            { label: 'Family', value: detail.family },
            { label: 'State', value: detail.state },
            { label: 'Local endpoint', value: detail.local_address },
            { label: 'Remote address', value: detail.remote_ip },
            { label: 'Remote port', value: detail.remote_port || undefined },
            { label: 'Listener', value: detail.listener ? 'Yes' : undefined },
            { label: 'Services', value: detail.services?.join(', ') },
            { label: 'User', value: detail.username },
            { label: 'Executable', value: <PathCell value={detail.program_path} /> },
          ]}
        />
      )}
    </>
  );
}
