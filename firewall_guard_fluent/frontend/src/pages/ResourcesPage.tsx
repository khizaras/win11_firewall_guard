import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  MessageBar, MessageBarBody, makeStyles, tokens,
} from '@fluentui/react-components';
import { api, type DiskVolume, type GpuAdapter, type ResourceApp } from '../api';
import { useApp } from '../appContext';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { DetailDrawer } from '../components/DetailDrawer';
import { LiveChart, useLiveSamples } from '../components/LiveChart';
import { PageIntro, Panel, PathCell, fmtBytes, fmtRate } from '../components/ui';

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  volumes: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: tokens.spacingVerticalM },
});

const usedColor = tokens.colorBrandBackground;
const standbyColor = tokens.colorPaletteMarigoldBackground3;
const freeColor = tokens.colorPaletteGreenBackground3;
const sharedColor = tokens.colorPaletteTealBackground2;

function Donut({ parts }: { parts: { value: number; color: string }[] }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((sum, p) => sum + Math.max(0, p.value), 0) || 1;
  let cursor = 0;
  return (
    <svg viewBox="0 0 120 120" className="fg-donut" role="img" aria-label="Usage split">
      <circle cx="60" cy="60" r={r} fill="none" stroke={tokens.colorNeutralStroke2} strokeWidth="14" />
      {parts.map((part, i) => {
        const len = (Math.max(0, part.value) / total) * c;
        const node = (
          <circle key={i} cx="60" cy="60" r={r} fill="none" stroke={part.color} strokeWidth="14"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-cursor} strokeLinecap="butt"
            transform="rotate(-90 60 60)" />
        );
        cursor += len;
        return node;
      })}
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="fg-stat"><span>{label}</span><b>{value}</b></div>;
}

function SplitBar({ parts }: { parts: { value: number; color: string; label: string }[] }) {
  const total = parts.reduce((sum, p) => sum + Math.max(0, p.value), 0) || 1;
  return (
    <>
      <div className="fg-stack" aria-hidden="true">
        {parts.map(p => <i key={p.label} style={{ width: `${(Math.max(0, p.value) / total) * 100}%`, background: p.color }} />)}
      </div>
      <div className="fg-legend">
        {parts.map(p => <span key={p.label}><i style={{ background: p.color }} />{p.label}</span>)}
      </div>
    </>
  );
}

function endColumn(onEnd: (app: ResourceApp) => void): DataTableColumn<ResourceApp> {
  return {
    columnId: 'end', title: 'Action', filter: 'none', minWidth: 120,
    cell: app => (
      <Button size="small" appearance="secondary" disabled={app.protected}
        title={app.protected ? 'This process is protected' : 'End this process'}
        onClick={e => { e.stopPropagation(); onEnd(app); }}>
        End process
      </Button>
    ),
  };
}

