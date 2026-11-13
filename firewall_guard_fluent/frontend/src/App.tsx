import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Menu, MenuPopover, MenuTrigger, MenuList, MenuItem, MessageBar, MessageBarBody,
  Spinner, Switch, Tab, TabList, Text, Tooltip, Toaster, makeStyles, tokens, useToastController,
} from '@fluentui/react-components';
import {
  ArrowSync24Regular, Checkmark24Regular, Home24Regular, Desktop24Regular, Globe24Regular, DataUsage24Regular,
  ShieldTask24Regular, History24Regular, ShieldCheckmark24Regular, Settings24Regular, ArrowSwap24Regular,
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
import { EventsPage } from './pages/EventsPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { RulesPage } from './pages/RulesPage';
import { useTheme, type ThemeMode } from './theme';

type PageId = 'overview' | 'processes' | 'connections' | 'traffic' | 'monitor' | 'events' | 'policies' | 'rules';
const NAV: [PageId, string, React.FC][] = [
  ['overview', 'Overview', Home24Regular],
  ['processes', 'Processes & services', Desktop24Regular],
  ['connections', 'Network connections', Globe24Regular],
  ['traffic', 'Traffic inspector', ArrowSwap24Regular],
  ['monitor', 'System monitor', DataUsage24Regular],
  ['events', 'Firewall events', History24Regular],
  ['policies', 'Policy center', ShieldTask24Regular],
  ['rules', 'Managed rules', ShieldCheckmark24Regular],
];

const useStyles = makeStyles({
  shell: { display: 'grid', gridTemplateColumns: '270px minmax(0, 1fr)', minHeight: '100vh', background: tokens.colorNeutralBackground2 },
  sidebar: { position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalS}`, background: tokens.colorNeutralBackground1, borderRight: `1px solid ${tokens.colorNeutralStroke2}`, overflowY: 'auto' },
  brand: { display: 'flex', alignItems: 'center', gap: '12px', padding: `${tokens.spacingVerticalXS} 10px` },
  logo: { width: '42px', height: '42px', display: 'grid', placeItems: 'center', background: tokens.colorBrandBackground, color: tokens.colorNeutralForegroundOnBrand, borderRadius: tokens.borderRadiusXLarge },
  brandSub: { fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3, letterSpacing: '0.14em' },
  navTabs: { display: 'flex', flexDirection: 'column', alignItems: 'stretch' },
  navTab: { justifyContent: 'flex-start', alignItems: 'center' },
  safety: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: tokens.spacingVerticalM, background: tokens.colorNeutralBackground3, borderRadius: tokens.borderRadiusLarge, border: `1px solid ${tokens.colorNeutralStroke2}` },
  safetyHeading: { display: 'flex', alignItems: 'center', gap: '8px' },
  foot: { fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3, padding: '0 8px' },
  main: { minWidth: 0, padding: `${tokens.spacingVerticalL} clamp(18px, 3vw, 42px) 44px`, maxWidth: '1800px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', paddingBottom: tokens.spacingVerticalM, borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  topActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  dryWrap: { display: 'flex', alignItems: 'center', gap: '8px' },
  connectionBanner: { marginBottom: 0 },
});

const PAGE_LABEL: Record<PageId, string> = Object.fromEntries(NAV.map(([id, label]) => [id, label])) as Record<PageId, string>;
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
          <div className={s.logo}><ShieldCheckmark24Regular /></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text weight="bold" size={400}>Firewall Guard</Text>
            <span className={s.brandSub}>SECURITY CONSOLE</span>
          </div>
        </div>
        <div className={s.navTabs}>
          <TabList vertical selectedValue={page} onTabSelect={(_, d) => setPage(d.value as PageId)} aria-label="Console navigation">
            {NAV.map(([id, label, Icon]) => (
              <Tab key={id} className={s.navTab} value={id} icon={<Icon />}>{label}</Tab>
            ))}
          </TabList>
        </div>
        <div className={s.safety}>
          <div className={s.safetyHeading}>
            <Text weight="semibold">Enforcement</Text>
            <Badge appearance="filled" color={dryMode ? 'warning' : 'success'}>{dryMode ? 'DRY RUN' : 'LIVE'}</Badge>
          </div>
          <Text size={100} style={{ color: tokens.colorNeutralForeground2 }}>
            Outbound block rules are created through Windows Defender Firewall. Live changes require UAC approval.
          </Text>
          <Button appearance="subtle" size="small" icon={<Settings24Regular />} onClick={() => setShowHelp(true)}>Safety & help</Button>
        </div>
        <div className={s.foot}>Local-only console · 127.0.0.1 : 8765</div>
      </aside>

      <main className={s.main}>
        <header className={s.topbar}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Text size={100} weight="semibold" style={{ color: tokens.colorNeutralForeground3, letterSpacing: '0.1em' }}>SECURITY CENTER / {(PAGE_LABEL[page] || page).toUpperCase()}</Text>
            <Text size={600} weight="semibold">{PAGE_LABEL[page] || page}</Text>
          </div>
          <div className={s.topActions}>
            {connectionLost && <Badge appearance="outline" color="danger">API unreachable</Badge>}
            <span className={s.dryWrap}>
              <Text size={200}>{dryMode ? 'Dry-run' : 'Live changes'}</Text>
              <Switch checked={dryMode} onChange={(_, d) => { if (!d.checked && !window.confirm('Enable live firewall enforcement? Future apply actions change Windows Defender Firewall after UAC approval.')) return; void setDryMode(d.checked); }} />
            </span>
            <Tooltip content="Refresh everything" relationship="label">
              <Button appearance="secondary" icon={<ArrowSync24Regular />} aria-label="Refresh" onClick={() => { void qc.invalidateQueries(); }} />
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
          </div>
        </header>

        {connectionLost && (
          <MessageBar intent="error" className={s.connectionBanner}>
            <MessageBarBody>Cannot reach the local API at 127.0.0.1:8765. Start the app with "Start Firewall Guard.bat" (or scripts\start.bat) — values will update once it responds.</MessageBarBody>
          </MessageBar>
        )}
        {dryMode === null && !overview.isError && <Spinner size="tiny" label="Restoring enforcement state…" />}

        {page === 'overview' && <OverviewPage dry={dryMode} onDryToggle={v => void setDryMode(v)} onNavigate={id => setPage(id as PageId)} />}
        {page === 'processes' && <ProcessesPage />}
        {page === 'connections' && <ConnectionsPage />}
        {page === 'traffic' && <TrafficPage />}
        {page === 'monitor' && <MonitorPage />}
        {page === 'events' && <EventsPage />}
        {page === 'policies' && <PoliciesPage />}
        {page === 'rules' && <RulesPage />}
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
