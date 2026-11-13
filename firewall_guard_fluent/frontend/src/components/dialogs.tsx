import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Dropdown, MessageBar, MessageBarBody, Text,
  makeStyles, tokens,
} from '@fluentui/react-components';
import { LockClosed24Regular } from '@fluentui/react-icons';
import { api, type BatchResultItem, type RuleTarget } from '../api';

const useStyles = makeStyles({
  targetList: { display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflow: 'auto', marginTop: '10px', marginBottom: '4px' },
  targetRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: tokens.borderRadiusMedium, background: tokens.colorNeutralBackground3 },
  targetMain: { minWidth: 0, flex: 1 },
  label: { fontWeight: tokens.fontWeightSemibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sub: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100, fontFamily: 'Consolas, "Cascadia Code", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  selects: { display: 'flex', gap: '12px', margin: '12px 0 4px' },
  resultsBox: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', maxHeight: '280px', overflow: 'auto' },
  resultLine: { fontSize: tokens.fontSizeBase200 },
  pickerLabel: { fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3, marginBottom: '2px' },
});

const RESULT_TONES: Record<string, 'success' | 'warning' | 'subtle' | 'brand'> = {
  created_verified: 'success',
  removed_verified: 'success',
  dry_run: 'warning',
  invalid: 'subtle',
};

function ResultsList({ items }: { items: BatchResultItem[] }) {
  const s = useStyles();
  return (
    <div className={s.resultsBox}>
      {items.map((it, i) => (
        <div key={i} className={s.resultLine}>
          <Badge appearance="filled" color={RESULT_TONES[it.status] ?? 'subtle'}>{it.status}</Badge>{' '}
          <span className={s.label}>{it.target ? targetLabel(it.target) : it.name || `${i + 1} · target`}</span>
          {it.error && <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>· {it.error}</Text>}
        </div>
      ))}
    </div>
  );
}

export function targetLabel(t: Partial<RuleTarget>): string {
  if (t.program_path) return t.program_path;
  if (t.service_name) return `service ${t.service_name}`;
  if (t.remote_ip) return String(t.remote_ip);
  return 'unscoped target';
}

function PickerRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const s = useStyles();
  return (
    <div>
      <div className={s.pickerLabel}>{label}</div>
      <Dropdown
        value={value}
        selectedOptions={[value]}
        onOptionSelect={(_, d) => onChange(String(d.optionText))}
      >
        {options.map(o => <option key={o}>{o}</option>)}
      </Dropdown>
    </div>
  );
}

export type BlockDialogProps = {
  items: { kind: 'app' | 'service' | 'ip'; label: string; sub?: string; detail?: Partial<RuleTarget> }[];
  dry: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: { status: string; success: number; total: number }) => void;
};

