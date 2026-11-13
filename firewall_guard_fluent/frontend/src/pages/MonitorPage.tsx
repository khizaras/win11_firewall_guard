import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, MessageBar, MessageBarBody, ProgressBar, Text, makeStyles, tokens } from '@fluentui/react-components';
import { api, type TopProc } from '../api';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { PageIntro, Panel, Sparkline, fmtBytes, fmtRate, MeterRow, fmtTime } from '../components/ui';

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: tokens.spacingVerticalL, alignItems: 'start' },
  chartRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' },
  chartLabel: { minWidth: '120px', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
  busyRow: { display: 'flex', gap: '3px', flexWrap: 'wrap' as const },
});

export function MonitorPage() {
  const s = useStyles();
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: api.metrics, refetchInterval: 3000 });
  const m = metrics.data;

  const hist = useRef<{ cpu: number[]; mem: number[]; swap: number[]; sent: number[]; recv: number[]; read: number[]; write: number[]; busy: number[] }>({
    cpu: [], mem: [], swap: [], sent: [], recv: [], read: [], write: [], busy: [],
  });
  useEffect(() => {
    if (!m) return;
    const h = hist.current;
    const push = (arr: number[], v: number) => { arr.push(v); if (arr.length > 120) arr.shift(); };
    push(h.cpu, m.cpu_percent); push(h.mem, m.memory_percent); push(h.swap, m.swap_percent ?? 0);
    push(h.sent, m.net_sent_bytes_per_sec); push(h.recv, m.net_recv_bytes_per_sec);
    push(h.read, m.disk_read_bytes_per_sec); push(h.write, m.disk_write_bytes_per_sec);
    push(h.busy, Math.max(...Object.values(m.disk_busy_percent || {}), 0));
  }, [m]);

  const cpuColumns: DataTableColumn<TopProc>[] = [
    { columnId: 'process', title: 'Process', compare: (a, b) => (a.process || '').localeCompare(b.process || ''), defaultSort: 'descending', minWidth: 200, cell: x => <><b>{x.process}</b><span style={{ display: 'block', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100 }}>PID {x.pid}</span></> },
    { columnId: 'cpu', title: 'CPU %', compare: (a, b) => a.cpu_percent - b.cpu_percent, cell: x => <><ProgressBar value={Math.min(1, x.cpu_percent / 100)} color={x.cpu_percent > 80 ? 'error' : 'brand'} /><span>{x.cpu_percent}%</span></> },
    { columnId: 'memory', title: 'Memory', compare: (a, b) => a.memory_bytes - b.memory_bytes, cell: x => fmtBytes(x.memory_bytes) },
  ];
  const diskColumns: DataTableColumn<TopProc>[] = [
    { columnId: 'process', title: 'Process', compare: (a, b) => (a.process || '').localeCompare(b.process || ''), defaultSort: 'descending', minWidth: 200, cell: x => <><b>{x.process}</b><span style={{ display: 'block', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100 }}>PID {x.pid}</span></> },
    { columnId: 'write', title: 'Write rate', compare: (a, b) => a.write_bytes_per_sec - b.write_bytes_per_sec, cell: x => fmtRate(x.write_bytes_per_sec) },
    { columnId: 'read', title: 'Read rate', compare: (a, b) => a.read_bytes_per_sec - b.read_bytes_per_sec, cell: x => fmtRate(x.read_bytes_per_sec) },
    { columnId: 'writeTotal', title: 'Written total', compare: (a, b) => a.write_bytes_total - b.write_bytes_total, cell: x => fmtBytes(x.write_bytes_total) },
    { columnId: 'readTotal', title: 'Read total', compare: (a, b) => a.read_bytes_total - b.read_bytes_total, cell: x => fmtBytes(x.read_bytes_total) },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Performance & forensics"
        title="System monitor"
        desc="Live CPU (with per-core load), memory and swap, network rates, disk capacity and throughput â€” plus the processes doing the most work."
        action={<Badge appearance="outline">Boot: {fmtTime(m?.boot_time)}</Badge>}
      />
      {!m && <MessageBar intent="info"><MessageBarBody>Sampling system telemetryâ€¦</MessageBarBody></MessageBar>}
      {m && (
        <div className={s.grid} style={{ marginBottom: tokens.spacingVerticalL }}>
          <Panel title="Live trends" subtitle="Streamed every 3 seconds, 2-minute window">
            <div style={{ display: 'grid', gap: 10 }}>
              <div className={s.chartRow}><span className={s.chartLabel}>CPU</span><Sparkline values={hist.current.cpu} /><Badge>{m.cpu_percent.toFixed(1)}% of {m.cpu_count_logical}</Badge></div>
              <div className={s.chartRow}><span className={s.chartLabel}>Memory</span><Sparkline values={hist.current.mem} color={tokens.colorPaletteGreenForeground1} /><Badge>{m.memory_percent.toFixed(1)}%</Badge></div>
              <div className={s.chartRow}><span className={s.chartLabel}>Swap</span><Sparkline values={hist.current.swap} color={tokens.colorPaletteRedForeground1} /><Badge>{fmtBytes(m.swap_used_bytes)} / {fmtBytes(m.swap_total_bytes)}</Badge></div>
              <div className={s.chartRow}><span className={s.chartLabel}>Net â†“</span><Sparkline values={hist.current.recv} color={tokens.colorPaletteGreenForeground1} /><Badge>{fmtRate(m.net_recv_bytes_per_sec)}</Badge></div>
              <div className={s.chartRow}><span className={s.chartLabel}>Net â†‘</span><Sparkline values={hist.current.sent} color={tokens.colorBrandForeground2} /><Badge>{fmtRate(m.net_sent_bytes_per_sec)}</Badge></div>
              <div className={s.chartRow}><span className={s.chartLabel}>Disk R</span><Sparkline values={hist.current.read} color={tokens.colorPaletteMarigoldBorderActive} /><Badge>{fmtRate(m.disk_read_bytes_per_sec)}</Badge></div>
              <div className={s.chartRow}><span className={s.chartLabel}>Disk W</span><Sparkline values={hist.current.write} color={tokens.colorPaletteRedForeground1} /><Badge>{fmtRate(m.disk_write_bytes_per_sec)}</Badge></div>
              <div className={s.chartRow}><span className={s.chartLabel}>Busiest disk</span><Sparkline values={hist.current.busy} color={tokens.colorPaletteRedForeground1} /><Badge>{Math.max(...Object.values(m.disk_busy_percent || {}), 0).toFixed(0)}% busy</Badge></div>
            </div>
          </Panel>
          <Panel title="Memory & per-core" subtitle="Instantaneous pressure">
            <MeterRow label="Memory used" valueText={`${fmtBytes(m.memory_used_bytes ?? m.memory_total_bytes - m.memory_available_bytes)} (${m.memory_percent.toFixed(1)}%)`} fraction={m.memory_percent / 100} tone={m.memory_percent > 90 ? 'error' : 'brand'} />
            <MeterRow label="Swap used" valueText={`${fmtBytes(m.swap_used_bytes)} (${m.swap_percent ?? 0}%)`} fraction={(m.swap_percent ?? 0) / 100} tone={(m.swap_percent ?? 0) > 60 ? 'error' : 'brand'} />
            <div style={{ marginTop: 10 }}>
              <Text weight="semibold" size={200}>Per-core utilization</Text>
              <div className={s.busyRow} style={{ marginTop: 6 }}>
                {(m.cpu_per_core_percent || []).map((v, i) => (
                  <div key={i} title={`Core ${i}: ${v}%`} style={{ width: 16, height: 30, borderRadius: 3, background: v > 80 ? tokens.colorPaletteRedBackground3 : v > 40 ? tokens.colorPaletteDarkOrangeBackground2 : tokens.colorBrandBackground2, position: 'relative' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${Math.min(100, v)}%`, borderRadius: 3, background: tokens.colorBrandBackground }} />
                  </div>
                ))}
              </div>
            </div>
            {Object.keys(m.disk_busy_percent || {}).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <Text weight="semibold" size={200}>Physical disk busy %</Text>
                {Object.entries(m.disk_busy_percent || {}).map(([name, pct]) => (
                  <MeterRow key={name} label={name} valueText={`${pct}%`} fraction={pct / 100} tone={pct > 80 ? 'error' : 'brand'} />
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Disk capacity" subtitle="Mounted volumes and free space">
            {(m.disks || []).map(d => (
              <div key={d.mountpoint} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <b>{d.mountpoint} <span style={{ color: tokens.colorNeutralForeground3 }}>{d.device}</span></b>
                  <b>{d.percent}% used</b>
                </div>
                <ProgressBar value={Math.min(1, d.percent / 100)} color={d.percent >= 90 ? 'error' : 'brand'} />
                <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{fmtBytes(d.used_bytes)} used of {fmtBytes(d.total_bytes)} Â· {fmtBytes(d.free_bytes)} free</Text>
              </div>
            ))}
          </Panel>
        </div>
      )}
      {m && (
        <div className={s.grid}>
          <Panel title="Processes with highest CPU usage" subtitle="CPU sampling is best-effort; first samples can read zero">
            <DataTable<TopProc>
              items={m.top_cpu.slice(0, 20)}
              columns={cpuColumns}
              getRowId={x => 'cpu' + String(x.pid)}
              ariaLabel="Top CPU processes"
              loading={false}
            />
          </Panel>
          <Panel title="Processes with highest disk I/O" subtitle="Rates are sampled deltas of cumulative I/O counters">
            <DataTable<TopProc>
              items={m.top_disk.slice(0, 20)}
              columns={diskColumns}
              getRowId={x => 'disk' + String(x.pid)}
              ariaLabel="Top disk processes"
              loading={false}
            />
          </Panel>
        </div>
      )}
      <MessageBar intent="warning" style={{ marginTop: tokens.spacingVerticalM }}>
        <MessageBarBody>Disk and CPU spikes are investigation clues, not proof of a file transfer. Pair this telemetry with the Network connections page and Windows firewall events.</MessageBarBody>
      </MessageBar>
    </>
  );
}


