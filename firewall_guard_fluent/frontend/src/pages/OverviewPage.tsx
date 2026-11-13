import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge, Button, Card, CardHeader, MessageBar, MessageBarBody, ProgressBar, Text, Switch,
  makeStyles, tokens,
} from '@fluentui/react-components';
import {
  ArrowRight24Regular, Globe24Regular, HardDrive24Regular, ShieldCheckmark24Regular, Wifi124Regular,
} from '@fluentui/react-icons';
import { api } from '../api';
import { LiveChart, useLiveSamples } from '../components/LiveChart';
import { Metric, PageIntro, Panel, Secondary, fmtBytes, fmtRate, MeterRow } from '../components/ui';

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' },
  dash: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', alignItems: 'start', '@media (max-width: 980px)': { gridTemplateColumns: '1fr' } },
  hero: { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '8px', border: `1px solid ${tokens.colorNeutralStroke2}`, background: tokens.colorNeutralBackground1 },
  heroGlyph: { display: 'grid', placeItems: 'center', width: '48px', height: '48px', flexShrink: 0 },
  heroText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  heroSwitch: { display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '16px', borderLeft: `1px solid ${tokens.colorNeutralStroke2}`, minWidth: '150px' },
  profileRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const },
  profileCard: { flex: '1 1 180px', padding: '12px', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '6px', background: tokens.colorNeutralBackground1 },
  activityRow: { display: 'flex', gap: '10px', padding: '10px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  activityDot: { width: '8px', height: '8px', borderRadius: '4px', background: tokens.colorBrandForeground1, marginTop: '6px', flexShrink: 0 },
  chartLabel: { fontSize: '12px', color: tokens.colorNeutralForeground2 },
});