export function BlockDialog({ items, dry, onOpenChange, onDone }: BlockDialogProps) {
  const s = useStyles();
  const [direction, setDirection] = useState('Outbound');
  const [protocol, setProtocol] = useState('Any');
  const [results, setResults] = useState<BatchResultItem[] | null>(null);

  const targets = useMemo<RuleTarget[]>(
    () => items.map(i => ({
      direction: direction === 'Inbound' ? 'Inbound' : 'Outbound',
      protocol: protocol === 'TCP' ? 'TCP' : protocol === 'UDP' ? 'UDP' : 'ANY',
      program_path: i.kind === 'app' ? i.detail?.program_path ?? null : null,
      service_name: i.kind === 'service' ? i.detail?.service_name ?? null : null,
      remote_ip: i.kind === 'ip' ? i.detail?.remote_ip ?? null : null,
      remote_port: null as number | null,
    })),
    [items, direction, protocol],
  );

  const mutation = useMutation({
    mutationFn: (t: RuleTarget[]) => api.createBatch(t),
    onSuccess: r => {
      const list = r.items ?? [];
      setResults(list);
      const ok = list.filter(x => x.status === 'created_verified').length + list.filter(x => x.status === 'dry_run').length;
      onDone({ status: r.dry_run ? 'dry_run' : 'created_verified', success: ok, total: list.length });
    },
  });

  const close = () => { setResults(null); mutation.reset(); onOpenChange(false); };
  const grouped = (kind: 'app' | 'service' | 'ip') => items.filter(i => i.kind === kind);

  return (
    <Dialog open={items.length > 0} onOpenChange={(_, d) => { if (!d.open) close(); }}>
      <DialogSurface style={{ maxWidth: 640 }}>
        <DialogBody>
          <DialogTitle>Block outbound traffic ({items.length})</DialogTitle>
          <DialogContent>
            <Text size={200}>
              Windows Firewall rules are scoped independently per target. Each selected item becomes its own block rule
              {dry ? ' — dry-run only records intent.' : ' and is applied after administrator approval.'}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {([['app', 'Applications'], ['service', 'Services'], ['ip', 'IP addresses']] as const).map(([kind, header]) => {
                const g = grouped(kind);
                if (!g.length) return null;
                return (
                  <div key={kind}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{header} ({g.length})</div>
                    <div className={s.targetList}>
                      {g.map((i, idx) => (
                        <div key={idx} className={s.targetRow}>
                          <div className={s.targetMain}>
                            <div className={s.label}>{i.label}</div>
                            {i.sub && <div className={s.sub}>{kind === 'app' ? i.detail?.program_path : kind === 'service' ? i.detail?.service_name : i.detail?.remote_ip}</div>}
                          </div>
                          <Badge appearance="outline">{kind}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={s.selects}>
              <PickerRow label="Direction" value={direction} options={['Outbound', 'Inbound']} onChange={setDirection} />
              <PickerRow label="Protocol" value={protocol} options={['Any', 'TCP', 'UDP']} onChange={setProtocol} />
            </div>
            <MessageBar intent={dry ? 'warning' : 'info'}>
              <MessageBarBody>{dry ? 'Dry-run is active: intent is recorded, nothing is blocked.' : 'Live mode changes Windows Defender Firewall after UAC approval.'}</MessageBarBody>
            </MessageBar>
            {mutation.isError && <DynamicError error={String(mutation.error)} />}
            {results != null && <ResultsList items={results} />}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={close}>{results ? 'Close' : 'Cancel'}</Button>
            <Button
              appearance="primary"
              icon={<LockClosed24Regular />}
              disabled={mutation.isPending || results != null}
              onClick={() => mutation.mutate(targets)}
            >
              {mutation.isPending ? 'Applying…' : dry ? `Log dry-run for ${items.length} rule${items.length === 1 ? '' : 's'}` : `Apply ${items.length} block rule${items.length === 1 ? '' : 's'}`}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function DynamicError({ error }: { error: string }) {
  return <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>;
}

type RemoveDialogProps = {
  rules: { name: string; label: string; sub?: string }[];
  dry: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: { success: number; total: number }) => void;
};

export function RemoveDialog({ rules, dry, onOpenChange, onDone }: RemoveDialogProps) {
  const s = useStyles();
  const [results, setResults] = useState<BatchResultItem[] | null>(null);
  const mutation = useMutation({
    mutationFn: (names: string[]) => api.deleteBatch(names),
    onSuccess: r => {
      setResults(r.items ?? []);
      onDone({ success: r.success ?? 0, total: (r.items ?? []).length });
    },
  });
  const close = () => { setResults(null); mutation.reset(); onOpenChange(false); };

  return (
    <Dialog open={rules.length > 0} onOpenChange={(_, d) => { if (!d.open) close(); }}>
      <DialogSurface style={{ maxWidth: 620 }}>
        <DialogBody>
          <DialogTitle>Unblock / remove rules ({rules.length})</DialogTitle>
          <DialogContent>
            <Text size={200}>Only rules owned by this app (FGF‑ prefixed) can be removed.</Text>
            <div className={s.targetList}>
              {rules.map(r => (
                <div key={r.name} className={s.targetRow}>
                  <div className={s.targetMain}>
                    <div className={s.label}>{r.label}</div>
                    {r.sub && <div className={s.sub}>{r.sub}</div>}
                  </div>
                </div>
              ))}
            </div>
            {mutation.isError && <MessageBar intent="error"><MessageBarBody>{String(mutation.error)}</MessageBarBody></MessageBar>}
            {results != null && <ResultsList items={results} />}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={close}>{results ? 'Close' : 'Cancel'}</Button>
            <Button appearance="primary" disabled={mutation.isPending || results != null} onClick={() => mutation.mutate(rules.map(r => r.name))}>
              {mutation.isPending ? 'Removing…' : dry ? `Log dry-run removal (${rules.length})` : `Remove ${rules.length} rule${rules.length === 1 ? '' : 's'}`}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

