# Frontend exploration report

**Repository root:** `c:\develop\win11_firewall_guard\firewall_guard_fluent`  
Paths below are relative to that root. This was read-only source analysis; no files were changed, services started/stopped, or tests executed.

## 1. Overall assessment

The frontend is a **real API-backed React application**, not a mock dashboard. Process, service, connection, firewall, event, resource, and chart data all come from the FastAPI backend. There are no frontend fixture arrays, random metric generators, or simulated mutation timers.

The main block/unblock, telemetry, domain-pattern, process-termination, theme, filtering, and drawer workflows are wired to backend operations. However, several advertised or implied capabilities are incomplete:

- Kernel byte capture cannot currently be enabled through the UI because of a state-initialization deadlock.
- Capture flow/byte data is never rendered.
- Policies are deliberately read-only/reporting-only.
- Live Windows rule selection is informational only.
- Traffic history is not actually accumulated despite comments suggesting rolling retention.
- Charts are short-lived, in-memory samples rather than persisted history.
- Dry-run removal behavior has a serious frontend/backend safety mismatch.

---

## 2. Framework, build, and application structure

### Stack

`frontend/package.json`

- React 18.3 and React DOM
- TypeScript 5.7, strict mode
- Vite 6
- Fluent UI React Components v9 and Fluent Icons
- TanStack React Query 5
- `react-router-dom` is installed but unused

Scripts are limited to:

- `npm run dev` → Vite on `127.0.0.1`
- `npm run build` → `tsc -b && vite build`

There are no frontend test, lint, formatting, or standalone type-check scripts.

### Build/development configuration

- `frontend/vite.config.ts`: React plugin, host `127.0.0.1`, port `5173`; **no API proxy**.
- `frontend/tsconfig.json`: ES2022, strict TypeScript, bundler resolution, no emit.
- `frontend/.env` and `frontend/.env.example`: direct API URL `http://127.0.0.1:8765` and bearer token.
- `frontend/index.html`: standard Vite entry, English language and responsive viewport.
- `backend/app/main.py:311-313`: serves `frontend/dist` as a same-origin static application when built.

### Source organization

- `frontend/src/main.tsx`: React root, `QueryClientProvider`, `FluentThemeProvider`.
- `frontend/src/App.tsx`: shell, navigation, global dry-run state, dialogs, toasts.
- `frontend/src/api.ts`: manually written API types and endpoint client.
- `frontend/src/appContext.tsx`: shared block/unblock/toast/dry-run context.
- `frontend/src/theme.tsx`: Fluent theme and persistence.
- `frontend/src/components/`: shared table, drawers, charts, dialogs, formatting/UI primitives.
- `frontend/src/pages/`: eleven page views across nine source files.

---

## 3. Navigation, state, and theming

### Navigation

`frontend/src/App.tsx:28-49,118-249`

Navigation is a local `useState<PageId>` switch, with groups:

- Home: Overview
- Protection: Processes & services, Firewall events, Policy center, Managed rules
- Network: Network connections, Traffic inspector
- Performance: System monitor, Memory, GPU, Disk

Consequences:

- No URL routes, deep links, bookmarks, browser back/forward, or refresh restoration.
- Every visit starts at Overview.
- Switching pages unmounts the previous page, resetting its local filters, selections, drawers, and chart history.
- The installed React Router package is not used.

Navigation buttons do have `aria-current="page"` and a labelled `<nav>`.

### State management

- **Server state:** TanStack Query in `frontend/src/main.tsx:8-12`.
  - Default polling every six seconds
  - One retry
  - No refetch on window focus
  - Structural sharing
  - Pages override intervals where appropriate
- **Shared UI operations:** `AppCtx` in `frontend/src/appContext.tsx`.
  - `dry`
  - `requestBlock`
  - `requestUnblock`
  - `toast`
- **Local state:** page filters, selections, active tabs, drawers, forms, and dialog results use React state.
- **Theme state:** persisted in `localStorage` under `fgf.themeMode`.

There is no Redux/Zustand-style store, form library, runtime API-schema validation, or persisted table/chart state.

### Fluent UI and theming

`frontend/src/theme.tsx`

