import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge, Button, Card, CardHeader, MessageBar, MessageBarBody, ProgressBar, Text, Switch,
  makeStyles, tokens,
} from '@fluentui/react-components';
import {
  ArrowRight24Regular, Globe24Regular, HardDrive24Regular, ShieldCheckmark24Regular, Wifi124Regular,
} from '@fluentui/react-icons';
import { api } from '../api';
import { Metric, PageIntro, Panel, Secondary, Sparkline, fmtBytes, fmtRate, MeterRow } from '../components/ui';

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: tokens.spacingVerticalS },
  dash: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: tokens.spacingVerticalL, alignItems: 'start' },
  hero: { display: 'flex', alignItems: 'center', gap: '16px', padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`, borderRadius: tokens.borderRadiusXLarge, border: `1px solid ${tokens.colorNeutralStroke2}`, background: `linear-gradient(112deg, ${tokens.colorBrandBackground2} 0%, ${tokens.colorNeutralBackground1} 70%)`, marginBottom: tokens.spacingVerticalL },
  heroGlyph: { display: 'grid', placeItems: 'center', width: '56px', height: '56px', borderRadius: tokens.borderRadiusLarge, background: tokens.colorBrandBackground, color: tokens.colorNeutralForegroundOnBrand, flexShrink: 0 },
  heroText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' },
  heroSwitch: { display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '16px', borderLeft: `1px solid ${tokens.colorNeutralStroke2}`, minWidth: '170px' },
  profileRow: { display: 'flex', gap: tokens.spacingVerticalS, flexWrap: 'wrap' as const },
  profileCard: { flex: '1 1 200px', padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`, border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, display: 'flex', flexDirection: 'column', gap: '6px' },
  activityRow: { display: 'flex', gap: '10px', padding: '9px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  activityDot: { width: '8px', height: '8px', borderRadius: '50%', background: tokens.colorBrandForeground1, marginTop: '7px', flexShrink: 0 },
  chartRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' },
  chartLabel: { minWidth: '120px', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
});

