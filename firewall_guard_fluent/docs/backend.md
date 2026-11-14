# Firewall Guard Fluent — Backend and Operations Review

**Workspace:** `c:\develop\win11_firewall_guard\firewall_guard_fluent`  
Paths below are relative to that root unless shown otherwise.

**Review method:** Read-only inspection of backend, frontend consumers, configuration, startup scripts, tests, documentation, website, and selected logs. **No files were modified, no services were started/stopped, and no tests were executed.**

## 1. Executive assessment

This is a substantial local Windows utility, not merely a scaffold. It has real implementations for:

- Process, service, socket, CPU, memory, disk, network, and GPU telemetry.
- Windows Firewall inventory and profile queries.
- Manual app/service/IP block-rule creation using elevated PowerShell.
- SQLite-backed managed-rule history, domain patterns, and activity records.
- Windows event-log querying, DNS enrichment, an elevated file-queue broker, and optional ETW capture.

However, several core workflows are incomplete or unsafe:

1. **The current on-disk configuration has live enforcement enabled**: `backend/config/settings.json:4` contains `"dry_run": false`, contrary to the unconditional “dry-run is enabled by default” documentation.
2. **Dry-run does not protect rule deletion.** Both single and batch deletion can change Windows Firewall while dry-run is on.
3. **Successful batch deletion then fails in Python** because `remove_rules_batch()` returns an undefined `items` variable. Rules may already have been removed while the API reports failure and SQLite remains stale.
4. There are **authenticated PowerShell injection paths** in event `since` handling and domain-name resolution.
5. The elevated broker executes queue-supplied commands with `Invoke-Expression`, creating a serious local privilege-escalation boundary if an unelevated process can write to the queue.
6. Domain-rule lifecycle, byte capture, event attribution, and parts of the UI are only partially functional.
7. Automatic policy enforcement is explicitly **not implemented**; the policy matcher is test/helper code rather than a running enforcement engine.

The product should currently be treated as an **experimental local development tool**, consistent with the README’s own warning, not as a hardened security control.

---

## 2. Architecture and data flow

### Components

```text
React 18 + Fluent UI v9 + TanStack Query
                |
                | HTTP/JSON, Bearer token, polling
                v
       FastAPI / Uvicorn on 127.0.0.1:8765
                |
       +--------+----------+-------------+
       |                   |             |
     psutil          PowerShell       sqlite3
  process/system     firewall, DNS,   local rules,
  telemetry          events, GPU,     activity and
                     signatures       domain patterns
                             |
                    Start-Process -Verb RunAs
                             |
                 Elevated firewall/audit/ETW actions
                             |
             Optional persistent fgf-broker.ps1
               file queue + heartbeat + ack files
```

### Main implementation files

| Area | File and key symbols |
|---|---|
| API composition and configuration | `backend/app/main.py`: `app`, `CFG`, `DB`, `auth()`, `_domain_refresh_loop()` |
| Firewall mutation | `backend/app/firewall.py`: `validate_target()`, `rule_command()`, `elevated()`, `create_rule()`, `create_rules_batch()`, `remove_rule()`, `remove_rules_batch()`, `inspect_rule()` |
| Process/system/socket telemetry | `backend/app/monitor.py`: `processes()`, `services()`, `connections()`, `metrics()` |
| Resource monitoring and termination | `backend/app/resources.py`: `memory_snapshot()`, `disk_snapshot()`, `gpu_snapshot()`, `terminate_process()` |
| PowerShell enrichment | `backend/app/enrich.py`: `process_detail()`, `firewall_profiles()`, `firewall_rules()`, `dns_cache()`, `resolve_names()`, `kernel_net_rows()` |
| Traffic/events/domain logic | `backend/app/traffic.py`: `query_events()`, `traffic_rows()`, `capture_state()`, `domain_plan()`, `apply_domain_plan()` |
| Persistence | `backend/app/store.py`: `Store` |
| Elevated broker client | `backend/app/broker.py`: `broker_alive()`, `write_command()` |
| Elevated worker | `scripts/fgf-broker.ps1` |
| Policy helper, not a running engine | `backend/app/policy.py`: `validate_policy()`, `matches()` |
| Browser API client | `frontend/src/api.ts`: `request()`, `api` |
| Browser shell and shared mutations | `frontend/src/App.tsx`, `frontend/src/components/dialogs.tsx` |