- Uses `FluentProvider`, `webLightTheme`, and `webDarkTheme`.
- Supports System, Light, and Dark modes.
- Tracks `prefers-color-scheme` changes.
- Customizes Segoe UI Variable/Cascadia fonts, Windows-like radii, and shadows.
- Updates body foreground/background with Fluent tokens.

Fluent components are used extensively for buttons, cards, badges, dialogs, drawers, menus, switches, message bars, progress bars, tabs, tooltips, and toasts.

The primary table is **not Fluent DataGrid**: `frontend/src/components/DataTable.tsx` is a custom native `<table>` with custom CSS in `frontend/src/styles.css`. This differs from the DataGrid description in `README.md`.

---

## 4. Concise feature inventory

| Page / file | Real wired functionality | Static, limited, or incomplete behavior |
|---|---|---|
| `frontend/src/pages/OverviewPage.tsx` — `OverviewPage` | Polls overview, metrics, managed rules, and activity; firewall profiles; dry-run toggle; navigation cards; live CPU/memory/network/disk charts | Chart history is memory-only; loading/errors often appear as zero, `—`, or “unavailable” |
| `frontend/src/pages/ProcessesPage.tsx` — `ProcessesPage` | Real service/process inventories, wildcard search, column filters, sorting, multi-select, process/service metadata drawers, batch executable/service blocks | First 600 services/400 processes only; no truncation warning for those caps |
| `frontend/src/pages/ConnectionsPage.tsx` — `ConnectionsPage` | Real TCP/UDP endpoint inventory, optional listeners, filtering, drawer, unique destination-IP batch blocking | No port-scoped block action; row identity can collide |
| `frontend/src/pages/TrafficPage.tsx` — `TrafficPage` | Real socket/WFP rows, filters, app/IP blocking, DNS hostname enrichment, worker start, packet-audit enable, domain-pattern CRUD/apply | Capture toggle is stuck disabled; capture flows are not displayed; “rolling merge” and new-row pulse are unfinished; visible mojibake |
| `frontend/src/pages/MonitorPage.tsx` — `MonitorPage` | Real three-second metrics, live SVG charts, per-core load, disk busy/capacity, top CPU/disk tables, process detail drawer | No historical persistence; errors can leave an indefinite “Sampling” message |
| `frontend/src/pages/ResourcesPage.tsx` — `MemoryPage` | Real memory/swap statistics, donut/split visualizations, trend, application table, guarded process termination | History resets on navigation |
| Same file — `GpuPage` | Real adapter/process GPU data, usage/memory presentation, trend, process termination | Trends only use the first adapter; three-minute chart labeling assumes three-second polling although GPU polls every four seconds |
| Same file — `DiskPage` | Real volumes, throughput, application disk activity, process termination | Initial zero rates and empty activity can be normal sampling states rather than true absence |
| `frontend/src/pages/EventsPage.tsx` — `EventsPage` | Reads up to 200 real firewall/WFP events, structured filtering, detail/raw-message drawer, app blocking | No event pagination, bulk selection, or destination-IP action |
| `frontend/src/pages/RulesPage.tsx` — `RulesPage` | Real app-managed rules and enabled Windows block-rule inventory; detail drawers; single and batch removal | Live-rule selection intentionally has no action; live inventory is capped at 600 without a truncation warning |
| `frontend/src/pages/PoliciesPage.tsx` — `PoliciesPage` | Reads actual backend policy definitions and displays selectors/state | Explicitly read-only; automatic background enforcement is disabled. The visible example definition comes from `backend/config/policies.json`, not a frontend mock |

---

## 5. Main user workflows

### Inspect and block applications, services, or IPs

1. Open Processes, Connections, Traffic, or Events.
2. Search/filter and optionally select multiple rows.
3. Invoke a block action.
4. `App.requestBlock` opens `BlockDialog` from `frontend/src/components/dialogs.tsx`.
5. Choose direction/protocol and apply.
6. `api.createBatch` posts to `/api/rules/batch`.
7. Per-item statuses/errors appear in the dialog; queries are invalidated and a toast is emitted.

The backend validates targets, creates `FGF-` rules through elevated PowerShell, verifies them, and records successful rules/activity.

### Remove app-owned rules

- Managed Rules supports per-row `api.remove` and selected-row `api.deleteBatch`.
- Only `FGF-`-prefixed rules are accepted by the backend.
- Live Windows rules from other sources remain read-only.

