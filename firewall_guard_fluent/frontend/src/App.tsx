import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Menu, MenuPopover, MenuTrigger, MenuList, MenuItem, MessageBar, MessageBarBody,
  Spinner, Switch, Text, Tooltip, Toaster, makeStyles, mergeClasses, tokens, useToastController,
} from '@fluentui/react-components';
import {
  ArrowSync24Regular, Checkmark24Regular, Home24Regular, Desktop24Regular, Globe24Regular, DataUsage24Regular,
  ShieldTask24Regular, History24Regular, ShieldCheckmark24Regular, Settings24Regular, ArrowSwap24Regular, HardDrive24Regular,
  Storage24Regular, DeveloperBoard24Regular,
  WeatherMoon24Regular, WeatherSunny24Regular, WeatherPartlyCloudyDay24Regular,
} from '@fluentui/react-icons';
import { api } from './api';
import { AppCtx, type AppCtxValue, type BlockRequest, type UnblockRequest } from './appContext';
import { BlockDialog, RemoveDialog } from './components/dialogs';
import { OverviewPage } from './pages/OverviewPage';
import { ProcessesPage } from './pages/ProcessesPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { TrafficPage } from './pages/TrafficPage';
import { MonitorPage } from './pages/MonitorPage';
import { DiskPage, GpuPage, MemoryPage } from './pages/ResourcesPage';
import { EventsPage } from './pages/EventsPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { RulesPage } from './pages/RulesPage';
import { useTheme, type ThemeMode } from './theme';

type PageId = 'overview' | 'processes' | 'connections' | 'traffic' | 'monitor' | 'memory' | 'gpu' | 'disk' | 'events' | 'policies' | 'rules';
type NavItem = [PageId, string, React.FC];
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Home', items: [['overview', 'Overview', Home24Regular]] },
  { label: 'Protection', items: [
    ['processes', 'Processes & services', Desktop24Regular],
    ['events', 'Firewall events', History24Regular],
    ['policies', 'Policy center', ShieldTask24Regular],
    ['rules', 'Managed rules', ShieldCheckmark24Regular],
  ] },
  { label: 'Network', items: [
    ['connections', 'Network connections', Globe24Regular],
    ['traffic', 'Traffic inspector', ArrowSwap24Regular],
  ] },
  { label: 'Performance', items: [
    ['monitor', 'System monitor', DataUsage24Regular],
    ['memory', 'Memory', Storage24Regular],
    ['gpu', 'GPU', DeveloperBoard24Regular],
    ['disk', 'Disk', HardDrive24Regular],
  ] },
];
const NAV = NAV_GROUPS.flatMap(group => group.items);

const useStyles = makeStyles({
  shell: {
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr)',
    minHeight: '100vh',
    background: tokens.colorNeutralBackground3,
    '@media (max-width: 900px)': { gridTemplateColumns: '1fr' },
  },
  sidebar: {
    position: 'sticky',
    top: 0,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    background: tokens.colorNeutralBackground2,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    overflowY: 'auto',
    '@media (max-width: 900px)': { position: 'relative', height: 'auto', borderRight: 'none', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', height: '48px', padding: '0 10px', flexShrink: 0 },
  brandIcon: { display: 'grid', placeItems: 'center', width: '20px', height: '20px', color: tokens.colorBrandForeground1 },
  nav: { display: 'flex', flexDirection: 'column', gap: '2px', paddingTop: '4px' },
  groupLabel: { margin: '14px 12px 4px', fontSize: '12px', lineHeight: '16px', fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground3 },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    height: '36px',
    padding: '0 10px',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: tokens.colorNeutralForeground1,
    font: 'inherit',
    fontSize: '14px',
    lineHeight: '20px',
    textAlign: 'left',
    cursor: 'pointer',
    ':hover': { background: tokens.colorNeutralBackground1Hover },
    ':active': { background: tokens.colorNeutralBackground1Pressed },
  },
  navItemOn: { background: tokens.colorNeutralBackground1, fontWeight: tokens.fontWeightSemibold, ':hover': { background: tokens.colorNeutralBackground1 } },
  navIcon: { display: 'grid', placeItems: 'center', width: '20px', height: '20px', flexShrink: 0, '& svg': { width: '20px', height: '20px' } },
  safety: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 10px 4px' },
  safetyRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  foot: { fontSize: '12px', lineHeight: '16px', color: tokens.colorNeutralForeground3, padding: '0 2px' },
  main: { minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  command: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '8px',
    minHeight: '48px',
    padding: '0 24px',
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: tokens.colorNeutralBackground3,
  },
  dryWrap: { display: 'flex', alignItems: 'center', gap: '8px', height: '32px', padding: '0 8px', borderRadius: '4px', background: tokens.colorNeutralBackground1, border: `1px solid ${tokens.colorNeutralStroke2}` },
  content: { padding: '8px 36px 48px', display: 'flex', flexDirection: 'column', gap: '16px', '@media (max-width: 720px)': { padding: '8px 16px 32px' } },
});