### Request and mutation flow

- Telemetry is pulled through TanStack Query at fixed intervals; there is **no WebSocket, SSE, or push event stream**.
- Process/socket/system reads primarily use `psutil`.
- Firewall profiles/rules, signatures, DNS, Security event logs, and GPU counters use synchronous PowerShell subprocesses.
- Manual block creation goes through `BlockDialog` → `POST /api/rules/batch` → validation → either SQLite dry-run logging or one elevated encoded PowerShell process.
- Batch operations write a temporary JSON result file, then record results in SQLite.
- Domain auto-refresh is an `asyncio` task in the backend. It drives the elevated broker; **the broker does not independently resolve or refresh domains**.
- If `frontend/dist` exists, `backend/app/main.py:311-313` mounts it with `StaticFiles`. Otherwise the normal launcher uses Vite on port 5173.

---

## 3. Concise feature inventory

| Feature | Actual status |
|---|---|
| App, service, and remote-IP block rules | **Implemented** for Windows, with scoped validation and UAC elevation. Backend also supports ports and inbound rules, although the normal UI does not expose port entry. |
| Bulk block, up to 50 targets | **Implemented with caveats.** One elevated process is used, but command-size and verification issues remain. |
| Dry-run block creation | **Implemented.** Logs intent without creating rules. |
| Dry-run removal | **Not implemented safely.** UI offers dry-run removal, but backend deletion is live. |
| Single-rule removal | **Implemented**, restricted by `FGF-` name prefix; no dry-run check. |
| Batch-rule removal | **Broken.** Windows removal can succeed before Python raises `UnboundLocalError`. |
| Managed-rule persistence/activity history | **Implemented in SQLite**, but it is a ledger, not continuously reconciled Windows state. |
| Live firewall profiles and block-rule inventory | **Implemented through PowerShell.** UI inventory is capped at 600 rows, so not literally full on larger systems. |
| Process/service inventory and rich detail | **Implemented**, subject to Windows permissions and PowerShell availability. |
| Process termination | **Implemented without UAC elevation**, with a small critical-process denylist and confirmation UI. |
| TCP/UDP socket inventory | **Implemented**, but IPv6 normalization contains a destructive bug. |
| CPU/memory/network/disk monitoring | **Implemented** using sampled counters and browser-held chart history. |
| GPU monitoring | **Implemented with limitations** using optional `nvidia-smi` and Windows counters; per-app utilization parsing is flawed. |
| Firewall/WFP event display | **Implemented but approximate.** IPv4/English-oriented parsing and stubbed PID extraction reduce accuracy. |
| Traffic inspector | **Partial.** It merges current sockets and recent event-log records through polling, not a durable rolling live stream. |
| DNS hostnames | **Implemented** from the Windows DNS cache; no TLS inspection. |
| Wildcard domain blocking | **Partially implemented.** Resolution, apply, and five-minute backend refresh exist, but lifecycle and failure handling are unsafe. |
| Elevated persistent broker | **Implemented**, supporting firewall batches, audit enablement, and ETW control. Its queue trust model is high risk. |
| Packet-audit enablement | **Implemented**, but partial failures can still be reported as success. |
| Kernel-Network byte capture | **Backend experiment exists; normal UI path is effectively broken.** Capture flows are not rendered, initial state loading deadlocks, and direct-UAC ETL paths disagree. |
| Automatic configured-policy enforcement | **Not implemented.** `docs/POLICIES.md` and `PoliciesPage.tsx` correctly disclose this. |
| Fluent UI | **Real Fluent UI v9 components are used**, but tables are custom HTML tables, not Fluent `DataGrid`. |
| Themes | **Implemented:** system, light, and dark modes with localStorage persistence. |
| Website | **Standalone static product/illustration site.** It is not connected to live application data or the launcher. |

