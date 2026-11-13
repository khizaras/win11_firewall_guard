# Windows Firewall Guard Pro

A modular Windows 11 desktop firewall control center built with Python, PySide6, psutil, SQLite, PowerShell and Windows Defender Firewall.

## Features
- Wildcard process search (`chrome*`, `*updater*`, `python?.exe`), case-insensitive `*` and `?`.
- Process inventory: PID, executable path, username, status and associated Windows service names when visible.
- Active connection list with wildcard filter.
- Manually create confirmed outbound block rules by executable, service, or remote IP.
- Explicit JSON policy rules with wildcard process/service selectors and dry-run mode.
- Windows Firewall/Filtering Platform event viewer and local SQLite audit history.
- UAC elevation for rule changes; UI does not need to run elevated.
- Rule removal is restricted to app-owned `WFGPro-` rules.

## Setup
Windows 11, Python 3.11+:
```powershell
py -3.11 -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item config\\settings.example.json config\\settings.json
Copy-Item config\\policies.example.json config\\policies.json
python app.py
```
Run tests:
```powershell
python -m unittest discover -s tests -v
```

## Wildcard search
Use `chrome*`, `*updater*`, `python?.exe`, or `*`. Search is case-insensitive and matches whole candidate fields; `*` means any sequence and `?` means one character. It is not a shell expression.

## Block outbound traffic
- **Process:** select a process and choose Block outbound for process. The rule scopes to its executable path and can affect every process instance using that path.
- **Service:** select a process with an associated service and choose Block outbound for service. Uses Windows Firewall's service selector. Validate service-specific behavior on your supported Windows build.
- **Remote IP:** blocks that IP for all applications.
- Rules prevent matching traffic, but may not terminate an already-established TCP session immediately. This app intentionally does not kill processes to stop network access.

## Policy format
Edit `config/policies.json`:
```json
{
  "policies": [{
    "id": "block-updater",
    "name": "Example wildcard policy",
    "enabled": false,
    "automatic": true,
    "action": "block",
    "direction": "outbound",
    "process_name_patterns": ["*untrusted-updater*"],
    "service_name_patterns": [],
    "program_paths": [],
    "remote_ips": [],
    "remote_ports": [],
    "protocol": "Any"
  }]
}
```
Populated selector categories are ANDed; values inside a category are ORed. At least one selector is required. Automatic blocking requires `enabled=true`, `automatic=true`, and `action=block`. Dry-run is ON by default.

## Firewall audit events
Queries event IDs 2004, 2005, 2006 and 5152, 5156, 5157 from available Windows Firewall/Security logs. To enable Filtering Platform Connection auditing, review policy first from elevated PowerShell:
```powershell
auditpol /get /subcategory:"Filtering Platform Connection"
auditpol /set /subcategory:"Filtering Platform Connection" /success:enable /failure:enable
```
High-volume auditing can grow the Security log quickly. Event visibility depends on Windows edition, audit policy, permissions, and log retention.

## Safety and known boundaries
- Never start with broad selectors or critical system/VPN/DNS/DHCP/remote-access services.
- Dry-run first. Live changes prompt for UAC.
- The app never disables the firewall or removes rules without its ownership prefix.
- Connection polling is a snapshot, not packet capture; it cannot see every failed attempt.
- Service associations can be incomplete, and inbound/outbound direction is not reliably inferred by the initial polling layer. The provided automatic evaluator is intended for outbound policies; do not rely on it for inbound enforcement.
- This is a production-oriented starter, not a certified EDR or a substitute for Windows Defender.