**Important:** the dry-run behavior in this workflow is defective; see below.

### Domain blocking

1. Add a wildcard such as `*example.com*` in Traffic inspector.
2. Backend matches the DNS cache and directly resolves candidate names.
3. The table shows resolved domains/IPs and pending additions/removals.
4. “Refresh & apply” invokes `/api/domain-patterns/apply`.
5. In live mode, backend applies changes directly or through the elevated broker; its startup loop can refresh them every five minutes when the broker is available.

### Monitoring and process termination

- Overview, Monitor, Memory, GPU, and Disk consume real telemetry.
- Resource rows open metadata drawers.
- “End process” opens a confirmation dialog and calls `/api/processes/{pid}/terminate`.
- Backend blocks critical/system/self processes; protected rows disable the action.

---

## 6. Shared tables, drawers, charts, forms, and notifications

### `DataTable`

`frontend/src/components/DataTable.tsx`

Implemented features:

- Sortable columns with `aria-sort`
- Per-column text, numeric-comparison, select, or disabled filters
- Wildcard matching through `wildcardMatch`
- Select-all-visible and preserved selections across filters
- Keyboard/click row details
- Sticky headers/filter row and horizontal scrolling
- Initial loading spinner and filter-aware empty text
- Item counts and clear-filter action

Limits:

- No pagination or virtualization.
- Selection counts can include filtered-out or stale IDs.
- Column filters operate after page-level caps such as 400/600/800 rows, so they cannot recover rows outside those caps.
- No select-all indeterminate state or `aria-selected` on rows.

### Detail drawers

- `frontend/src/components/DetailDrawer.tsx`: generic fields plus on-demand process metadata.
- `frontend/src/components/ProcessDetailDrawer.tsx`: command line, parent, CPU, memory, I/O, services, signature, and related metadata.
- Traffic has a specialized drawer inside `TrafficPage.tsx`.

Backend file/signature metadata is real and collected through PowerShell.

### Charts

`frontend/src/components/LiveChart.tsx`

- Dependency-free responsive SVG line/area charts.
- `useLiveSamples` retains 40/60 samples depending on the page.
- Text legends expose current values.
- `ResourcesPage.tsx` adds SVG donuts and split bars.

Charts are live client-side aggregations, not backend historical series. They reset when a page unmounts or reloads.

### Forms and confirmations

- Block direction/protocol dialog
- Domain-pattern input with Enter-to-add
- Search and column-filter inputs
- Dry-run switches
- Process termination confirmation
- Native `window.confirm` when enabling live enforcement

There is no general manual rule editor for arbitrary program/IP/port combinations and no policy editing UI.

### Notifications

- Inline Fluent `MessageBar`s for safety, status, and some errors.
- Bottom-end global `Toaster`.
- Pending labels on several mutations and per-item batch results.

However, the toast severity argument is not implemented visually: `App.toast(kind, ...)` never uses `kind` when dispatching (`frontend/src/App.tsx:137-147`), so success/error/warning/info toasts all receive the same presentation.

---

## 7. API client, backend contracts, and authentication UX

### Client behavior

`frontend/src/api.ts:1-18`

- Base URL: `VITE_API_URL`, falling back to `http://127.0.0.1:8765`.
- Sends `Authorization: Bearer <VITE_API_TOKEN>` on every request.
- Sends JSON and extracts FastAPI `detail` errors.
- Types and endpoint wrappers are centralized in the exported `api` object at lines 119-155.

Backend counterparts are concentrated in `backend/app/main.py`:

- Telemetry: `/api/overview`, `/api/processes`, `/api/services`, `/api/metrics`, `/api/connections`, `/api/resources/*`
- Security: `/api/policies`, `/api/rules`, `/api/activity`, `/api/events`, `/api/firewall/*`
- Traffic: `/api/traffic`, `/api/broker/*`, `/api/audit/enable`, `/api/capture/*`, `/api/domain-patterns*`
- Mutations: rule create/delete/batch, dry-run, domain apply, capture, audit, broker, and process termination

TypeScript response interfaces are manually duplicated rather than generated from OpenAPI, and there is no runtime response validation. This allows mismatches such as the domain-apply result issue below.

### Authentication/authorization UX

