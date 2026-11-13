import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, MessageBar, MessageBarBody, ProgressBar, Text, makeStyles, tokens } from '@fluentui/react-components';
import { api, type TopProc } from '../api';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { DetailDrawer } from '../components/DetailDrawer';
import { LiveChart, useLiveSamples } from '../components/LiveChart';
import { PageIntro, Panel, fmtBytes, fmtRate, fmtTime } from '../components/ui';

const useStyles = makeStyles({
  charts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: tokens.spacingVerticalL, marginBottom: tokens.spacingVerticalL },
  split: { display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: tokens.spacingVerticalL, marginBottom: tokens.spacingVerticalL, alignItems: 'start' },
  tables: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: tokens.spacingVerticalL },
  volume: { marginBottom: '10px' },
});

const cpuColor = tokens.colorBrandForeground1;
const memColor = tokens.colorPaletteGreenForeground1;
const recvColor = tokens.colorPaletteTealForeground2;
const sentColor = tokens.colorBrandForeground2;
const readColor = tokens.colorPaletteMarigoldForeground1;
const writeColor = tokens.colorPaletteRedForeground1;

export function MonitorPage() {
  const s = useStyles();
  const [detail, setDetail] = useState<TopProc | null>(null);
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: api.metrics, refetchInterval: 3000 });
  const m = metrics.data;

  const point = useMemo(() => {
    if (!m) return null;
    const busy = Object.values(m.disk_busy_percent || {});
    return {
      t: m.sampled_at || Date.now() / 1000,
      values: {
        cpu: m.cpu_percent,
        mem: m.memory_percent,
        swap: m.swap_percent ?? 0,
        recv: m.net_recv_bytes_per_sec,
        sent: m.net_sent_bytes_per_sec,
        read: m.disk_read_bytes_per_sec,
        write: m.disk_write_bytes_per_sec,
        busy: busy.length ? Math.max(...busy) : 0,
      },
    };
  }, [m]);
  const samples = useLiveSamples(point, 60);
  const series = (id: string) => samples.map(p => p.values[id] ?? 0);
  const rate = (n: number) => fmtRate(n);

  const cpuColumns: DataTableColumn<TopProc>[] = [
    { columnId: 'process', title: 'Process', compare: (a, b) => (a.process || '').localeCompare(b.process || ''), filterValue: x => `${x.process} ${x.pid}`, minWidth: 180, cell: x => <><b>{x.process}</b><span style={{ display: 'block', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100 }}>PID {x.pid}</span></> },
    { columnId: 'cpu', title: 'CPU %', filter: 'number', compare: (a, b) => a.cpu_percent - b.cpu_percent, filterValue: x => x.cpu_percent, defaultSort: 'descending', minWidth: 140, cell: x => <div><ProgressBar value={Math.min(1, x.cpu_percent / 100)} color={x.cpu_percent > 80 ? 'error' : 'brand'} /><span>{x.cpu_percent}%</span></div> },
    { columnId: 'memory', title: 'Memory', filter: 'number', compare: (a, b) => a.memory_bytes - b.memory_bytes, filterValue: x => x.memory_bytes, cell: x => fmtBytes(x.memory_bytes) },
  ];
  const diskColumns: DataTableColumn<TopProc>[] = [
    { columnId: 'process', title: 'Process', compare: (a, b) => (a.process || '').localeCompare(b.process || ''), filterValue: x => `${x.process} ${x.pid}`, minWidth: 180, cell: x => <><b>{x.process}</b><span style={{ display: 'block', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100 }}>PID {x.pid}</span></> },
    { columnId: 'write', title: 'Write rate', filter: 'number', compare: (a, b) => a.write_bytes_per_sec - b.write_bytes_per_sec, filterValue: x => x.write_bytes_per_sec, defaultSort: 'descending', cell: x => fmtRate(x.write_bytes_per_sec) },
    { columnId: 'read', title: 'Read rate', filter: 'number', compare: (a, b) => a.read_bytes_per_sec - b.read_bytes_per_sec, filterValue: x => x.read_bytes_per_sec, cell: x => fmtRate(x.read_bytes_per_sec) },
    { columnId: 'writeTotal', title: 'Written total', filter: 'number', compare: (a, b) => a.write_bytes_total - b.write_bytes_total, filterValue: x => x.write_bytes_total, cell: x => fmtBytes(x.write_bytes_total) },
    { columnId: 'readTotal', title: 'Read total', filter: 'number', compare: (a, b) => a.read_bytes_total - b.read_bytes_total, filterValue: x => x.read_bytes_total, cell: x => fmtBytes(x.read_bytes_total) },
  ];

  const cores = m?.cpu_per_core_percent || [];

  return (
    <>
      <PageIntro
        eyebrow="Performance"
        title="System monitor"
        desc="Live CPU, memory, network, and disk traces sampled every 3 seconds. Each chart keeps the last three minutes. Column filters under the process tables accept text, or a comparison such as > 10."
        action={m ? <Badge appearance="outline">Boot {fmtTime(m.boot_time)} · {samples.length} samples</Badge> : <Badge appearance="outline">Waiting for the first sample</Badge>}
      />
      {!m && <MessageBar intent="info"><MessageBarBody>Sampling system telemetry…</MessageBarBody></MessageBar>}
      {m && (
        <>
          <div className={s.charts}>
            <Panel title="Processor" subtitle={`${m.cpu_percent.toFixed(1)}% across ${m.cpu_count_logical} logical processors`}>
              <LiveChart title="CPU" subtitle="Total utilization" unit="%" yMax={100} series={[{ id: 'cpu', label: 'CPU', color: cpuColor, values: series('cpu'), format: n => `${n.toFixed(1)}%` }]} />
            </Panel>
            <Panel title="Memory" subtitle={`${fmtBytes(m.memory_used_bytes ?? m.memory_total_bytes - m.memory_available_bytes)} of ${fmtBytes(m.memory_total_bytes)}`}>
              <LiveChart title="Memory and swap" subtitle="Percent of installed memory and page file" unit="%" yMax={100} series={[
                { id: 'mem', label: 'Memory', color: memColor, values: series('mem'), format: n => `${n.toFixed(1)}%` },
                { id: 'swap', label: 'Swap', color: writeColor, values: series('swap'), format: n => `${n.toFixed(1)}%` },
              ]} />
            </Panel>
            <Panel title="Network" subtitle={`${fmtRate(m.net_recv_bytes_per_sec)} in · ${fmtRate(m.net_sent_bytes_per_sec)} out`}>
              <LiveChart title="Throughput" subtitle="Bytes per second, all interfaces" series={[
                { id: 'recv', label: 'Received', color: recvColor, values: series('recv'), format: rate },
                { id: 'sent', label: 'Sent', color: sentColor, values: series('sent'), format: rate },
              ]} />
            </Panel>
            <Panel title="Disk throughput" subtitle={`${fmtRate(m.disk_read_bytes_per_sec)} read · ${fmtRate(m.disk_write_bytes_per_sec)} write`}>
              <LiveChart title="Disk bytes" subtitle="System-wide read and write rate" series={[
                { id: 'read', label: 'Read', color: readColor, values: series('read'), format: rate },
                { id: 'write', label: 'Write', color: writeColor, values: series('write'), format: rate },
              ]} />
            </Panel>
          </div>

          <div className={s.split}>
            <Panel title="Per-core load" subtitle="Updates with each sample">
              {cores.map((v, i) => (
                <div className="fg-core" key={i} title={`Core ${i}: ${v}%`}>
                  <span>Core {i}</span>
                  <div className="fg-core-track">
                    <div className="fg-core-fill" style={{ width: `${Math.min(100, Math.max(0, v))}%`, background: v > 80 ? tokens.colorPaletteRedBackground3 : tokens.colorBrandBackground }} />
                  </div>
                  <span>{v.toFixed(0)}%</span>
                </div>
              ))}
              {!cores.length && <Text size={200}>Per-core counters are not available.</Text>}
              {Object.keys(m.disk_busy_percent || {}).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text weight="semibold">Disk busy</Text>
                  <LiveChart title="Busiest disk" subtitle="Highest physical disk busy percent" unit="%" yMax={100} height={120} series={[{ id: 'busy', label: 'Busy', color: writeColor, values: series('busy'), format: n => `${n.toFixed(0)}%` }]} />
                  {Object.entries(m.disk_busy_percent || {}).map(([name, pct]) => (
                    <div className="fg-core" key={name}>
                      <span title={name}>{name.replace(/^\\\\\.\\/, '')}</span>
                      <div className="fg-core-track"><div className="fg-core-fill" style={{ width: `${Math.min(100, pct)}%`, background: pct > 80 ? tokens.colorPaletteRedBackground3 : tokens.colorBrandBackground }} /></div>
                      <span>{pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Volume capacity" subtitle="Mounted volumes and free space">
              {(m.disks || []).map(d => (
                <div key={d.mountpoint} className={s.volume}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                    <b>{d.mountpoint} <span style={{ color: tokens.colorNeutralForeground3, fontWeight: 400 }}>{d.device}</span></b>
                    <b>{d.percent}% used</b>
                  </div>
                  <ProgressBar value={Math.min(1, d.percent / 100)} color={d.percent >= 90 ? 'error' : 'brand'} />
                  <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{fmtBytes(d.used_bytes)} used of {fmtBytes(d.total_bytes)} · {fmtBytes(d.free_bytes)} free</Text>
                </div>
              ))}
            </Panel>
          </div>

          <div className={s.tables}>
            <Panel title="Highest CPU" subtitle="Top processes in the latest sample. Sort any column, or filter with > 5.">
              <DataTable<TopProc> items={m.top_cpu.slice(0, 20)} columns={cpuColumns} getRowId={x => 'cpu' + String(x.pid)} ariaLabel="Top CPU processes" onRowClick={setDetail} />
            </Panel>
            <Panel title="Highest disk I/O" subtitle="Rates are deltas of cumulative I/O counters.">
              <DataTable<TopProc> items={m.top_disk.slice(0, 20)} columns={diskColumns} getRowId={x => 'disk' + String(x.pid)} ariaLabel="Top disk processes" onRowClick={setDetail} />
            </Panel>
          </div>
        </>
      )}
      {detail && (
        <DetailDrawer
          title={detail.process || 'Process'}
          subtitle={`PID ${detail.pid}`}
          pid={detail.pid}
          onClose={() => setDetail(null)}
          items={[
            { label: 'CPU', value: `${detail.cpu_percent}%` },
            { label: 'Memory', value: fmtBytes(detail.memory_bytes) },
            { label: 'Read rate', value: fmtRate(detail.read_bytes_per_sec) },
            { label: 'Write rate', value: fmtRate(detail.write_bytes_per_sec) },
            { label: 'Read total', value: fmtBytes(detail.read_bytes_total) },
            { label: 'Written total', value: fmtBytes(detail.write_bytes_total) },
          ]}
        />
      )}
      <MessageBar intent="warning" style={{ marginTop: tokens.spacingVerticalM }}>
        <MessageBarBody>Disk and CPU spikes are investigation clues, not proof of a file transfer. Pair this telemetry with Network connections and Firewall events.</MessageBarBody>
      </MessageBar>
    </>
  );
}
