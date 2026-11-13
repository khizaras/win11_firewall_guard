import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button, Drawer, DrawerBody, DrawerHeader, DrawerHeaderTitle, Text, MessageBar, MessageBarBody,
  Spinner, makeStyles, tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { api, type Proc, type ProcDetail } from '../api';
import { fmtBytes, fmtRate, fmtTime, PathCell, Secondary } from './ui';

const useStyles = makeStyles({
  row: { display: 'flex', flexDirection: 'column', gap: '2px', padding: '9px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  key: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100, textTransform: 'uppercase', letterSpacing: '0.06em' },
  val: { fontSize: tokens.fontSizeBase200, overflowWrap: 'anywhere' },
  section: { marginBottom: tokens.spacingVerticalL },
  cmdline: { fontFamily: 'Consolas, "Cascadia Code", monospace', fontSize: tokens.fontSizeBase100, background: tokens.colorNeutralBackground3, padding: '8px 10px', borderRadius: tokens.borderRadiusMedium, overflowWrap: 'anywhere' },
});

function Field({ k, v }: { k: string; v?: React.ReactNode }) {
  const s = useStyles();
  if (v === undefined || v === null || v === '' || v === '—') return null;
  return <div className={s.row}><span className={s.key}>{k}</span><span className={s.val}>{v}</span></div>;
}

export function ProcessDetailDrawer({ proc, onOpenChange }: { proc: Proc | null; onOpenChange: (open: boolean) => void }) {
  const s = useStyles();
  const pid = proc?.pid ?? 0;
  const detail = useQuery({
    queryKey: ['processDetail', pid],
    queryFn: () => api.processDetail(pid),
    enabled: !!proc,
    gcTime: 60_000,
  });
  const d: ProcDetail | undefined = detail.data;

  return (
    <Drawer
      open={!!proc}
      position="end"
      type="overlay"
      onOpenChange={(_, { open }) => onOpenChange(open)}
      style={{ minWidth: 420, maxWidth: 520 }}
    >
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={() => onOpenChange(false)} />}>
          {proc?.process || 'Process'} <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>PID {pid}</Text>
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        {detail.isLoading && <Spinner label="Collecting details…" />}
        {d?.error && <MessageBar intent="warning"><MessageBarBody>{d.error}</MessageBarBody></MessageBar>}
        {d && !d.error && (
          <div className={s.section}>
            <Field k="Description" v={d.description || d.version_info?.FileDescription} />
            <Field k="Company" v={d.company || d.version_info?.CompanyName} />
            <Field k="Product" v={d.version_info?.ProductName} />
            <Field k="File version" v={d.version_info?.FileVersion} />
            <Field k="Signed as" v={d.signature_status && d.signature_status !== 'Invalid' ? d.signature_signer || d.signature_status : d.signature_status} />
            <Field k="Window title" v={d.window_title} />
            <Field k="Started" v={proc?.create_time ? fmtTime(proc.create_time) : undefined} />
            <Field k="Executable" v={<PathCell value={d.path || proc?.program_path} />} />
            <Field k="Running as" v={proc?.username} />
            <Field k="Parent" v={proc?.parent_name ? `${proc.parent_name} (PID ${proc.ppid})` : proc?.ppid ? `PID ${proc.ppid}` : undefined} />
            <Field k="Threads" v={proc?.threads} />
            <Field k="CPU right now" v={`${proc?.cpu_percent ?? '—'}%`} />
            <Field k="CPU time used" v={`${proc?.cpu_time_seconds ?? 0} s`} />
            <Field k="Memory (working set)" v={`${fmtBytes(proc?.memory_bytes)} (${proc?.memory_percent ?? '—'}%)`} />
            <Field k="Disk I/O rates" v={`read ${fmtRate(proc?.io_read_bytes_per_sec)} · write ${fmtRate(proc?.io_write_bytes_per_sec)}`} />
            <Field k="Priority" v={proc?.nice != null ? String(proc.nice) : undefined} />
            <Field k="State" v={proc?.status} />
            <Field k="Services hosted" v={proc?.services?.join(', ') || undefined} />
            {d.responding != null && <Field k="Responding" v={d.responding ? 'Yes' : 'Not responding (possible hang)'} />}
            {!!proc?.cmdline?.length && (
              <div className={s.row}>
                <span className={s.key}>Command line</span>
                <div className={s.cmdline}>{proc.cmdline.join(' ')}</div>
              </div>
            )}
          </div>
        )}
        {!d && !detail.isLoading && <Secondary>No extra metadata available for this process.</Secondary>}
        <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
          Elevation, signature and company info are collected on demand through PowerShell.
        </Text>
      </DrawerBody>
    </Drawer>
  );
}
