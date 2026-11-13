import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button, Drawer, DrawerBody, DrawerHeader, DrawerHeaderTitle, Spinner, Text, makeStyles, tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { api, type ProcDetail } from '../api';
import { PathCell } from './ui';

const useStyles = makeStyles({
  row: { display: 'flex', flexDirection: 'column', gap: '2px', padding: '9px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  key: { color: tokens.colorNeutralForeground2, fontSize: '12px', lineHeight: '16px' },
  val: { fontSize: tokens.fontSizeBase300, overflowWrap: 'anywhere', lineHeight: '1.4' },
  note: { marginTop: '12px', color: tokens.colorNeutralForeground3 },
});

export type DetailItem = { label: string; value?: React.ReactNode };

function show(value: React.ReactNode) {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'string' && (value.trim() === '' || value === '—')) return false;
  return true;
}

export function DetailDrawer({
  title,
  subtitle,
  items,
  pid,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  items: DetailItem[];
  pid?: number;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const s = useStyles();
  const detail = useQuery({
    queryKey: ['processDetail', pid],
    queryFn: () => api.processDetail(pid || 0),
    enabled: !!pid && pid > 0,
    gcTime: 60_000,
  });
  const d: ProcDetail | undefined = detail.data;

  return (
    <Drawer open type="overlay" position="end" onOpenChange={(_, data) => { if (!data.open) onClose(); }} style={{ minWidth: 420, maxWidth: 560 }}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          {title}
          {subtitle && <Text size={200} style={{ display: 'block', color: tokens.colorNeutralForeground3, fontWeight: 400 }}>{subtitle}</Text>}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        {items.filter(item => show(item.value)).map(item => (
          <div className={s.row} key={item.label}>
            <span className={s.key}>{item.label}</span>
            <span className={s.val}>{item.value}</span>
          </div>
        ))}
        {!!pid && pid > 0 && detail.isLoading && <Spinner size="tiny" label="Collecting file details…" />}
        {d && !d.error && (
          <>
            <Field label="Description" value={d.description || d.version_info?.FileDescription} />
            <Field label="Company" value={d.company || d.version_info?.CompanyName} />
            <Field label="Product" value={d.version_info?.ProductName} />
            <Field label="File version" value={d.version_info?.FileVersion} />
            <Field label="Signature" value={d.signature_status ? `${d.signature_status}${d.signature_signer ? ` · ${d.signature_signer}` : ''}` : undefined} />
            <Field label="Window title" value={d.window_title} />
            <Field label="Image path" value={d.path ? <PathCell value={d.path} /> : undefined} />
          </>
        )}
        {children}
        {!!pid && pid > 0 && <Text size={100} className={s.note}>Signature and company come from the file on disk.</Text>}
      </DrawerBody>
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const s = useStyles();
  if (!show(value)) return null;
  return (
    <div className={s.row}>
      <span className={s.key}>{label}</span>
      <span className={s.val}>{value}</span>
    </div>
  );
}
