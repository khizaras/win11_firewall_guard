import React, { useMemo } from 'react';
import { makeStyles, tokens, Badge, Card, CardHeader, Text, mergeClasses } from '@fluentui/react-components';

/* ---------- formatting ---------- */
export function fmtBytes(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let v = n, i = 0;
  while (Math.abs(v) >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}
export function fmtRate(n: number | undefined | null): string {
  const b = fmtBytes(n);
  return b === '—' ? '—' : `${b}/s`;
}
export function fmtTime(epoch: number | undefined): string {
  if (!epoch) return '—';
  return new Date(epoch * 1000).toLocaleString();
}
export function wildcardMatch(value: string, pattern: string): boolean {
  const esc = (pattern || '*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + esc + '$', 'i').test(value || '');
}
export function matchAny(values: (string | number | undefined)[], pattern: string): boolean {
  return values.some(v => wildcardMatch(String(v ?? ''), pattern));
}

/* ---------- styles ---------- */
const useStyles = makeStyles({
  pageIntro: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', marginBottom: tokens.spacingVerticalL },
  introText: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  eyebrow: { color: tokens.colorBrandForeground1, fontSize: tokens.fontSizeBase100, fontWeight: tokens.fontWeightSemibold, letterSpacing: '0.12em', textTransform: 'uppercase' },
  pageTitle: { margin: 0, letterSpacing: '-0.02em' },
  pageDesc: { color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300, maxWidth: '800px', lineHeight: '1.5' },
  panel: { padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`, border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge, boxShadow: tokens.shadow2, background: tokens.colorNeutralBackground1 },
  panelHeaderInner: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' },
  metricCard: { padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`, minHeight: '140px', display: 'flex', flexDirection: 'column', gap: '6px' },
  metricIcon: { width: '38px', height: '38px', borderRadius: tokens.borderRadiusMedium, display: 'grid', placeItems: 'center', background: tokens.colorBrandBackground2, color: tokens.colorBrandForeground1 },
  metricLabel: { color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase200, fontWeight: tokens.fontWeightSemibold },
  metricValue: { fontSize: '24px', fontWeight: tokens.fontWeightBold, lineHeight: 1.25, overflowWrap: 'anywhere' },
  metricDetail: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100 },
  muted: { color: tokens.colorNeutralForeground3 },
  mono: { fontFamily: 'Consolas, "Cascadia Code", monospace', fontSize: tokens.fontSizeBase100 },
  secondary: { display: 'block', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100, marginTop: '3px', lineHeight: 1.4 },
  empty: { padding: '32px', textAlign: 'center', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  pathCell: { display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: tokens.colorNeutralForeground2, fontFamily: 'Consolas, "Cascadia Code", monospace', fontSize: tokens.fontSizeBase100 },
});

/* ---------- basic blocks ---------- */
export function PageIntro({ eyebrow, title, desc, action }: { eyebrow: string; title: string; desc: string; action?: React.ReactNode }) {
  const s = useStyles();
  return (
    <div className={s.pageIntro}>
      <div className={s.introText}>
        <Text className={s.eyebrow}>{eyebrow}</Text>
        <Text as="h1" size={600} weight="semibold" className={s.pageTitle}>{title}</Text>
        <Text className={s.pageDesc}>{desc}</Text>
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  const s = useStyles();
  return (
    <Card className={s.panel}>
      <CardHeader
        header={
          <div className={s.panelHeaderInner}>
            <div>
              <Text weight="semibold" size={400}>{title}</Text>
              {subtitle && <div className={s.secondary}>{subtitle}</div>}
            </div>
            {action}
          </div>
        }
      />
      {children}
    </Card>
  );
}

export function Metric({ label, value, detail, icon, tone }: { label: string; value: React.ReactNode; detail?: string; icon: React.ReactNode; tone?: 'brand' | 'orange' | 'green' | 'red' }) {
  const s = useStyles();
  return (
    <Card className={s.metricCard}>
      <div className={s.metricIcon}>{icon}</div>
      <Text className={s.metricLabel}>{label}</Text>
      <Text className={s.metricValue}>{value ?? '—'}</Text>
      {detail && <Text className={s.metricDetail}>{detail}</Text>}
    </Card>
  );
}

export function Empty({ children = 'No matching records.' }: { children?: React.ReactNode }) {
  const s = useStyles();
  return <div className={s.empty}>{children}</div>;
}

export function Muted({ children }: { children: React.ReactNode }) { const s = useStyles(); return <span className={s.muted}>{children}</span>; }
export function Mono({ children }: { children: React.ReactNode }) { const s = useStyles(); return <span className={s.mono}>{children}</span>; }
export function PathCell({ value }: { value?: string }) { const s = useStyles(); return <span className={s.pathCell} title={value || ''}>{value || 'Unavailable'}</span>; }
export function Secondary({ children }: { children: React.ReactNode }) { const s = useStyles(); return <span className={s.secondary}>{children}</span>; }

/* ---------- state badges ---------- */
const goodStates = new Set(['running', 'created', 'created_verified', 'removed_verified', 'success']);
const warnStates = new Set(['stop_pending', 'paused', 'dry_run', 'pending']);
export function StatusBadge({ value, color }: { value?: string; color?: 'brand' | 'good' | 'warn' | 'subtle' }) {
  const derived: 'good' | 'warn' | 'subtle' =
    color && color !== 'brand' ? color : goodStates.has(value || '') ? 'good' : warnStates.has(value || '') ? 'warn' : 'subtle';
  const mapping = { good: 'success' as const, warn: 'warning' as const, subtle: 'subtle' as const };
  return <Badge appearance="filled" color={mapping[derived]}>{value || '—'}</Badge>;
}

/* ---------- sparkline (dependency-free) ---------- */
export function Sparkline({ values, width = 220, height = 42, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  const stroke = color || tokens.colorBrandForeground1;
  const pts = useMemo(() => {
    if (values.length < 2) return '';
    const max = Math.max(...values, 1e-6);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    return values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - ((v - min) / span) * (height - 6)}`).join(' ');
  }, [values, width, height]);
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  return <svg width={width} height={height} aria-hidden="true" style={{ display: 'block' }}><polyline fill="none" stroke={stroke} strokeWidth={1.6} points={pts} /></svg>;
}
export function MeterRow({ label, valueText, fraction, tone }: { label: string; valueText: string; fraction: number; tone?: 'brand' | 'error' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ minWidth: 120, fontSize: 12, color: 'inherit' }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: tokens.colorNeutralBackground5, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%`, height: '100%', borderRadius: 99, background: tone === 'error' ? tokens.colorPaletteRedBackground3 : tokens.colorBrandBackground }} />
      </div>
      <span style={{ minWidth: 74, textAlign: 'right', fontWeight: 600 }}>{valueText}</span>
    </div>
  );
}
export function mergeCls(a: string | undefined, b?: string) { return mergeClasses(a || '', b || ''); }