- There is no login, logout, token-entry, session-expiration, role, or permission screen.
- Any user with the compiled bearer token receives the full control UI.
- Authorization is backend bearer-token checking; administrative authorization is delegated to Windows UAC.
- Worker, audit, firewall, and capture controls explain their elevation requirements.
- Protected process actions are disabled in the UI and guarded again in the backend.
- A 401 from `/api/overview` is presented as “API unreachable,” not as an authentication/configuration problem.
- The default token is compiled into frontend assets; this is a local-development trust model, not multi-user authentication.

---

## 8. Notable bugs and gaps

### Safety-critical

1. **Dry-run does not prevent rule removal.**  
   `RemoveDialog` labels its action “Log dry-run removal” when dry (`frontend/src/components/dialogs.tsx:176-212`), and the managed-rule button also advertises dry-run (`frontend/src/pages/RulesPage.tsx:117-123`). But:
   - `api.deleteBatch` always calls `/api/rules/delete-batch`.
   - `backend/app/main.py:135-146` performs removal without checking `CFG["dry_run"]`.
   - Single removal at `backend/app/main.py:147-151` likewise always removes the rule.
   
   Thus both single and bulk removal can make live firewall changes while the UI says dry-run. `App.tsx:263-270` also always reports successful removal rather than dry-run intent.

2. **Dry-run state is assumed before it is confirmed.**  
   `frontend/src/App.tsx:125-135` uses `dry ?? overview.data?.dry_run ?? true`. Until overview succeeds, the UI claims dry-run and leaves actions available even if the backend is live. The loading guard at line 236 checks `dryMode === null`, but `dryMode` is always boolean, so that spinner is unreachable. An overview failure can therefore leave safety copy inconsistent with actual server enforcement.

### Major functional issues

3. **Kernel capture is permanently disabled by its initialization logic.**  
   In `frontend/src/pages/TrafficPage.tsx`:
   - `captureOn` starts as `null` at line 71.
   - `captureState` is enabled only when `captureOn !== null` at line 83.
   - The effect that would set `captureOn` requires `capture.data` at lines 85-87.
   - The toggle is disabled while `captureOn === null` at line 281.
   
   No initial request can occur, so the UI cannot escape the null state. Additionally, `CaptureState.flows`, `bytes_total`, and `bytes_per_sec` are never rendered anywhere in the frontend.

4. **Bulk selections are not limited or chunked to the backend batch maximum.**  
   Frontend tables permit hundreds of selected targets, while `backend/app/main.py:18,25-29` sets `MAX_BATCH = 50` for create and delete batches. Selecting more than 50 produces a request validation failure rather than multiple batches or proactive UX guidance.

5. **Domain-pattern enable/disable fails in normal cross-origin Vite development.**  
   `api.setDomainPatternEnabled` uses PATCH (`frontend/src/api.ts:139`), but backend CORS allows only GET, POST, and DELETE (`backend/app/main.py:21`). With the direct `127.0.0.1:8765` API URL and no Vite proxy, the browser’s PATCH preflight is rejected. Same-origin built deployments are not affected by this specific issue.

6. **Vite’s fallback port is incompatible with backend CORS.**  
   Vite is not configured with `strictPort`; `frontend/.fgf-vite-log.txt` shows it falling back to port 5174. Backend CORS only allows port 5173 origins, so all authenticated cross-origin API calls fail in that situation.

7. **Live domain-apply toast reads fields the backend does not return.**  
   `frontend/src/pages/TrafficPage.tsx:144-151` reads `r.add_n` and `r.remove_n`. Dry-run responses have those fields, but live `apply_domain_plan` returns `added` and `removed` (`backend/app/traffic.py:276-332`). Live/noop toasts can therefore display `added undefined · removed undefined`. The TypeScript intersection in `api.applyDomainPatterns` masks this contract discrepancy at compile time.

### Traffic and data correctness

8. **Traffic is not actually merged across polls.**  
   `TrafficPage.tsx:89-101` constructs a new map solely from the latest `traffic.data.rows`; it never incorporates the previous `merged` value and does not implement the stated 1,800-row cap. The new-row tracking is also unfinished:
   - `unseen` does not drive any rendered class.
   - The timeout clones rather than clears the set at lines 103-106.
   - `newPulse` is unused.