const THEME_LABEL: Record<ThemeMode, string> = { system: 'Match Windows', light: 'Light', dark: 'Dark' };

export default function App() {
  const s = useStyles();
  const qc = useQueryClient();
  const themeCtl = useTheme();
  const toaster = useToastController('console-toasts');

  const [page, setPage] = useState<PageId>('overview');
  const [dry, setDryRaw] = useState<boolean | null>(null);
  const [blockItems, setBlockItems] = useState<BlockRequest[] | null>(null);
  const [unblockRules, setUnblockRules] = useState<UnblockRequest[] | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: 5000 });
  React.useEffect(() => {
    if (overview.data && dry === null) setDryRaw(overview.data.dry_run);
  }, [overview.data, dry]);
  const dryMode = dry ?? overview.data?.dry_run ?? true;
  const connectionLost = overview.isError && !overview.data;

  const toast = (kind: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => {
    toaster.dispatchToast(
      (
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          {message && <div style={{ fontSize: 12 }}>{message}</div>}
        </div>
      ),
      { toastId: `${Date.now()}-${title}` },
    );
  };

  const ctxValue: AppCtxValue = {
    dry: dryMode,
    requestBlock: items => setBlockItems(items),
    requestUnblock: rules => setUnblockRules(rules),
    toast,
  };

  const setDryMode = async (v: boolean) => {
    try {
      const r = await api.dry(v);
      setDryRaw(r.dry_run);
      toast('success', v ? 'Dry-run enabled' : 'Live enforcement enabled', v ? 'Intent-only logging until you re-enable live mode.' : 'Apply actions now change Windows Defender Firewall after UAC approval.');
      void qc.invalidateQueries();
    } catch (e) {
      toast('error', 'Failed to change dry-run', String(e));
    }
  };

  return (
    <AppCtx.Provider value={ctxValue}>
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <span className={s.brandIcon}><ShieldCheckmark24Regular /></span>
          <Text weight="semibold" size={300}>Firewall Guard</Text>
        </div>
        <nav className={s.nav} aria-label="Console">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div className={s.groupLabel}>{group.label}</div>
              {group.items.map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={mergeClasses(s.navItem, page === id && s.navItemOn)}
                  aria-current={page === id ? 'page' : undefined}
                  onClick={() => setPage(id)}
                >
                  <span className={s.navIcon}><Icon /></span>
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className={s.safety}>
          <div className={s.safetyRow}>
            <Badge appearance="tint" color={dryMode ? 'warning' : 'success'}>{dryMode ? 'Dry-run' : 'Live'}</Badge>
            <Text size={200}>{dryMode ? 'No firewall changes' : 'Rules require UAC'}</Text>
          </div>
          <Button appearance="subtle" size="small" icon={<Settings24Regular />} onClick={() => setShowHelp(true)}>Safety and help</Button>
          <div className={s.foot}>This PC · 127.0.0.1:8765</div>
        </div>
      </aside>

      <main className={s.main}>
        <header className={s.command}>
          {connectionLost && <Badge appearance="outline" color="danger">API unreachable</Badge>}
          <span className={s.dryWrap}>
            <Text size={200}>Dry-run</Text>
            <Switch checked={dryMode} onChange={(_, d) => { if (!d.checked && !window.confirm('Enable live firewall enforcement? Future apply actions change Windows Defender Firewall after UAC approval.')) return; void setDryMode(d.checked); }} />
          </span>
          <Tooltip content="Refresh" relationship="label">
            <Button appearance="subtle" icon={<ArrowSync24Regular />} aria-label="Refresh" onClick={() => { void qc.invalidateQueries(); }} />
          </Tooltip>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Tooltip content="Theme" relationship="label">
                <Button appearance="subtle" aria-label="Theme" icon={themeCtl.mode === 'dark' ? <WeatherMoon24Regular /> : themeCtl.mode === 'light' ? <WeatherSunny24Regular /> : <WeatherPartlyCloudyDay24Regular />} />
              </Tooltip>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {(['system', 'light', 'dark'] as ThemeMode[]).map(m => (
                  <MenuItem key={m} icon={themeCtl.mode === m ? <Checkmark24Regular /> : undefined} onClick={() => themeCtl.setMode(m)}>{THEME_LABEL[m]}</MenuItem>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
        </header>

        <div className={s.content}>
        {connectionLost && (
          <MessageBar intent="error">
            <MessageBarBody>Cannot reach the local API at 127.0.0.1:8765. Start the app with Start Firewall Guard.bat. Values update once it responds.</MessageBarBody>
          </MessageBar>
        )}
        {dryMode === null && !overview.isError && <Spinner size="tiny" label="Restoring enforcement state…" />}

        {page === 'overview' && <OverviewPage dry={dryMode} onDryToggle={v => void setDryMode(v)} onNavigate={id => setPage(id as PageId)} />}
        {page === 'processes' && <ProcessesPage />}
        {page === 'connections' && <ConnectionsPage />}
        {page === 'traffic' && <TrafficPage />}
        {page === 'monitor' && <MonitorPage />}
        {page === 'memory' && <MemoryPage />}
        {page === 'gpu' && <GpuPage />}
        {page === 'disk' && <DiskPage />}
        {page === 'events' && <EventsPage />}
        {page === 'policies' && <PoliciesPage />}
        {page === 'rules' && <RulesPage />}
        </div>
      </main>

      <BlockDialog
        items={blockItems ?? []}
        dry={dryMode}
        onOpenChange={open => { if (!open) setBlockItems(null); }}
        onDone={r => {
          if (r.status === 'dry_run') toast('warning', `Dry-run: ${r.success} intent(s) logged`, 'No firewall rules were changed.');
          else if (r.success === r.total) toast('success', `Created ${r.success} block rule(s)`, 'Verified with Get-NetFirewallRule.');
          else toast('warning', `${r.success}/${r.total} block rules applied`, 'Some targets failed — review the dialog for per-item errors.');
          void qc.invalidateQueries();
        }}
      />
      <RemoveDialog
        rules={unblockRules ?? []}
        dry={dryMode}
        onOpenChange={open => { if (!open) setUnblockRules(null); }}
        onDone={r => {
          if (r.success === r.total) toast('success', `Removed ${r.success} rule(s)`, 'Verified with Get-NetFirewallRule.');
          else toast('warning', `${r.success}/${r.total} rule removals applied`, 'Some removals failed — review the dialog.');
          void qc.invalidateQueries();
        }}
      />

      <Dialog open={showHelp} onOpenChange={(_, d) => setShowHelp(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Safety, access & troubleshooting</DialogTitle>
            <DialogContent>
              <div style={{ fontSize: 13, color: tokens.colorNeutralForeground2, lineHeight: 1.65 }}>
                <p><b>Dry-run:</b> records your intent only; it does not block traffic. Toggle from here or the Overview hero.</p>
                <p><b>Live blocking:</b> switch off Dry-run, then approve the Windows UAC prompt when applying rules.</p>
                <p><b>Bulk actions:</b> select multiple rows anywhere — one batched apply, one UAC prompt, per-item results.</p>
                <p><b>Service rules:</b> use the Windows service short name. Some services share a host process; check dependencies first.</p>
                <p><b>Unblock:</b> open Managed rules, select and remove app-owned (FGF-) rules; Other firewall rules may still apply.</p>
                <p><b>Investigation:</b> combine processes, connections, I/O rates and event-log entries. This app does not decrypt traffic or prove what data was sent.</p>
              </div>
            </DialogContent>
            <DialogActions><Button appearance="primary" onClick={() => setShowHelp(false)}>Got it</Button></DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Toaster toasterId="console-toasts" position="bottom-end" />
    </div>
    </AppCtx.Provider>
  );
}