---

## 4. API map and frontend consumers

Except for `/api/health`, the listed API routes call `auth()` and require `Authorization: Bearer <token>`.

### Overview, configuration, and telemetry

| Endpoint | Implementation | Frontend consumer |
|---|---|---|
| `GET /api/health` | `main.py:36-37`; unauthenticated status/platform/dry-run | No consumer in `frontend/src/api.ts` |
| `GET /api/overview` | Process/socket counts, enabled policy count, DB managed-rule count, firewall profiles | `App.tsx`, `OverviewPage.tsx` |
| `GET /api/settings` | Dry-run and configured poll interval | No frontend consumer |
| `POST /api/dry-run` | Rewrites `settings.json` | Header and Overview switches |
| `GET /api/processes` | `monitor.processes()` | `ProcessesPage.tsx` |
| `GET /api/processes/{pid}` | Signature/company/version/window details | Process and shared detail drawers |
| `POST /api/processes/{pid}/terminate` | `resources.terminate_process()` | Memory/GPU/Disk pages |
| `GET /api/services` | Windows service inventory | `ProcessesPage.tsx` |
| `GET /api/connections` | TCP/UDP snapshots; listener/family parameters | `ConnectionsPage.tsx`; family parameter not exposed |
| `GET /api/metrics` | CPU, memory, network, disks, top processes | Overview and System monitor |
| `GET /api/resources/memory` | Working set and per-process memory | `MemoryPage` |
| `GET /api/resources/disk` | Volumes and per-process disk rates | `DiskPage` |
| `GET /api/resources/gpu` | NVIDIA/Windows GPU counters | `GpuPage` |

### Firewall, events, and policy

| Endpoint | Implementation | Frontend consumer |
|---|---|---|
| `GET /api/rules` | SQLite managed-rule ledger | Overview and `RulesPage.tsx` |
| `POST /api/rules` | Single rule creation | Wrapper exists as `api.createRule`, but normal UI uses batch creation |
| `POST /api/rules/batch` | Dry-run or elevated batch creation | `BlockDialog` |
| `DELETE /api/rules/{name}` | Elevated single removal | Managed-rule row action |
| `POST /api/rules/delete-batch` | Elevated batch removal | `RemoveDialog`; currently broken backend path |
| `GET /api/rules/{name}/verify` | Live `Get-NetFirewallRule` inspection | No frontend wrapper/consumer |
| `GET /api/firewall/profiles` | Direct profile query | Wrapper exists, but Overview uses embedded profiles instead |
| `GET /api/firewall/rules` | Enabled live rule inventory with filters | `RulesPage.tsx`, requesting block rules with `limit=600` |
| `GET /api/activity` | Last 200 SQLite activity records | Overview activity panel |
| `GET /api/events` | Firewall and Security event-log records | `EventsPage.tsx`; fixed `limit=200`, no `since` consumer |
| `GET /api/policies` | Reads `policies.json` | Read-only `PoliciesPage.tsx` |
| `GET /api/traffic` | Sockets plus recent WFP events, DNS/audit/broker state | `TrafficPage.tsx` |

### Broker, audit, domains, and capture