function useResourceActions(queryKey: string) {
  const app = useApp();
  const qc = useQueryClient();
  const [pending, setPending] = useState<ResourceApp | null>(null);
  const [detail, setDetail] = useState<ResourceApp | null>(null);
  const end = useMutation({
    mutationFn: (pid: number) => api.terminateProcess(pid),
    onSuccess: result => {
      app.toast('success', `Ended ${result.process}`, `PID ${result.pid}${result.forced ? ' required a forced end.' : ' has exited.'}`);
      setPending(null);
      void qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: e => app.toast('error', 'Could not end the process', String(e)),
  });
  return { pending, setPending, detail, setDetail, end };
}

function ResourceChrome({ actions }: { actions: ReturnType<typeof useResourceActions> }) {
  const { pending, setPending, detail, setDetail, end } = actions;
  return (
    <>
      {detail && (
        <DetailDrawer
          title={detail.process || 'Application'}
          subtitle={`PID ${detail.pid}${detail.protected ? ' · protected' : ''}`}
          pid={detail.pid}
          onClose={() => setDetail(null)}
          items={[
            { label: 'Status', value: detail.status },
            { label: 'Working set', value: detail.memory_bytes != null ? `${fmtBytes(detail.memory_bytes)} (${detail.memory_percent ?? 0}%)` : undefined },
            { label: 'GPU usage', value: detail.usage_percent != null ? `${detail.usage_percent}%` : undefined },
            { label: 'Dedicated GPU memory', value: detail.dedicated_bytes != null ? fmtBytes(detail.dedicated_bytes) : undefined },
            { label: 'Shared GPU memory', value: detail.shared_bytes != null ? fmtBytes(detail.shared_bytes) : undefined },
            { label: 'Disk read', value: detail.read_bytes_per_sec != null ? fmtRate(detail.read_bytes_per_sec) : undefined },
            { label: 'Disk write', value: detail.write_bytes_per_sec != null ? fmtRate(detail.write_bytes_per_sec) : undefined },
            { label: 'Read total', value: detail.read_bytes_total != null ? fmtBytes(detail.read_bytes_total) : undefined },
            { label: 'Written total', value: detail.write_bytes_total != null ? fmtBytes(detail.write_bytes_total) : undefined },
            { label: 'Path', value: <PathCell value={detail.program_path} /> },
          ]}
        >
          <Button appearance="secondary" disabled={detail.protected} onClick={() => { setPending(detail); setDetail(null); }}>End process</Button>
        </DetailDrawer>
      )}
      <Dialog open={pending != null} onOpenChange={(_, d) => { if (!d.open) setPending(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>End {pending?.process || 'process'}?</DialogTitle>
            <DialogContent>
              PID {pending?.pid} will be closed on this PC. Unsaved work in that application will be lost.
              {pending?.protected ? ' This process is protected and cannot be ended.' : ''}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setPending(null)}>Cancel</Button>
              <Button appearance="primary" disabled={!pending || pending.protected || end.isPending} onClick={() => pending && end.mutate(pending.pid)}>
                {end.isPending ? 'Ending…' : 'End process'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}

export function MemoryPage() {
  const s = useStyles();
  const actions = useResourceActions('resource-memory');
  const memory = useQuery({ queryKey: ['resource-memory'], queryFn: api.resourceMemory, refetchInterval: 3000 });
  const memPoint = useMemo(() => memory.data ? { t: memory.data.sampled_at, values: { used: memory.data.used_percent, swap: memory.data.swap_percent } } : null, [memory.data]);
  const memSamples = useLiveSamples(memPoint, 60);
  const memoryColumns: DataTableColumn<ResourceApp>[] = [
    { columnId: 'process', title: 'Application', compare: (a, b) => a.process.localeCompare(b.process), filterValue: a => `${a.process} ${a.pid}`, minWidth: 180, cell: a => <><b>{a.process || 'Unknown'}</b><span style={{ display: 'block', color: tokens.colorNeutralForeground3, fontSize: 12 }}>PID {a.pid}</span></> },
    { columnId: 'memory', title: 'Working set', filter: 'number', compare: (a, b) => (a.memory_bytes || 0) - (b.memory_bytes || 0), filterValue: a => a.memory_bytes || 0, defaultSort: 'descending', cell: a => <>{fmtBytes(a.memory_bytes)}<span style={{ display: 'block', color: tokens.colorNeutralForeground3, fontSize: 12 }}>{a.memory_percent ?? 0}%</span></> },
    { columnId: 'path', title: 'Path', compare: (a, b) => (a.program_path || '').localeCompare(b.program_path || ''), filterValue: a => a.program_path, minWidth: 240, cell: a => <PathCell value={a.program_path} /> },
    endColumn(actions.setPending),
  ];
  const mem = memory.data;
  const memParts = mem ? [
    { label: 'Used', value: mem.used_bytes, color: usedColor },
    { label: 'Standby', value: mem.standby_bytes, color: standbyColor },
    { label: 'Free', value: mem.free_bytes, color: freeColor },
  ] : [];
  return (
    <>
      <PageIntro eyebrow="Memory monitor" title="Memory" desc="Used, available, and free memory, with the applications holding a working set. Ending a process closes it on this PC." />
      <div className={s.stack}>
        {memory.isError && <MessageBar intent="error"><MessageBarBody>{String(memory.error)}</MessageBarBody></MessageBar>}
        {mem && (
          <Panel title="Memory summary" subtitle={`${mem.used_percent}% of ${fmtBytes(mem.total_bytes)} in use`}>
            <div className="fg-resource-hero">
              <Donut parts={memParts} />
              <div>
                <div className="fg-resource-stats">
                  <Stat label="Used" value={fmtBytes(mem.used_bytes)} />
                  <Stat label="Available" value={fmtBytes(mem.available_bytes)} />
                  <Stat label="Free" value={fmtBytes(mem.free_bytes)} />
                  <Stat label="Swap used" value={`${fmtBytes(mem.swap_used_bytes)} / ${fmtBytes(mem.swap_total_bytes)}`} />
                </div>
                <SplitBar parts={memParts} />
              </div>
            </div>
            <LiveChart title="Memory pressure" subtitle="Used percent and page file, last three minutes" unit="%" yMax={100} height={140} series={[
              { id: 'used', label: 'Used', color: tokens.colorBrandForeground1, values: memSamples.map(p => p.values.used ?? 0), format: n => `${n.toFixed(1)}%` },
              { id: 'swap', label: 'Swap', color: tokens.colorPaletteRedForeground1, values: memSamples.map(p => p.values.swap ?? 0), format: n => `${n.toFixed(1)}%` },
            ]} />
          </Panel>
        )}
        <Panel title="Applications in memory" subtitle="Working set of 1 MB or more. Available includes standby that Windows can reclaim. Free is memory not in use at all.">
          <DataTable items={mem?.apps || []} columns={memoryColumns} getRowId={a => String(a.pid)} ariaLabel="Applications using memory" loading={memory.isLoading} emptyText="No applications are reporting a working set." onRowClick={actions.setDetail} />
        </Panel>
      </div>
      <ResourceChrome actions={actions} />
    </>
  );
}

export function GpuPage() {
  const s = useStyles();
  const actions = useResourceActions('resource-gpu');
  const gpu = useQuery({ queryKey: ['resource-gpu'], queryFn: api.resourceGpu, refetchInterval: 4000 });
  const gpuPoint = useMemo(() => gpu.data?.adapters?.[0] ? { t: gpu.data.sampled_at, values: { usage: gpu.data.adapters[0].usage_percent } } : null, [gpu.data]);
  const gpuSamples = useLiveSamples(gpuPoint, 60);
  const gpuColumns: DataTableColumn<ResourceApp>[] = [
    { columnId: 'process', title: 'Application', compare: (a, b) => a.process.localeCompare(b.process), filterValue: a => `${a.process} ${a.pid}`, minWidth: 180, cell: a => <><b>{a.process || 'Unknown'}</b><span style={{ display: 'block', color: tokens.colorNeutralForeground3, fontSize: 12 }}>PID {a.pid}</span></> },
    { columnId: 'dedicated', title: 'Dedicated', filter: 'number', compare: (a, b) => (a.dedicated_bytes || 0) - (b.dedicated_bytes || 0), filterValue: a => a.dedicated_bytes || 0, defaultSort: 'descending', cell: a => fmtBytes(a.dedicated_bytes) },
    { columnId: 'shared', title: 'Shared', filter: 'number', compare: (a, b) => (a.shared_bytes || 0) - (b.shared_bytes || 0), filterValue: a => a.shared_bytes || 0, cell: a => fmtBytes(a.shared_bytes) },
    { columnId: 'usage', title: '3D %', filter: 'number', compare: (a, b) => (a.usage_percent || 0) - (b.usage_percent || 0), filterValue: a => a.usage_percent || 0, cell: a => `${a.usage_percent ?? 0}%` },
    { columnId: 'path', title: 'Path', compare: (a, b) => (a.program_path || '').localeCompare(b.program_path || ''), filterValue: a => a.program_path, minWidth: 200, cell: a => <PathCell value={a.program_path} /> },
    endColumn(actions.setPending),
  ];
  return (
    <>
      <PageIntro eyebrow="GPU monitor" title="GPU" desc="Engine usage and dedicated memory that is used, available, and free, plus the applications on the GPU." />
      <div className={s.stack}>
        {gpu.isError && <MessageBar intent="error"><MessageBarBody>{String(gpu.error)}</MessageBarBody></MessageBar>}
        {gpu.data?.note && <MessageBar intent="info"><MessageBarBody>{gpu.data.note}</MessageBarBody></MessageBar>}
        {(gpu.data?.adapters || []).map((adapter: GpuAdapter) => {
          const knownTotal = adapter.memory_total_bytes > 0;
          const parts = knownTotal
            ? [{ label: 'Used', value: adapter.memory_used_bytes, color: usedColor }, { label: 'Free', value: adapter.memory_free_bytes, color: freeColor }]
            : [{ label: 'Dedicated', value: adapter.memory_used_bytes, color: usedColor }, { label: 'Shared', value: adapter.shared_used_bytes, color: sharedColor }];
          return (
            <Panel key={adapter.name} title={adapter.name} subtitle={knownTotal ? `${adapter.usage_percent}% engine · ${fmtBytes(adapter.memory_total_bytes)} dedicated` : `${adapter.usage_percent}% 3D engine · dedicated total is not exposed by this driver`}>
              <div className="fg-resource-hero">
                <Donut parts={parts.length ? parts : [{ value: adapter.usage_percent, color: usedColor }, { value: Math.max(0, 100 - adapter.usage_percent), color: freeColor }]} />
                <div>
                  <div className="fg-resource-stats">
                    <Stat label="Usage" value={`${adapter.usage_percent}%`} />
                    <Stat label="Used" value={fmtBytes(adapter.memory_used_bytes)} />
                    <Stat label="Available" value={knownTotal ? fmtBytes(adapter.memory_available_bytes) : 'Not reported'} />
                    <Stat label="Free" value={knownTotal ? fmtBytes(adapter.memory_free_bytes) : fmtBytes(adapter.shared_used_bytes) + ' shared'} />
                  </div>
                  <SplitBar parts={parts.some(p => p.value > 0) ? parts : [{ label: 'Usage', value: adapter.usage_percent, color: usedColor }, { label: 'Idle', value: Math.max(0, 100 - adapter.usage_percent), color: freeColor }]} />
                </div>
              </div>
            </Panel>
          );
        })}
        {gpu.data && (
          <Panel title="GPU trend" subtitle={gpu.data.source === 'nvidia-smi' ? 'Engine utilization from the NVIDIA driver' : '3D engine utilization from Windows GPU counters'}>
            <LiveChart title="GPU usage" unit="%" yMax={100} height={140} series={[
              { id: 'usage', label: 'Usage', color: tokens.colorPaletteTealForeground2, values: gpuSamples.map(p => p.values.usage ?? 0), format: n => `${n.toFixed(1)}%` },
            ]} />
          </Panel>
        )}
        <Panel title="Applications on the GPU" subtitle="Dedicated and shared GPU memory. End process closes that application.">
          <DataTable items={gpu.data?.apps || []} columns={gpuColumns} getRowId={a => String(a.pid)} ariaLabel="Applications using the GPU" loading={gpu.isLoading} emptyText="No application is reporting GPU memory." onRowClick={actions.setDetail} />
        </Panel>
      </div>
      <ResourceChrome actions={actions} />
    </>
  );
}

export function DiskPage() {
  const s = useStyles();
  const actions = useResourceActions('resource-disk');
  const disk = useQuery({ queryKey: ['resource-disk'], queryFn: api.resourceDisk, refetchInterval: 3000 });
  const diskPoint = useMemo(() => disk.data ? { t: disk.data.sampled_at, values: { read: disk.data.read_bytes_per_sec, write: disk.data.write_bytes_per_sec } } : null, [disk.data]);
  const diskSamples = useLiveSamples(diskPoint, 60);
  const diskColumns: DataTableColumn<ResourceApp>[] = [
    { columnId: 'process', title: 'Application', compare: (a, b) => a.process.localeCompare(b.process), filterValue: a => `${a.process} ${a.pid}`, minWidth: 180, cell: a => <><b>{a.process || 'Unknown'}</b><span style={{ display: 'block', color: tokens.colorNeutralForeground3, fontSize: 12 }}>PID {a.pid}</span></> },
    { columnId: 'write', title: 'Write rate', filter: 'number', compare: (a, b) => (a.write_bytes_per_sec || 0) - (b.write_bytes_per_sec || 0), filterValue: a => a.write_bytes_per_sec || 0, defaultSort: 'descending', cell: a => fmtRate(a.write_bytes_per_sec) },
    { columnId: 'read', title: 'Read rate', filter: 'number', compare: (a, b) => (a.read_bytes_per_sec || 0) - (b.read_bytes_per_sec || 0), filterValue: a => a.read_bytes_per_sec || 0, cell: a => fmtRate(a.read_bytes_per_sec) },
    { columnId: 'path', title: 'Path', compare: (a, b) => (a.program_path || '').localeCompare(b.program_path || ''), filterValue: a => a.program_path, minWidth: 220, cell: a => <PathCell value={a.program_path} /> },
    endColumn(actions.setPending),
  ];
  return (
    <>
      <PageIntro eyebrow="Disk monitor" title="Disk" desc="Used, available, and free space on each volume, plus the applications reading and writing the disk." />
      <div className={s.stack}>
        {disk.isError && <MessageBar intent="error"><MessageBarBody>{String(disk.error)}</MessageBarBody></MessageBar>}
        <div className={s.volumes}>
          {(disk.data?.volumes || []).map((volume: DiskVolume) => {
            const reserved = Math.max(0, volume.free_bytes - volume.available_bytes);
            const parts = [
              { label: 'Used', value: volume.used_bytes, color: usedColor },
              { label: 'Reserved', value: reserved, color: standbyColor },
              { label: 'Available', value: volume.available_bytes, color: freeColor },
            ];
            return (
              <Panel key={volume.mountpoint} title={volume.mountpoint} subtitle={`${volume.filesystem || 'Volume'} · ${volume.device}`}>
                <div className="fg-resource-hero">
                  <Donut parts={parts} />
                  <div>
                    <div className="fg-resource-stats">
                      <Stat label="Used" value={fmtBytes(volume.used_bytes)} />
                      <Stat label="Available" value={fmtBytes(volume.available_bytes)} />
                      <Stat label="Free" value={fmtBytes(volume.free_bytes)} />
                    </div>
                    <SplitBar parts={parts} />
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
        {disk.data && (
          <Panel title="Disk activity" subtitle={`${fmtRate(disk.data.read_bytes_per_sec)} read · ${fmtRate(disk.data.write_bytes_per_sec)} write`}>
            <LiveChart title="Throughput" height={140} series={[
              { id: 'read', label: 'Read', color: tokens.colorPaletteMarigoldForeground1, values: diskSamples.map(p => p.values.read ?? 0), format: n => fmtRate(n) },
              { id: 'write', label: 'Write', color: tokens.colorPaletteRedForeground1, values: diskSamples.map(p => p.values.write ?? 0), format: n => fmtRate(n) },
            ]} />
          </Panel>
        )}
        <Panel title="Applications using the disk" subtitle="Processes with disk reads or writes. Ending one stops that application. It does not delete files.">
          <DataTable items={disk.data?.apps || []} columns={diskColumns} getRowId={a => String(a.pid)} ariaLabel="Applications using disk" loading={disk.isLoading} emptyText="No process is reporting disk activity yet. Rates appear after the second sample." onRowClick={actions.setDetail} />
        </Panel>
      </div>
      <ResourceChrome actions={actions} />
    </>
  );
}