9. **Traffic contains user-visible encoding corruption.**  
   Examples include `Â·`, `â€”`, `wildcardsâ€¦`, and `Applyingâ€¦` throughout `TrafficPage.tsx`, including lines 148, 257, 276, 287, 305, 332, 341, 344, and 366.

10. **Connection row IDs are not reliably unique.**  
    `ConnectionsPage.tsx:34,99` uses only `pid + remote_address`. Multiple sockets from one process to the same remote endpoint can have different local ports/protocols but collapse to the same React key and selection-map entry. Traffic event IDs can similarly collide when time/event/source are equal.

### Component and interaction issues

11. **Keyboard interaction on controls inside rows can open the drawer instead.**  
    `DataTable.tsx:214-224` filters interactive targets for mouse clicks but not for `onKeyDown`. Space/Enter on a checkbox, switch, or action button bubbles to the row, where the handler prevents the default and calls `onRowClick`. This can prevent checkbox toggling or trigger details alongside an action.

12. **The block dialog’s Fluent Dropdown composition is suspect.**  
    `frontend/src/components/dialogs.tsx:52-65` places native `<option>` elements inside Fluent v9 `<Dropdown>` rather than Fluent `<Option>` components. This does not follow the Dropdown option/selection contract and puts direction/protocol selection and its keyboard behavior at risk. The dialog title also remains “Block outbound traffic” after selecting Inbound (`dialogs.tsx:110,139-140`).

13. **Many query errors are rendered as legitimate empty states.**  
    Only the resource pages consistently show query-specific error bars. Processes, Connections, Events, Policies, Rules, and Traffic frequently fall through to “No … found” when queries fail. Overview can show 0% metrics or “Profile state is not available” during loading/errors; Monitor can remain at “Sampling system telemetry…” indefinitely. The global API badge only appears when overview has an error **and no cached data**, so later outages can be hidden behind stale data.

14. **Some mutation errors are silent.**  
    Domain-pattern removal and enable/disable invalidate on success but define no error feedback (`TrafficPage.tsx:136-143`). Dry-run switching also has no pending lock, allowing rapid competing requests.

### Responsive and accessibility gaps

15. Responsive support exists—stacked sidebar at 900px, reduced content padding at 720px, fluid SVG charts, horizontal table scrolling, stacked resource heroes—but:
    - Drawers use `minWidth: 420px`, exceeding narrow phone viewports.
    - Monitor grids use 420px/460px minimum tracks.
    - Several hero, toolbar, selection, and dialog-control rows do not wrap.
    - Mobile navigation becomes the entire expanded sidebar rather than a compact menu.

16. Positive accessibility provisions include semantic navigation, labelled filters/sort buttons, Fluent dialog/drawer focus behavior, visible focus styling, and Enter/Space row support. Remaining gaps include:
    - The keyboard event bug above.
    - Clickable table rows have no button semantics or `aria-selected`.
    - Several switches rely on adjacent unassociated text rather than programmatic labels.
    - Process page pseudo-tabs do not expose selected-tab semantics.
    - Custom meters/donuts provide limited or generic screen-reader values.

---

## 9. Loading, empty states, and tests

### Loading/error/empty behavior

- `DataTable` has consistent initial loading spinners and contextual empty messages.
- Dialog mutations expose pending states and usually preserve per-item errors.
- Background refreshes retain prior data without a general stale/offline indicator.
- Empty, loading, unsupported-platform, permission-denied, and request-failed states are not consistently distinguished.
- Process detail network errors are often reduced to “No extra metadata available”; generic drawers do not surface `ProcDetail.error` consistently.

### Test coverage

There are **no frontend tests** under `frontend/src`, no frontend test runner dependencies, and no test script in `frontend/package.json`. Missing coverage includes:

- `DataTable` filtering, sorting, selection, and keyboard behavior
- Block/unblock dialogs and dry-run safety
- API contract handling
- Capture initialization
- Traffic retention
- Theme persistence
- Component, accessibility, and end-to-end workflows

Backend unit tests exist in:

- `backend/tests/test_firewall.py`
- `backend/tests/test_traffic.py`
- `backend/tests/test_resources.py`
- `backend/tests/test_policy.py`

They cover target validation, command construction, domain/store helpers, resource guards/parsing, and policy matching, but not the frontend or the important FastAPI response/CORS/dry-run integration contracts described above.
