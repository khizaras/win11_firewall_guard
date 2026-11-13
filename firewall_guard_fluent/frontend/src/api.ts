const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8765';
const TOKEN = import.meta.env.VITE_API_TOKEN || 'dev-token-change-me';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...init.headers },
  });
  if (!r.ok) {
    let m = `Request failed: ${r.status}`;
    try {
      const j = await r.json();
      if (j?.detail) m = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    } catch { /* keep default message */ }
    throw new Error(m);
  }
  return r.json() as Promise<T>;
}

/* ---------- shared target types ---------- */
export type RuleTarget = {
  direction: 'Inbound' | 'Outbound';
  protocol: 'ANY' | 'TCP' | 'UDP';
  remote_ip?: string | null;
  remote_port?: number | null;
  program_path?: string | null;
  service_name?: string | null;
};

/* ---------- telemetry list types ---------- */
export type Proc = {
  pid: number; process: string; program_path: string; username: string; status: string;
  services: string[]; cpu_percent?: number; memory_bytes?: number; memory_percent?: number;
  cmdline?: string[]; ppid?: number; parent_name?: string; threads?: number;
  create_time?: number; cpu_time_seconds?: number; nice?: number | null;
  io_read_bytes_total?: number; io_write_bytes_total?: number;
  io_read_bytes_per_sec?: number; io_write_bytes_per_sec?: number;
};
export type Service = {
  name: string; display_name: string; status: string; pid: number; start_type: string;
  username: string; binpath: string; description?: string; install_date?: string;
};
export type Conn = {
  pid: number; process: string; program_path: string; username: string; services: string[];
  protocol: string; family?: string; local_address: string; remote_ip: string; remote_port: number;
  remote_address: string; state: string; listener?: boolean;
};
export type DiskInfo = { device: string; mountpoint: string; filesystem: string; total_bytes: number; used_bytes: number; free_bytes: number; percent: number };
export type TopProc = { pid: number; process: string; cpu_percent: number; memory_bytes: number; read_bytes_per_sec: number; write_bytes_per_sec: number; read_bytes_total: number; write_bytes_total: number };
export type Metrics = {
  sampled_at: number; boot_time: number; cpu_percent: number; cpu_per_core_percent?: number[];
  cpu_count_logical: number; memory_total_bytes: number; memory_available_bytes: number; memory_used_bytes?: number;
  memory_percent: number; swap_total_bytes?: number; swap_used_bytes?: number; swap_percent?: number;
  net_sent_bytes_per_sec: number; net_recv_bytes_per_sec: number; net_sent_total_bytes?: number; net_recv_total_bytes?: number;
  disk_read_bytes_per_sec: number; disk_write_bytes_per_sec: number;
  disk_busy_percent?: Record<string, number>; disks: DiskInfo[];
  top_cpu: TopProc[]; top_disk: TopProc[];
};
export type FirewallProfile = { profile: string; enabled: string; default_inbound_action: string; default_outbound_action: string; notify: string };
export type Overview = { process_count: number; connection_count: number; enabled_policies: number; managed_rules: number; dry_run: boolean; profiles?: FirewallProfile[] };
export type ManagedRule = { created: string; policy_id: string; name: string; target: string; status: string };
export type LiveRule = {
  name: string; group: string; enabled: string; action: string; direction: string; profile: string;
  program: string; service: string; remote_ports: string; local_ports: string; protocol: string; remote_addresses: string;
};
export type Event = {
  time: string; event_id: string; provider: string; level: string; message: string;
  direction?: string; src_ip?: string; dst_ip?: string; src_port?: number; dst_port?: number; app?: string;
};
export type Activity = { time: string; category: string; summary: string; details: string };
export type Policy = { id: string; name?: string; enabled: boolean; automatic?: boolean; direction?: string; protocol?: string; process_name_patterns?: string[]; service_name_patterns?: string[]; program_paths?: string[]; remote_ips?: string[]; remote_ports?: number[] };

/* ---------- traffic inspector types ---------- */
export type TrafficRow = {
  kind: 'conn' | 'event';
  id: string;
  time: string;
  verdict: 'permitted' | 'blocked' | 'live' | 'rule-event';
  direction: '' | 'inbound' | 'outbound';
  event_id: string;
  pid: number;
  process: string;
  app: string;
  program_path?: string;
  local_address: string;
  remote_ip: string;
  remote_port: number;
  remote_address: string;
  state: string;
  protocol: string;
  hostname: string;
  services: string[];
  message: string;
};
export type AuditState = { subcategory: string; state: string };
export type TrafficResponse = {
  count: number;
  rows: TrafficRow[];
  audit: AuditState[];
  broker: { alive: boolean; info?: { pid: number; age: number; started: string } };
  capture: { on: boolean };
};
export type DomainPattern = { id: number; pattern: string; enabled: boolean; created: string; last_applied?: string; resolved?: { domains?: string[]; ips?: string[]; active_rules?: number; add_n?: number; remove_n?: number } };
export type DomainStatus = { add_n: number; remove_n: number; per_pattern: Record<string, { domains?: string[]; ips?: string[]; active_rules?: number; add_n?: number; remove_n?: number }>; broker_alive: boolean; dry_run: boolean };
export type CaptureFlow = { pid: number; process: string; direction: string; remote_ip: string; remote_port: number; bytes_total: number; bytes_per_sec: number };
export type CaptureState = { on: boolean; flows: CaptureFlow[]; rates_computed: boolean; broker_alive: boolean };
export type BrokerStatus = { alive: boolean; info?: { pid: number; age: number; started: string }; queue_pending: number };