| Endpoint | Implementation | Frontend consumer |
|---|---|---|
| `GET /api/broker/status` | Heartbeat age and queue count | `TrafficPage.tsx` |
| `POST /api/broker/start` | UAC-launches `fgf-broker.ps1` | Traffic inspector |
| `POST /api/audit/enable` | Broker or direct elevated `auditpol` | Traffic inspector |
| `GET/POST /api/domain-patterns` | List/resolve or add patterns | Traffic domain panel |
| `DELETE/PATCH /api/domain-patterns/{pid}` | Delete or enable/disable pattern | Traffic domain panel |
| `GET /api/domain-patterns/status` | Pending add/remove diff | Traffic domain panel |
| `POST /api/domain-patterns/apply` | Dry-run, broker, or direct UAC application | Traffic domain panel |
| `POST /api/capture/start` | Starts or stops ETW despite route name | Capture switch |
| `GET /api/capture/state` | Parsed per-flow totals/rates | Queried by Traffic page, but flows are not displayed and initial query is disabled |

---

## 5. Persistence and configuration

### SQLite

`backend/app/store.py` creates three tables in `backend/data/firewall_guard.db`:

- `activity(id, ts, category, summary, details)`
- `rules(id, ts, policy_id, name UNIQUE, target, status)`
- `domain_patterns(id, pattern UNIQUE, enabled, created, last_applied)`

Characteristics:

- Uses standard-library `sqlite3`, WAL mode, and a fresh connection per operation.
- Rule targets are JSON text.
- Activity and rule history have no retention cleanup.
- There is no schema versioning or migration framework.
- `INSERT OR IGNORE` can conceal duplicate-rule situations.
- Windows state and SQLite are not reconciled at startup. External rule deletion or failed result processing can leave `"created"` records for nonexistent rules.
- Metrics, processes, sockets, and Windows events are **not persisted**; chart history is browser-memory-only.

### JSON and local files

- `backend/config/settings.json`: token, dry-run, DB path, host/port, poll interval.
- `backend/config/policies.json`: read-only policy catalog.
- `backend/data/broker/`: heartbeat, transient queue/ack files, and potentially capture data.
- `frontend/src/theme.tsx`: theme preference in browser localStorage.
- `frontend/.env`: API URL and token, compiled into browser JavaScript.

Configuration caveats:

- `host`, `port`, and `poll_interval_seconds` do not control the normal runtime. Startup scripts hardcode ports, frontend polling uses fixed intervals, and domain refresh is hardcoded to 300 seconds.
- Configuration read failures silently fall back to defaults.
- Dry-run settings writes are not atomic.
- `.gitignore` excludes only Python caches and `.venv`; it does **not** exclude frontend `.env`, SQLite databases, logs, `node_modules`, or `dist`.

---

## 6. Background jobs, startup, shutdown, and logging

### Background work

`backend/app/main.py:296-309` starts `_domain_refresh_loop()`:

- Sleeps 300 seconds before the first run.
- Runs only when dry-run is off, a broker heartbeat is fresh, and at least one domain pattern exists.
- Executes blocking PowerShell/DNS/broker operations inside the async event-loop task, which can block other async server work.
- Has no retained task handle or explicit shutdown cancellation.

`scripts/fgf-broker.ps1`:

- Loops indefinitely, writes a heartbeat, and polls every 1.5 seconds.
- Supports `firewall-batch`, `audit-enable`, `capture-start`, and `capture-stop`.
- Has no broker-stop operation, service recovery, structured log, or single-instance enforcement.

### Startup

`Start Firewall Guard.bat` delegates to `scripts/start.bat`, which:

1. Refuses to start if anything is listening on port 8765.
2. Creates `backend/.venv`.
3. Reinstalls Python dependencies when the `requirements.txt` hash changes.
4. Starts Uvicorn and waits only for a listening socket.
5. Installs frontend packages only if `node_modules` is absent.
6. Starts Vite, waits for port 5173, and opens the browser.

Operational issues:

- Frontend dependency changes are not detected once `node_modules` exists.
- The standard launcher runs `npm run dev` every time, so the README claim that Node is needed only initially does not apply to this launcher; Node is avoidable only through manually started single-process mode.
- Port ownership and HTTP health are not validated. An unrelated service can be mistaken for Firewall Guard.
- Vite may move to 5174 when 5173 is occupied, while the launcher still waits for/opens 5173. `frontend/.fgf-vite-log.txt` contains evidence of this fallback behavior.
- Frontend startup failure does not roll back an already-started backend.

