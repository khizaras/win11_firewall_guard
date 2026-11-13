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
  pageIntro: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', margin: '0 0 20px' },
  introText: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  pageTitle: { margin: 0, fontFamily: tokens.fontFamilyNumeric, fontSize: '28px', lineHeight: '36px', fontWeight: tokens.fontWeightSemibold },
  pageDesc: { color: tokens.colorNeutralForeground2, fontSize: '14px', maxWidth: '68ch', lineHeight: '20px' },
  panel: {
    padding: '4px 16px 16px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    boxShadow: 'none',
    background: tokens.colorNeutralBackground1,
    gap: '8px',
  },
  panelHeaderInner: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', minHeight: '40px' },
  metricCard: {
    padding: '14px 16px',
    minHeight: '96px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    background: tokens.colorNeutralBackground1,
    boxShadow: 'none',
    textAlign: 'left',
    color: 'inherit',
    font: 'inherit',
    width: '100%',
    cursor: 'default',
  },
  metricButton: { cursor: 'pointer', ':hover': { background: tokens.colorNeutralBackground1Hover }, ':active': { background: tokens.colorNeutralBackground1Pressed } },
  metricTop: { display: 'flex', alignItems: 'center', gap: '8px', color: tokens.colorNeutralForeground2 },
  metricIcon: { display: 'grid', placeItems: 'center', width: '20px', height: '20px', flexShrink: 0 },
  metricLabel: { fontSize: '14px', fontWeight: tokens.fontWeightSemibold, flex: 1 },
  metricValue: { fontFamily: tokens.fontFamilyNumeric, fontSize: '22px', fontWeight: tokens.fontWeightSemibold, lineHeight: '28px', overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' },
  metricDetail: { color: tokens.colorNeutralForeground2, fontSize: '12px', lineHeight: '16px' },
  muted: { color: tokens.colorNeutralForeground3 },
  mono: { fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200 },
  secondary: { display: 'block', color: tokens.colorNeutralForeground2, fontSize: '12px', marginTop: '2px', lineHeight: '16px' },
  empty: { padding: '28px 16px', textAlign: 'center', color: tokens.colorNeutralForeground2, fontSize: '14px' },
  pathCell: { display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: tokens.colorNeutralForeground2, fontFamily: tokens.fontFamilyMonospace, fontSize: '12px' },
  meter: { display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) 72px', gap: '12px', alignItems: 'center', minHeight: '28px' },
  meterLabel: { fontSize: '14px', color: tokens.colorNeutralForeground1 },
  meterTrack: { height: '4px', borderRadius: '2px', background: tokens.colorNeutralBackground5, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: '2px' },
  meterValue: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: tokens.fontWeightSemibold, fontSize: '14px' },
});

/* ---------- basic blocks ---------- */
export function PageIntro({ title, desc, action }: { eyebrow?: string; title: string; desc: string; action?: React.ReactNode }) {
  const s = useStyles();
  return (
    <div className={s.pageIntro}>
      <div className={s.introText}>
        <Text as="h1" className={s.pageTitle}>{title}</Text>
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

export function Metric({ label, value, detail, icon, onClick }: { label: string; value: React.ReactNode; detail?: string; icon: React.ReactNode; tone?: 'brand' | 'orange' | 'green' | 'red'; onClick?: () => void }) {
  const s = useStyles();
  const body = (
    <>
      <div className={s.metricTop}>
        <span className={s.metricIcon}>{icon}</span>
        <Text className={s.metricLabel}>{label}</Text>
      </div>
      <Text className={s.metricValue}>{value ?? '—'}</Text>
      {detail && <Text className={s.metricDetail}>{detail}</Text>}
    </>
  );
  if (onClick) {
    return <button type="button" className={mergeClasses(s.metricCard, s.metricButton)} onClick={onClick}>{body}</button>;
  }
  return <div className={s.metricCard}>{body}</div>;
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
  const s = useStyles();
  return (
    <div className={s.meter}>
      <span className={s.meterLabel}>{label}</span>
      <div className={s.meterTrack}>
        <div className={s.meterFill} style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%`, background: tone === 'error' ? tokens.colorPaletteRedBackground3 : tokens.colorBrandBackground }} />
      </div>
      <span className={s.meterValue}>{valueText}</span>
    </div>
  );
}
export function mergeCls(a: string | undefined, b?: string) { return mergeClasses(a || '', b || ''); }
