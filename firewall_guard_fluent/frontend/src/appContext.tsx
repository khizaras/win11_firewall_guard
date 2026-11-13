import { createContext, useContext, type ReactNode } from 'react';
import type { RuleTarget } from './api';

export type BlockKind = 'app' | 'service' | 'ip';
export type BlockRequest = { kind: BlockKind; label: string; sub?: string; detail?: Partial<RuleTarget> };
export type UnblockRequest = { name: string; label: string; sub?: string };

export type AppCtxValue = {
  dry: boolean;
  requestBlock: (items: BlockRequest[]) => void;
  requestUnblock: (rules: UnblockRequest[]) => void;
  toast: (kind: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
};

export const AppCtx = createContext<AppCtxValue | null>(null);

export function useApp(): AppCtxValue {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('AppCtx is expected to be provided by App');
  return ctx;
}

export function AppCtxProvider({ value, children }: { value: AppCtxValue; children: ReactNode }) {
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