/* ---------- detail + mutation result types ---------- */
export type ProcDetail = {
  pid?: number; path?: string; company?: string; description?: string; window_title?: string;
  start_time?: string; responding?: boolean; signature_status?: string; signature_signer?: string;
  version_info?: { ProductName?: string; FileVersion?: string; FileDescription?: string; CompanyName?: string };
  error?: string; unsupported?: boolean;
};
export type BatchResultItem = { name?: string; target?: RuleTarget; status: string; verified?: boolean; error?: string };
export type RuleResult = { status: string; name?: string; target?: RuleTarget; verified?: boolean };

export const api = {
  overview: () => request<Overview>('/api/overview'),
  processes: () => request<Proc[]>('/api/processes'),
  processDetail: (pid: number) => request<ProcDetail>(`/api/processes/${pid}`),
  services: () => request<Service[]>('/api/services'),
  metrics: () => request<Metrics>('/api/metrics'),
  connections: (showListeners = false) => request<Conn[]>(`/api/connections?show_listeners=${showListeners}`),
  policies: () => request<Policy[]>('/api/policies'),
  managedRules: () => request<ManagedRule[]>('/api/rules'),
  activity: () => request<Activity[]>('/api/activity'),
  events: () => request<Event[]>('/api/events?limit=200'),
  firewallProfiles: () => request<FirewallProfile[]>('/api/firewall/profiles'),
  firewallRules: (action: 'all' | 'block' | 'allow') => request<LiveRule[]>(`/api/firewall/rules?enabled_only=True&action=${action}&limit=600`),
  traffic: (includeListeners = false) => request<TrafficResponse>(`/api/traffic?include_listeners=${includeListeners}`),
  brokerStatus: () => request<BrokerStatus>('/api/broker/status'),
  brokerStart: () => request<{ status: string; info?: BrokerStatus['info']; hint?: string }>('/api/broker/start', { method: 'POST', body: '{}' }),
  auditEnable: () => request<{ status: string; audit: AuditState[] }>('/api/audit/enable', { method: 'POST', body: '{}' }),
  domainPatterns: () => request<{ patterns: DomainPattern[]; active_rules_count: number; per_pattern: Record<string, DomainPattern['resolved']> }>('/api/domain-patterns'),
  addDomainPattern: (pattern: string) => request<{ status: string }>('/api/domain-patterns', { method: 'POST', body: JSON.stringify({ pattern }) }),
  deleteDomainPattern: (id: number) => request<{ status: string }>(`/api/domain-patterns/${id}`, { method: 'DELETE' }),
  setDomainPatternEnabled: (id: number, enabled: boolean) => request<{ status: string }>(`/api/domain-patterns/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  domainPatternStatus: () => request<DomainStatus>('/api/domain-patterns/status'),
  applyDomainPatterns: () => request<DomainStatus & { status: string }>('/api/domain-patterns/apply', { method: 'POST', body: '{}' }),
  captureToggle: (on: boolean) => request<{ status: string; on: boolean }>('/api/capture/start', { method: 'POST', body: JSON.stringify({ on }) }),
  captureState: () => request<CaptureState>('/api/capture/state'),
  createRule: (target: RuleTarget) => request<RuleResult>('/api/rules', { method: 'POST', body: JSON.stringify({ target }) }),
  createBatch: (targets: RuleTarget[], policy = 'manual') =>
    request<{ dry_run?: boolean; success?: number; items?: BatchResultItem[]; error?: string }>('/api/rules/batch', { method: 'POST', body: JSON.stringify({ targets, policy }) }),
  deleteBatch: (names: string[]) =>
    request<{ success?: number; items?: BatchResultItem[]; error?: string }>('/api/rules/delete-batch', { method: 'POST', body: JSON.stringify({ names }) }),
  remove: (name: string) => request<RuleResult>(`/api/rules/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  dry: (enabled: boolean) => request<{ dry_run: boolean; live_enforcement: boolean }>('/api/dry-run', { method: 'POST', body: JSON.stringify({ enabled }) }),
};
