# Firewall Guard Fluent — Windows 11

A local-first Windows security console with a real Microsoft Fluent UI (React v9, design tokens, DataGrid, drawers, toasts) and a Python FastAPI backend. The primary workflow is **outbound block/unblock for Windows services, executables, and remote IP addresses — with multi-select bulk actions in a single UAC prompt** — plus deep process/network/firewall telemetry.

## Highlights

- **Traffic inspector (browser-network-tab style):** live inbound/outbound event stream + current sockets with app attribution, remote hostname (from the Windows DNS cache — no TLS inspection), protocol/console filters (direction/verdict/protocol/app/wildcard search), sortable DataGrid, per-row detail drawer, select-and-block IPs or apps, and an optional Kernel-Network byte-capture toggle for per-flow transfer volumes.
- **Wildcard domain blocking:** add patterns like `*microsoft.com*`; the app resolves them against the DNS cache and `Resolve-DnsName`, keeps the resolved IP set blocked, and auto-refreshes rules every 5 minutes through an optional elevated worker (one-time UAC — "Start elevated worker" on the Traffic inspector page). Permit/blocked event visibility needs the Windows packet audit policy, enableable in one UAC click from the same page.
- **Enterprise data presentation:** every table is a Fluent `DataGrid` with sortable columns, sticky headers, checkbox multi-select, and dense, token-based styling. Wildcard search (`*`, `?`) on every list.
- **Bulk operations:** multi-select rows → a selection toolbar appears → *Block N selected* opens one batch dialog (grouped by apps / services / IPs) applying all rules in **one UAC elevation**, with per-item results. Managed rules support batch unblock the same way.
- **Richer process data:** command line, parent, threads, CPU time, memory %, per-process disk I/O rates, plus on-demand detail drawer with company/description, Authenticode signature status + signer, window title, responsiveness (collected via PowerShell when you inspect a row).
- **Richer network data:** TCP **and** UDP across **IPv4 + IPv6**, optional listener view, process/service ownership, protocol/state; select any mix of connections and block the unique destination IPs.
- **Richer firewall data:** full live inventory of enabled Windows block rules (program/service/address/port filters joined), firewall profile state (Domain/Private/Public), structured WFP events (direction, source→destination, application) instead of raw message text, and per-rule live verification.
- **System monitor:** per-core CPU heatmap, memory/swap, network send/receive rates, per-disk busy %, 2-minute sparkline trends, top CPU/disk process tables.
- **Toasts, drawers, dialogs** replace `window.confirm`/`alert`; light/dark themes (system default) from the header menu.
- **Audit history:** local SQLite log of actions and outcomes.

## Important behavior

- **Dry-run is enabled by default.** It records intent and does not change Windows Firewall. Switch it off (Overview hero or the header switch) to allow live changes.
- Live rule creation/removal invokes Windows PowerShell with UAC elevation and verifies every rule. A batch apply raises **one** UAC prompt for all rules in the batch. If UAC is cancelled, the batch reports "no output" rather than pretending success.
- A successful firewall rule does not terminate already-established sessions immediately. Some services share a host process; a service block can disrupt dependent Windows functionality.
- Removing an app-owned rule removes only that rule. Another Windows, Group Policy, VPN, endpoint-security, or third-party rule can still block the same traffic.
- The connection list is a point-in-time snapshot; Windows permissions can hide some PIDs. Disk I/O counters may be unavailable for protected processes.
- CPU/disk/network indicators are investigation aids, not proof of exfiltration. The app does not decrypt TLS traffic or inspect file contents.
- This is a local development/security utility, not a signed, hardened commercial product. Review the source and test in a controlled environment first.

## Requirements

- Windows 11 (Windows 10 works with reduced PowerShell features)
- Python 3.11 or newer
- Node.js 20 or newer (only needed the first time, and for `dist` rebuilds)
- Administrator approval for live firewall changes

## Quick start — one command

Double-click **`Start Firewall Guard.bat`** (pure batch, no PowerShell involved). The launcher:

1. Creates the Python venv and installs dependencies **only when `requirements.txt` changed** (cached afterwards).
2. Starts the backend console ("FGF Backend") and waits for its port to listen.
3. Starts the dashboard console ("FGF Dashboard") and **opens it in your browser automatically** (`http://127.0.0.1:5173`).

To shut everything down: close the two minimized console windows or run **`Stop Firewall Guard.bat`** (ports 8765/5173).

### Single-process mode (optional)

If `frontend/dist` exists (`npm run build` in `frontend/`), the backend serves the built dashboard at `http://127.0.0.1:8765` and you can skip Vite entirely — just start uvicorn.

### Contributor/dev mode

`scripts\dev-backend.bat` (fixed module path) and `scripts\dev-backend.ps1` / `scripts\dev-frontend.ps1` remain for two-console development.

## Security configuration

- The default local API token in `backend/config/settings.json` is a development token. Change it before use outside a disposable local test environment and set the same token in `frontend/.env` as `VITE_API_TOKEN`.
- Keep the API bound to loopback; do not expose it to a LAN or the public internet.
- Only app-owned rules with the `FGF-` prefix can be removed from this app.

## Validation status

Backend unit tests cover target validation, batch rule command construction, and wildcard policy matching (`python -m unittest discover -s tests` from `backend/`). `tsc -b && vite build` and a live run of the launcher were verified on a Windows 11 machine. The package has not been validated against every Windows edition, Group Policy configuration, endpoint-security product, or live network stack.