### Shutdown

`Stop Firewall Guard.bat`:

- Force-kills the process trees owning listeners on 8765 and 5173.
- Does not verify that those processes belong to Firewall Guard, so unrelated applications on those ports can be killed.
- Does not explicitly stop the elevated broker or ETW trace.
- Does not handle a Vite server that moved to another port.

### Logging and evidence

- Backend console output is redirected to `fgf-backend.log` and overwritten on each launcher run.
- Logging is primarily Uvicorn startup/access output; there is no structured application logger, rotation policy, broker log, or authentication-failure audit.
- SQLite activity records selected mutations, but coverage is inconsistent, especially around failed removals.
- Inspected backend log entries demonstrate previous Uvicorn startup and successful GET requests for overview, metrics, rules, traffic, domains, and resources. They do **not** validate firewall mutation correctness.
- Vite logs show previous startup on 5173 and, in the alternate log, fallback to 5174. These are historical records, not proof of current service state.

---

## 7. Security, correctness, and reliability findings

### Critical/high priority

#### A. PowerShell injection through API-controlled values

1. `GET /api/events?since=...`
   - `backend/app/main.py:97-100` passes `since` directly.
   - `backend/app/traffic.py:30-34` inserts it into a single-quoted PowerShell `[datetime]` expression without validation or escaping.
   - A crafted authenticated value can alter the generated PowerShell command.

2. Domain resolution
   - `backend/app/main.py:230-239` permits `$`, parentheses, and other PowerShell-significant characters in patterns.
   - `backend/app/enrich.py:130-148` uses JSON double-quoted strings as PowerShell string literals.
   - JSON quoting does not prevent PowerShell `$()` subexpression expansion.

These execute with the backend user’s rights. Authentication reduces exposure but is weakened by the publicly known default token; CORS is not a defense against non-browser local clients.

#### B. Elevated broker trusts executable queue content

- `backend/app/broker.py:38-59` writes JSON commands without signing, integrity checks, strict ACL creation, or atomic publication.
- `scripts/fgf-broker.ps1:37-54` accepts queued firewall commands and executes `Invoke-Expression` at line 42.
- Once the elevated worker is running, another process able to write the queue can potentially execute arbitrary commands elevated without another UAC prompt.
- Non-atomic command/ack writes can also cause lost commands or unreadable results.
- A timeout can be reported even if the worker already picked up and later executes the command.

#### C. Dry-run does not cover deletion

- `backend/app/main.py:135-151` calls removal regardless of `CFG["dry_run"]`.
- `frontend/src/components/dialogs.tsx:209-212` labels the operation “Log dry-run removal,” creating a particularly dangerous mismatch.
- Capture, audit enablement, process termination, and broker startup are likewise not dry-run gated, though the most misleading violation is firewall removal.

#### D. Batch removal performs changes and then crashes

`backend/app/firewall.py:159-168`:

```python
res = _apply_batch(..., [{"name": n, "status": "pending"} for n in names], ...)
...
return {"success": len([i for i in items ...]), "items": items}
```

`items` is never assigned. After successful elevated removal:

- The endpoint returns HTTP 500.
- SQLite statuses are not updated.
- The UI reports failure despite real Windows changes.
- Direct domain-plan removals inherit the same defect.

#### E. Domain-rule lifecycle can leave blocks behind or remove valid blocks

`backend/app/traffic.py:219-273` builds diffs only for **enabled** patterns:

- Disabling or deleting a pattern does not schedule its existing rules for removal.
- Those rules can remain active indefinitely and become absent from the normal per-pattern diff.
- If DNS resolution temporarily fails, an enabled pattern’s wanted set becomes empty, so all existing addresses can be classified stale and removed.
- Direct apply uses separate add and remove elevated calls at `traffic.py:311-321`, potentially causing two UAC prompts despite the “one direct UAC batch” comment.
- Broker `firewall-batch` sets overall status to `ok` even when individual operations fail; the frontend treats `status: "ok"` as success and does not inspect the failed list.