export function OverviewPage({ onNavigate, onDryToggle, dry }: { onNavigate: (page: string) => void; onDryToggle: (v: boolean) => void; dry: boolean }) {
  const s = useStyles();
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: 5000 });
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: api.metrics, refetchInterval: 3000 });
  const rules = useQuery({ queryKey: ['rules'], queryFn: api.managedRules, refetchInterval: 5000 });
  const activity = useQuery({ queryKey: ['activity'], queryFn: api.activity, refetchInterval: 10000 });

  const m = metrics.data;
  const point = useMemo(() => m ? {
    t: m.sampled_at || Date.now() / 1000,
    values: {
      cpu: m.cpu_percent, mem: m.memory_percent,
      sent: m.net_sent_bytes_per_sec, recv: m.net_recv_bytes_per_sec,
      read: m.disk_read_bytes_per_sec, write: m.disk_write_bytes_per_sec,
    },
  } : null, [m]);
  const samples = useLiveSamples(point, 40);
  const series = (id: string) => samples.map(p => p.values[id] ?? 0);
  const cpu = m?.cpu_percent ?? 0;
  const ram = m?.memory_percent ?? 0;

  const activeRules = (rules.data || []).filter(r => r.status === 'created').length;
  const profiles = overview.data?.profiles || [];

  return (
    <>
      <PageIntro
        title="Overview"
        desc="Network exposure, system pressure, Windows Firewall profiles, and the outbound rules this app manages."
        action={<Button appearance="primary" onClick={() => onNavigate('processes')}>Inspect services</Button>}
      />

      <div className={s.hero}>
        <div className={s.heroGlyph} style={{ color: dry ? tokens.colorPaletteMarigoldForeground1 : tokens.colorPaletteGreenForeground1 }}>
          <ShieldCheckmark24Regular style={{ width: 40, height: 40 }} />
        </div>
        <div className={s.heroText}>
          <Text weight="semibold" size={500}>{dry ? 'Dry-run is on' : 'Live enforcement is on'}</Text>
          <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
            {dry ? 'Actions are recorded and Windows Firewall is left unchanged. Turn dry-run off to apply block rules.' : 'Block and unblock actions change Windows Defender Firewall after you approve the UAC prompt.'}
          </Text>
        </div>
        <div className={s.heroSwitch}>
          <Text weight="semibold">Dry-run</Text>
          <Switch checked={dry} onChange={(_, d) => { if (!d.checked && !window.confirm('Enable live firewall enforcement? Future apply actions change Windows Defender Firewall after UAC approval.')) return; onDryToggle(d.checked); }} />
        </div>
      </div>

      <div className={s.grid}>
        <Metric label="Remote connections" value={overview.data?.connection_count ?? '—'} detail={`${overview.data?.process_count ?? '—'} processes observed`} icon={<Globe24Regular />} onClick={() => onNavigate('connections')} />
        <Metric label="Managed block rules" value={overview.data?.managed_rules ?? '—'} detail={`${activeRules} recorded active`} icon={<ShieldCheckmark24Regular />} onClick={() => onNavigate('rules')} />
        <Metric label="Network in" value={fmtRate(m?.net_recv_bytes_per_sec)} detail={`${fmtRate(m?.net_sent_bytes_per_sec)} sent`} icon={<Wifi124Regular />} onClick={() => onNavigate('monitor')} />
        <Metric label="Disk writes" value={fmtRate(m?.disk_write_bytes_per_sec)} detail="Current write rate on this PC" icon={<HardDrive24Regular />} onClick={() => onNavigate('disk')} />
      </div>

      <div className={s.dash}>
        <Panel title="System health" subtitle="Refreshes every 3 seconds" action={<Button appearance="subtle" size="small" icon={<ArrowRight24Regular />} iconPosition="after" onClick={() => onNavigate('monitor')}>Open monitor</Button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MeterRow label="CPU utilization" valueText={`${cpu.toFixed(1)}%`} fraction={cpu / 100} tone={cpu > 85 ? 'error' : 'brand'} />
            <MeterRow label="Memory used" valueText={`${ram.toFixed(1)}%`} fraction={ram / 100} tone={ram > 90 ? 'error' : 'brand'} />
            {(m?.cpu_per_core_percent || []).length > 0 && (
              <div>
                <span className={s.chartLabel}>Per-core load</span>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {(m?.cpu_per_core_percent || []).map((v, i) => (
                    <div key={i} title={`Core ${i}: ${v}%`} style={{ width: 14, height: 26, borderRadius: 3, background: v > 80 ? tokens.colorPaletteRedBackground3 : v > 40 ? tokens.colorPaletteDarkOrangeBackground2 : tokens.colorBrandBackground2 }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Firewall profiles" subtitle="Live Windows Defender state">
          <div className={s.profileRow}>
            {profiles.map(p => (
              <div className={s.profileCard} key={p.profile}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text weight="semibold">{p.profile}</Text>
                  <Badge appearance="filled" color={p.enabled === 'True' ? 'success' : 'warning'}>{p.enabled === 'True' ? 'Active' : 'Disabled'}</Badge>
                </div>
                <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>Inbound {p.default_inbound_action || '—'} · Outbound {p.default_outbound_action || '—'}</Text>
              </div>
            ))}
            {!profiles.length && <MessageBar intent="info"><MessageBarBody>Profile state is not available on this platform.</MessageBarBody></MessageBar>}
          </div>
        </Panel>

        <Panel title="Last two minutes" subtitle="Live samples, refreshed every 3 seconds">
          <LiveChart title="CPU and memory" unit="%" yMax={100} height={140} series={[
            { id: 'cpu', label: 'CPU', color: tokens.colorBrandForeground1, values: series('cpu'), format: n => `${n.toFixed(1)}%` },
            { id: 'mem', label: 'Memory', color: tokens.colorPaletteGreenForeground1, values: series('mem'), format: n => `${n.toFixed(1)}%` },
          ]} />
          <LiveChart title="Network" height={120} series={[
            { id: 'recv', label: 'In', color: tokens.colorPaletteTealForeground2, values: series('recv'), format: n => fmtRate(n) },
            { id: 'sent', label: 'Out', color: tokens.colorBrandForeground2, values: series('sent'), format: n => fmtRate(n) },
          ]} />
          <LiveChart title="Disk" height={120} series={[
            { id: 'read', label: 'Read', color: tokens.colorPaletteMarigoldForeground1, values: series('read'), format: n => fmtRate(n) },
            { id: 'write', label: 'Write', color: tokens.colorPaletteRedForeground1, values: series('write'), format: n => fmtRate(n) },
          ]} />
        </Panel>

        <Panel title="Recent security activity" subtitle="Latest local audit records" action={<Button appearance="subtle" size="small" onClick={() => onNavigate('events')}>View events</Button>}>
          {(activity.data || []).slice(0, 7).map((a, i) => (
            <div className={s.activityRow} key={i}>
              <span className={s.activityDot} />
              <div style={{ minWidth: 0 }}>
                <div>{a.summary}</div>
                <Secondary>{a.category} · {new Date(a.time).toLocaleString()}</Secondary>
              </div>
            </div>
          ))}
          {!(activity.data || []).length && <MessageBar intent="info"><MessageBarBody>No activity recorded yet.</MessageBarBody></MessageBar>}
        </Panel>
      </div>

      {m && (m.top_disk || []).some(p => (p.write_bytes_per_sec || 0) > 5 * 1024 * 1024) && (
        <MessageBar intent="warning" style={{ marginTop: tokens.spacingVerticalM }}>
          <MessageBarBody>
            {(m.top_disk || []).filter(p => (p.write_bytes_per_sec || 0) > 5 * 1024 * 1024).length} processes are writing faster than 5 MB/s. Open System monitor to see which ones. High writes alone do not show what was sent.
          </MessageBarBody>
        </MessageBar>
      )}
      <div style={{ display: 'none' }} />
    </>
  );
}

