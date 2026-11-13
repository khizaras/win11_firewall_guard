import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, MessageBar, MessageBarBody, MessageBarTitle, SearchBox, makeStyles, tokens } from '@fluentui/react-components';
import { Search24Regular } from '@fluentui/react-icons';
import { api, type Policy } from '../api';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { PageIntro, Panel, Secondary, matchAny } from '../components/ui';

const useStyles = makeStyles({
  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: tokens.spacingVerticalS },
  searchBox: { maxWidth: '380px', flex: '1 1 280px' },
});

const SELECTOR_KEYS = ['process_name_patterns', 'service_name_patterns', 'program_paths', 'remote_ips', 'remote_ports'] as const;

export function PoliciesPage() {
  const s = useStyles();
  const [filter, setFilter] = useState('*');
  const policies = useQuery({ queryKey: ['policies'], queryFn: api.policies });

  const rows = (policies.data || []).filter((p: Policy) =>
    matchAny([p.id, p.name, p.direction, p.enabled ? 'true' : 'false', ...SELECTOR_KEYS.flatMap(k => ((p[k] as unknown[]) || []).map(String))], filter));

  const columns: DataTableColumn<Policy>[] = [
    { columnId: 'id', title: 'Policy', compare: (a, b) => a.id.localeCompare(b.id), defaultSort: 'ascending', minWidth: 220, cell: p => <><b>{p.name || p.id}</b><Secondary>{p.id}</Secondary></> },
    { columnId: 'enabled', title: 'Enabled', cell: p => <Badge appearance="filled" color={p.enabled ? 'success' : 'subtle'}>{p.enabled ? 'Enabled' : 'Disabled'}</Badge> },
    { columnId: 'automatic', title: 'Automatic', cell: p => <Badge appearance="outline">{String(p.automatic ?? false)}</Badge> },
    { columnId: 'direction', title: 'Direction', cell: p => p.direction ?? '—' },
    { columnId: 'protocol', title: 'Protocol', cell: p => p.protocol ?? '—' },
    { columnId: 'selectors', title: 'Selectors', cell: p => SELECTOR_KEYS.reduce((n, k) => n + ((p[k]||[]) as unknown[]).length, 0) },
    {
      columnId: 'detail', title: 'Patterns', cell: p => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SELECTOR_KEYS.map(k => ((p[k] || []) as string[]).length ? (
            <Secondary key={k}>{k}: {((p[k] || []) as string[]).join(', ')}</Secondary>
          ) : null)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Rule engine"
        title="Policy center"
        desc="Review local policy definitions and their activation state. Policies are evaluated for reporting in this build."
      />
      <MessageBar intent="warning">
        <MessageBarBody>
          <MessageBarTitle>Automatic background enforcement is not enabled</MessageBarTitle>
          Matching is computed locally, but no persistent worker evaluates these patterns yet. Manual block rules apply directly when live enforcement is on.
        </MessageBarBody>
      </MessageBar>
      <div className={s.toolbar}>
        <SearchBox
          className={s.searchBox}
          placeholder="Filter by policy id, name, pattern…"
          value={filter === '*' ? '' : filter}
          onChange={(_, d) => setFilter(d.value || '*')}
          contentBefore={<Search24Regular />}
          aria-label="Wildcard search"
        />
      </div>
      <Panel title="Configured policies" subtitle={`${rows.length} definitions`}>
        <DataTable<Policy>
          items={rows}
          columns={columns}
          getRowId={p => p.id}
          ariaLabel="Configured policies"
          loading={policies.isLoading}
          loadingLabel="Loading policies…"
          emptyText="No policies are configured in backend/config/policies.json."
        />
      </Panel>
    </>
  );
}