### Significant functional defects

#### F. Capture workflow is not operational from the normal UI

- `frontend/src/pages/TrafficPage.tsx:71,83-87` initializes `captureOn` to `null` but enables `captureState` only when it is non-null. The effect intended to initialize it waits for data that cannot be fetched, leaving the switch disabled.
- Capture flow data is never rendered, despite byte-volume claims.
- Broker capture writes to `backend/data/fgf_net.etl`, while direct-UAC startup at `backend/app/main.py:282` writes under `backend/data/broker/fgf_net.etl`; `capture_state()` reads only the former.
- `post_capture_start()` sets the logical `on` flag before elevation and ignores broker acknowledgement details, so failures can leave false state.

#### G. Vite UI cannot toggle domain patterns

`backend/app/main.py:21` permits CORS methods `GET`, `POST`, and `DELETE`, but not `PATCH`. The standard cross-origin Vite UI therefore fails preflight for `PATCH /api/domain-patterns/{pid}`. Same-origin built mode is not affected.

#### H. IPv6 addresses can be corrupted

`backend/app/monitor.py:147-148` uses:

```python
remote_ip.strip("%0").replace("%", "")
```

`strip("%0")` removes legitimate trailing zeroes, not just a zone suffix. For example, an address ending in `10` can be changed to one ending in `1`. Blocking the resulting address could target the wrong host. The `address_family="ipv6"` path also still includes IPv4.

#### I. Batch verification can report false verification

In `backend/app/firewall.py:91-105,128-138`:

- Names enter `$created` immediately after creation.
- A later verification failure appends to `$failed` but does not remove the name from `$created`.
- `_apply_batch()` marks any name in `created` as `created_verified`, even if also failed verification.
- Verification checks only limited properties, not the complete scope.

Large batches are also encoded into a single command with no chunking, creating Windows command-line length risk.

#### J. Event attribution contains an explicit stub and fragile parsing

- `backend/app/traffic.py:105-106`: `extract_pid()` always returns zero.
- Event-to-socket matching therefore falls back to remote IP/port and can attribute an event to the wrong process.
- IP extraction is IPv4-oriented.
- Message fallback expressions use English labels.
- `rows[:1500]` in `main.py:175` can truncate event rows when many sockets precede them.
- Audit policy and Security-log permission failures are mostly converted into empty lists, making “no events” indistinguishable from “cannot read events.”

#### K. Frontend traffic and selection behavior is misleading

- `TrafficPage.tsx:89-101` creates a new map from only the latest response; it does not retain previous polls or implement the stated 1,800-row rolling cap.
- `ConnectionsPage.tsx:34,99` identifies rows only by PID and remote address. Multiple local sockets from the same process to the same destination can collide.
- Managed-rule verification exists only as an unused API; the UI does not perform the README-implied per-rule live verification.

### Additional risks

- **Ownership check is only a prefix:** `firewall.py:56-59,170-180` allows inspection/removal of any rule named `FGF-*`, not just rules present in SQLite or belonging to the `Firewall Guard Fluent` group.
- **Current default secret:** `backend/config/settings.json` and `frontend/.env` both contain `dev-token-change-me`. The browser bundle necessarily exposes its token.
- **GPU parsing:** `backend/app/resources.py:252-270` handles engine samples containing a LUID before the per-PID branch, making the per-app engine-utilization branch effectively unreachable for normal samples.
- **Disk busy sampling:** `backend/app/monitor.py:168-171` assumes every current disk existed in the previous sample; a newly appearing disk can cause a `KeyError`.
- **Shared sampling state:** global, unprotected rate caches can produce zero or misleading rates under concurrent requests.
- **UI polish:** `TrafficPage.tsx` contains visible mojibake such as `Â·` and `â€”`.
- **Documentation mismatches:** tables are custom `<table>` markup in `DataTable.tsx`, and `window.confirm` remains in `App.tsx` and `OverviewPage.tsx`, despite the DataGrid/no-confirm claims.