export function OverviewPage({ onNavigate, onDryToggle, dry }: { onNavigate: (page: string) => void; onDryToggle: (v: boolean) => void; dry: boolean }) {
  const s = useStyles();
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: 5000 });
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: api.metrics, refetchInterval: 3000 });
  const rules = useQuery({ queryKey: ['rules'], queryFn: api.managedRules, refetchInterval: 5000 });
  const activity = useQuery({ queryKey: ['activity'], queryFn: api.activity, refetchInterval: 10000 });

  const history = useRef<{ cpu: number[]; mem: number[]; sent: number[]; recv: number[]; read: number[]; write: number[] }>({ cpu: [], mem: [], sent: [], recv: [], read: [], write: [] });
  const m = metrics.data;
  useEffect(() => {
    if (!m) return;
    const h = history.current;
    const push = (arr: number[], v: number) => { arr.push(v); if (arr.length > 120) arr.shift(); };
    push(h.cpu, m.cpu_percent); push(h.mem, m.memory_percent);
    push(h.sent, m.net_sent_bytes_per_sec); push(h.recv, m.net_recv_bytes_per_sec);
    push(h.read, m.disk_read_bytes_per_sec); push(h.write, m.disk_write_bytes_per_sec);
  }, [m]);
  const cpu = m?.cpu_percent ?? 0;
  const ram = m?.memory_percent ?? 0;

  const activeRules = (rules.data || []).filter(r => r.status === 'created').length;
  const profiles = overview.data?.profiles || [];

  return (
    <>
      <PageIntro
        eyebrow="Live security overview"
        title="Know where your PC is connecting."
        desc="Live view of network exposure, system pressure, active Windows Firewall protection, and your managed outbound controls."
        action={<Button appearance="primary" icon={<ArrowRight24Regular />} onClick={() => onNavigate('processes')}>Inspect services</Button>}
      />

      <div className={s.hero}>
        <div className={s.heroGlyph}><ShieldCheckmark24Regular /></div>
        <div className={s.heroText}>
          <Text weight="semibold" size={500}>{dry ? 'Observe first. Block with confidence.' : 'Outbound protection is in live mode.'}</Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
            {dry ? 'Dry-run records your intent without changing Windows Firewall. Turn off dry-run to apply real block rules.' : 'New block and unblock actions change Windows Defender Firewall after administrator approval.'}
          </Text>
        </div>
        <div className={s.heroSwitch}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text weight="semibold">Dry-run</Text>
            <Switch checked={dry} onChange={(_, d) => { if (!d.checked && !window.confirm('Enable live firewall enforcement? Future apply actions change Windows Defender Firewall after UAC approval.')) return; onDryToggle(d.checked); }} />
          </div>
          <Badge appearance="filled" color={dry ? 'warning' : 'success'}>{dry ? 'SAFE PREVIEW' : 'LIVE ENFORCEMENT'}</Badge>
        </div>
      </div>

      <div className={s.grid} style={{ marginBottom: tokens.spacingVerticalM }}>
        <Metric label="Remote connections" value={overview.data?.connection_count ?? 'â€”'} detail={`${overview.data?.process_count ?? 'â€”'} processes observed`} icon={<Globe24Regular />} />
        <Metric label="Managed block rules" value={overview.data?.managed_rules ?? 'â€”'} detail={`${activeRules} recorded active`} icon={<ShieldCheckmark24Regular />} />
        <Metric label="Network throughput" value={<span>â†“ {fmtRate(m?.net_recv_bytes_per_sec)} Â· â†‘ {fmtRate(m?.net_sent_bytes_per_sec)}</span>} detail="received / sent across all interfaces" icon={<Wifi124Regular />} tone="brand" />
        <Metric label="Disk writes" value={fmtRate(m?.disk_write_bytes_per_sec)} detail="system-wide current write rate" icon={<HardDrive24Regular />} tone="orange" />
      </div>

      <div className={s.dash}>
        <Panel title="System health" subtitle="Refreshes every 3 seconds" action={<Button appearance="subtle" size="small" onClick={() => onNavigate('monitor')}>Open monitor<span style={{ marginLeft: '6px' }}><ArrowRight24Regular /></span></Button>}>
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
                <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>Inbound: {p.default_inbound_action || 'â€”'} Â· Outbound: {p.default_outbound_action || 'â€”'}</Text>
              </div>
            ))}
            {!profiles.length && <MessageBar intent="info"><MessageBarBody>Profile state is not available on this platform.</MessageBarBody></MessageBar>}
          </div>
        </Panel>

        <Panel title="Trend â€” last 2 minutes" subtitle="Sparklines from live samples">
          <div style={{ display: 'grid', gap: 10 }}>
            <div className={s.chartRow}><span className={s.chartLabel}>CPU</span><Sparkline values={history.current.cpu} /><Badge>{(history.current.cpu.at(-1) ?? 0).toFixed(1)}%</Badge></div>
            <div className={s.chartRow}><span className={s.chartLabel}>Memory</span><Sparkline values={history.current.mem} color={tokens.colorPaletteGreenForeground1} /><Badge>{(history.current.mem.at(-1) ?? 0).toFixed(1)}%</Badge></div>
            <div className={s.chartRow}><span className={s.chartLabel}>Net â†“</span><Sparkline values={history.current.recv} color={tokens.colorPaletteGreenForeground1} /><Badge>{fmtBytes(history.current.recv.at(-1) ?? 0)}/s</Badge></div>
            <div className={s.chartRow}><span className={s.chartLabel}>Net â†‘</span><Sparkline values={history.current.sent} color={tokens.colorBrandForeground2} /><Badge>{fmtBytes(history.current.sent.at(-1) ?? 0)}/s</Badge></div>
            <div className={s.chartRow}><span className={s.chartLabel}>Disk reads</span><Sparkline values={history.current.read} color={tokens.colorPaletteMarigoldBorderActive} /><Badge>{fmtBytes(history.current.read.at(-1) ?? 0)}/s</Badge></div>
            <div className={s.chartRow}><span className={s.chartLabel}>Disk writes</span><Sparkline values={history.current.write} color={tokens.colorPaletteRedForeground1} /><Badge>{fmtBytes(history.current.write.at(-1) ?? 0)}/s</Badge></div>
          </div>
        </Panel>

        <Panel title="Recent security activity" subtitle="Latest local audit records" action={<Button appearance="subtle" size="small" onClick={() => onNavigate('events')}>View events</Button>}>
          {(activity.data || []).slice(0, 7).map((a, i) => (
            <div className={s.activityRow} key={i}>
              <span className={s.activityDot} />
              <div style={{ minWidth: 0 }}>
                <div>{a.summary}</div>
                <Secondary>{a.category} Â· {new Date(a.time).toLocaleString()}</Secondary>
              </div>
            </div>
          ))}
          {!(activity.data || []).length && <MessageBar intent="info"><MessageBarBody>No activity recorded yet.</MessageBarBody></MessageBar>}
        </Panel>
      </div>

      {m && (m.top_disk || []).some(p => (p.write_bytes_per_sec || 0) > 5 * 1024 * 1024) && (
        <MessageBar intent="warning" style={{ marginTop: tokens.spacingVerticalM }}>
          <MessageBarBody>
            {(m.top_disk || []).filter(p => (p.write_bytes_per_sec || 0) > 5 * 1024 * 1024).length} process(es) write faster than 5 MB/s right now â€” review the System monitor. High writes alone do not prove data exfiltration.
          </MessageBarBody>
        </MessageBar>
      )}
      <div style={{ display: 'none' }} />
    </>
  );
}

