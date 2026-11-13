import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, MessageBar, MessageBarBody, SearchBox, makeStyles, tokens } from '@fluentui/react-components';
import { LockClosed24Regular, Search24Regular } from '@fluentui/react-icons';
import { api, type Event } from '../api';
import { useApp } from '../appContext';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { PageIntro, Panel, PathCell, Secondary, matchAny } from '../components/ui';

const useStyles = makeStyles({
  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: tokens.spacingVerticalS },
  searchBox: { maxWidth: '460px', flex: '1 1 340px' },
  msg: { display: 'block', maxWidth: '460px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase100 },
});

const EVENT_NAMES: Record<string, string> = {
  '2004': 'Block rule added',
  '2005': 'Rule changed',
  '2006': 'Rule deleted',
  '5152': 'Packet blocked (WFP)',
  '5156': 'Packet permitted (WFP)',
  '5157': 'Connection blocked (WFP)',
};

type EventRow = Event & { _key: string };

export function EventsPage() {
  const s = useStyles();
  const app = useApp();
  const [filter, setFilter] = useState('*');
  const [msgDialog, setMsgDialog] = useState<Event | null>(null);

  const events = useQuery({ queryKey: ['events'], queryFn: api.events, refetchInterval: 10000 });
  const rows: EventRow[] = (events.data || []).filter(e =>
    matchAny([e.time, e.event_id, e.provider as string, e.level as string, e.direction, e.src_ip, e.dst_ip, e.dst_port, e.src_port, e.app, e.message], filter))
    .map((e, i) => ({ ...e, _key: `ev${i}` }));

  const columns: DataTableColumn<EventRow>[] = [
    { columnId: 'time', title: 'Time', compare: (a, b) => a.time.localeCompare(b.time), minWidth: 185, cell: x => x.time },
    { columnId: 'event_id', title: 'Event', compare: (a, b) => a.event_id.localeCompare(b.event_id), cell: x => <><Badge appearance="outline">{x.event_id}</Badge><Secondary>{EVENT_NAMES[x.event_id] || ''}</Secondary></> },
    { columnId: 'action', title: 'Action', compare: (a, b) => a.event_id.localeCompare(b.event_id), cell: x => <Badge appearance="filled" color={x.event_id === '5156' ? 'success' : x.event_id.startsWith('5') ? 'warning' : 'brand'}>{x.event_id === '5156' ? 'Permitted' : 'Blocked/Rule'}</Badge> },
    { columnId: 'direction', title: 'Direction', compare: (a, b) => (a.direction || '').localeCompare(b.direction || ''), cell: x => x.direction ? <Badge appearance="outline">{x.direction}</Badge> : '—' },
    { columnId: 'endpoints', title: 'Source → destination', compare: (a, b) => ((a.src_ip || '') + ':' + (a.src_port || '')).localeCompare((b.src_ip || '') + ':' + (b.src_port || '')), minWidth: 250, cell: x => (x.src_ip || x.dst_ip ? <>{x.src_ip || '?'}:{x.src_port || '?'} → {x.dst_ip || '?'}:{x.dst_port || '?'}</> : '—') },
    { columnId: 'app', title: 'Application', compare: (a, b) => (a.app || '').localeCompare(b.app || ''), minWidth: 240, cell: x => <PathCell value={x.app} /> },
    {
      columnId: 'message',
      title: 'Raw message',
      cell: x => (
        <Button appearance="subtle" size="small" onClick={e => { e.stopPropagation(); setMsgDialog(x); }}>
          View message
        </Button>
      ),
    },
  ];

  const blockAppAction = (e: Event) => {
    if (!e.app || !e.app.toLowerCase().endsWith('.exe')) {
      app.toast('warning', 'No blockable application on this event', 'Only events that reference an .exe path can create a program-scoped rule.');
      return;
    }
    app.requestBlock([{ kind: 'app', label: e.app, detail: { program_path: e.app } }]);
  };

  return (
    <>
      <PageIntro
        eyebrow="Audit & forensics"
        title="Investigate firewall activity."
        desc="Windows Firewall and Windows Filtering Platform events with structured source/destination, direction, and the acting application."
      />
      <div className={s.toolbar}>
        <SearchBox
          className={s.searchBox}
          placeholder="Filter by IP, port, event ID, provider, app…"
          value={filter === '*' ? '' : filter}
          onChange={(_, d) => setFilter(d.value || '*')}
          contentBefore={<Search24Regular />}
          aria-label="Wildcard search"
        />
      </div>
      <Panel title="Windows event log" subtitle={`${rows.length} matching events`}>
        <DataTable<EventRow>
          items={rows}
          columns={columns}
          getRowId={x => x._key}
          ariaLabel="Windows firewall events"
          loading={events.isLoading}
          loadingLabel="Querying Windows event logs…"
          emptyText="No events found. Check Windows audit policy and permissions."
        />
      </Panel>
      <Dialog open={!!msgDialog} onOpenChange={(_, d) => { if (!d.open) setMsgDialog(null); }}>
        <DialogSurface style={{ maxWidth: 720 }}>
          <DialogBody>
            <DialogTitle>Event {msgDialog?.event_id} · {msgDialog?.time}</DialogTitle>
            <DialogContent>
              {msgDialog?.app && (
                <div style={{ marginBottom: 10 }}>
                  <Button size="small" appearance="primary" icon={<LockClosed24Regular />} onClick={() => blockAppAction(msgDialog)}>Block {msgDialog.app}</Button>
                </div>
              )}
              <div style={{ fontFamily: 'Consolas, "Cascadia Code", monospace', fontSize: tokens.fontSizeBase100, whiteSpace: 'pre-wrap' }}>{msgDialog?.message}</div>
            </DialogContent>
            <DialogActions><Button appearance="primary" onClick={() => setMsgDialog(null)}>Close</Button></DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