---

## 8. Dependencies and platform requirements

### Python

`backend/requirements.txt`:

- `fastapi>=0.115,<1`
- `uvicorn[standard]>=0.30,<1`
- `psutil>=6,<8`
- `pydantic>=2.8,<3`

These are broad ranges without a backend lockfile or hashes, so first-run/changed-requirement installation depends on current package resolution and internet access.

### Frontend

`frontend/package.json` and `package-lock.json` provide:

- React 18 and React DOM.
- Fluent UI v9 components/icons.
- TanStack React Query.
- React Router DOM, although the application uses local page state rather than router navigation.
- TypeScript and Vite.

Only `dev` and `build` scripts exist. There is no frontend test, lint, or typecheck-only script.

### Windows facilities

The application relies on:

- Windows PowerShell and NetSecurity cmdlets such as `New-NetFirewallRule`, `Get-NetFirewallRule`, and `Remove-NetFirewallRule`.
- `Get-DnsClientCache` and `Resolve-DnsName`.
- `Get-WinEvent` and the Windows Security/Firewall event logs.
- `auditpol.exe`, `wevtutil.exe`, and `logman.exe`.
- Windows GPU performance counters and CIM.
- Optional `nvidia-smi`.

Observation can run without elevation but with reduced process/socket/event visibility. Firewall, audit-policy, and ETW mutations require administrator approval. Process termination does not elevate and therefore only works where the backend user already has sufficient rights.

---

## 9. Test coverage and validation

### Existing backend tests

There are **24 test methods by inspection** across:

- `backend/tests/test_firewall.py`
  - Target validation and rule-command construction.
- `backend/tests/test_policy.py`
  - Wildcard matching, policy validation, and basic matching.
- `backend/tests/test_resources.py`
  - Process termination guards and limited GPU parsing.
- `backend/tests/test_traffic.py`
  - Domain-pattern persistence/candidates, batch script strings, and broker timeout behavior.

### Important gaps

No tests cover:

- FastAPI routes, authentication, CORS, or dry-run safety.
- Single or batch deletion end-to-end.
- The undefined `items` defect in `remove_rules_batch()`.
- Actual Windows Firewall changes or verification semantics.
- Domain apply, stale-rule cleanup, DNS failure behavior, or automatic refresh.
- PowerShell injection inputs.
- IPv6 normalization.
- Event parsing/correlation.
- Capture state or ETL path consistency.
- Frontend components and API integration.
- Concurrent sampling or SQLite/Windows reconciliation.

There are no frontend test files or test runner configuration, and no visible CI configuration.

`BrokerQueue` tests are not hermetic: they use the real project broker queue and assume no live broker. Running them while the elevated worker is active could consume test commands or make assertions fail. This is one reason they were not executed during this read-only review.

The README’s statement that build and launcher validation occurred is a historical claim; the inspected logs support previous server startup but do not prove the unsafe mutation paths or full test suite were validated.

---

## 10. Bottom line

The strongest parts are the **local telemetry, Fluent-based console, manual block-rule construction, and Windows/PowerShell integration**. The weakest parts are the **safety boundary around mutations, elevated broker trust model, domain-rule reconciliation, capture workflow, and lack of integration testing**.

Before relying on it for real blocking, the highest priorities are to:

1. Eliminate the PowerShell injection paths.
2. Replace broker `Invoke-Expression` with a strict authenticated/ACL-protected operation schema.
3. Enforce dry-run consistently and fix batch removal before any further use.
4. Restore a safe dry-run default and replace the development token.
5. Repair domain cleanup/resolution-failure semantics and capture state handling.
6. Add API and Windows integration tests, especially for partial failure and reconciliation.