"""On-demand enrichment via PowerShell with short-lived caching.

List endpoints stay fast (psutil only); richer metadata that needs PowerShell
is fetched here when a user inspects one row or opens a summary panel.
"""
import fnmatch, subprocess, sys, time, json

_WIN = sys.platform == "win32"
_DETAIL_TTL = 60.0
_PROFILE_TTL = 30.0
_DNS_TTL = 30.0
_AUDIT_TTL = 60.0
_detail_cache = {}
_profiles_cache = None
_profiles_at = 0.0
_dns_cache = None
_dns_at = 0.0
_audit_cache = None
_audit_at = 0.0


def _run(script, timeout=20):
    if not _WIN:
        return None
    r = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
        capture_output=True, text=True, timeout=timeout,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if r.returncode or not r.stdout.strip():
        return {"error": (r.stderr or r.stdout or "PowerShell query failed").strip()[:500]}
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return None


def clear_caches():
    global _profiles_cache, _profiles_at, _dns_cache, _dns_at, _audit_cache, _audit_at
    _detail_cache.clear()
    _profiles_cache = None
    _profiles_at = 0.0
    _dns_cache = None
    _dns_at = 0.0
    _audit_cache = None
    _audit_at = 0.0


def dns_cache():
    """Windows DNS resolver cache: {ip: [domains]} for A/AAAA entries; cached 30 s."""
    global _dns_cache, _dns_at
    if not _WIN:
        return {}
    now = time.time()
    if _dns_cache is not None and now < _dns_at:
        return _dns_cache
    script = ("Get-DnsClientCache -ErrorAction SilentlyContinue | "
              "Where-Object { $_.Data -match '^(\\d{1,3}\\.){3}\\d{1,3}$|^[0-9a-fA-F:]+$' } | "
              "Select-Object Entry,Name,Data,Type | ConvertTo-Json -Depth 2 -Compress")
    out = _run(script, timeout=20)
    mapping = {}
    rows = out if isinstance(out, list) else [out] if isinstance(out, dict) else []
    for r in rows:
        if not isinstance(r, dict):
            continue
        ip = str(r.get("Data") or "").strip()
        dom = str(r.get("Entry") or r.get("Name") or "").strip().rstrip(".")
        if not ip or not dom:
            continue
        rec = str(r.get("Type") or "")
        if rec in ("1", "28"):
            keep = mapping.setdefault(ip, [])
            if dom not in keep:
                keep.append(dom)
    if mapping:
        _dns_cache = mapping
        _dns_at = now + _DNS_TTL
    return mapping


def audit_state():
    """Filtering-Platform packet audit (success) for 'Filtering Platform Connection' and 'Packet Drop'."""
    global _audit_cache, _audit_at
    if not _WIN:
        return []
    now = time.time()
    if _audit_cache is not None and now < _audit_at:
        return _audit_cache
    rows = []
    for sub in ("Filtering Platform Connection", "Filtering Platform Packet Drop"):
        script = f'auditpol /get /subcategory:"{sub}" /r | ConvertFrom-Csv | ConvertTo-Json -Compress'
        out = _run(script, timeout=15)
        r = out if isinstance(out, dict) else (out[0] if isinstance(out, list) and out else None)
        state = str(r.get("Audited State") or r.get("Audit State") or "") if r else ""
        if not state:
            # auditpol /get can require elevation (Error 0x522); report that explicitly.
            err = ""
            if isinstance(out, dict):
                err = str(out.get("error") or "")
            detail = err.splitlines()[0] if err else ""
            state = f"unknown (requires admin check{': ' + detail if detail else ''})"
        rows.append({
            "subcategory": sub,
            "state": state,
        })
    _audit_cache = rows
    _audit_at = now + _AUDIT_TTL
    return rows


def domain_matches(patterns):
    """Resolve wildcard domain patterns against the DNS cache: {pattern: {domains: [...], ips: [...]}}."""
    cache = dns_cache()
    out = {}
    for pattern in patterns:
        pat = str(pattern or "").strip()
        match_domains = set()
        for ip, domains in cache.items():
            for d in domains:
                try:
                    if fnmatch.fnmatchcase(d.casefold(), pat.casefold()):
                        match_domains.add(d)
                        break
                except ValueError:
                    continue
        matching_ips = sorted(out_ip for out_ip, domains2 in cache.items() if any(d in match_domains for d in domains2))
        out[pat] = {"domains": sorted(match_domains)[:50], "ips": matching_ips[:200]}
    return out


def resolve_names(fqdns):
    """Resolve FQDNs via Resolve-DnsName (A and AAAA). Returns {name: [ips]}."""
    if not _WIN or not fqdns:
        return {}
    out = {}
    for q in fqdns[:40]:
        q = str(q).strip().rstrip(".")
        if not q or any(ch in q for ch in "'`\r\n\x00"):
            continue
        script = ("$ips=@();"
                  "try{ Resolve-DnsName -Name " + _json_str(q) + " -Type A -DnsOnly -ErrorAction Stop | "
                  "Where-Object { $_.IPAddress } | ForEach-Object { $ips += [string]$_.IPAddress } }catch{};"
                  "try{ Resolve-DnsName -Name " + _json_str(q) + " -Type AAAA -DnsOnly -ErrorAction Stop | "
                  "Where-Object { $_.IPAddress } | ForEach-Object { $ips += [string]$_.IPAddress } }catch{};"
                  "@{name=" + _json_str(q) + ";ips=$ips}|ConvertTo-Json -Compress")
        r = _run(script, timeout=12)
        if isinstance(r, dict):
            out[q] = [str(x) for x in (r.get("ips") or []) if x]
    return out


def _json_str(s):
    import json as _j
    return _j.dumps(str(s))


def kernel_net_rows(etl_path, limit=8000):
    """Aggregate per-flow bytes from a captured ETW Kernel-Network file.

    Event 10 = TCP send (outbound), 15 = TCP receive (inbound). Property layout:
    [0]=PID, [1]=bytes, [2]=peer address, [3]=peer port (fallback: regex scan).
    Returns [{pid, direction, remote_ip, remote_port, protocol, bytes, last_seen}].
    """
    if not _WIN:
        return []
    script = (
        "$ev=Get-WinEvent -Path " + _json_str(str(etl_path)) + " -Oldest -ErrorAction Stop |"
        " Where-Object { $_.Id -in @(10,15) -and $_.ProviderName -like '*Kernel-Network' } |"
        " Select-Object -Last " + str(limit) + ";"
        "if(-not $ev){ '[]'; exit }"
        "$ev | ForEach-Object {"
        "  $p=@($_.Properties | ForEach-Object { $_.Value });"
        "  [pscustomobject]@{id=$_.Id;ts=$_.TimeCreated.ToString('o');props=$p}"
        "} | ConvertTo-Json -Depth 4 -Compress")
    out = _run(script, timeout=90)
    if isinstance(out, dict):
        out = [out]
    if not isinstance(out, list):
        return []
    import re as _re
    ipv4re = _re.compile(r"^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$")

    agg = {}

    def _add(pid, direction, ip, port, nbytes, ts):
        if nbytes <= 0 or not ip:
            return
        key = (int(pid or 0), direction, str(ip), int(port or 0), "TCP")
        a = agg.setdefault(key, {"bytes": 0, "last": ""})
        a["bytes"] += int(nbytes)
        if ts and (not a["last"] or ts > a["last"]):
            a["last"] = ts

    for e in out:
        props = [v for v in (e.get("props") or [])]
        if len(props) < 2:
            continue
        ev_id = str(e.get("id"))
        if ev_id == "10":
            direction, peer_host, peer_port_idx = "outbound", props[2] if len(props) > 2 else "", 3
        elif ev_id == "15":
            direction, peer_host, peer_port_idx = "inbound", props[2] if len(props) > 2 else "", 3
        else:
            continue
        ts = str(e.get("ts") or "")
        # numeric conversion per-field
        def _int(v):
            try:
                return int(str(v))
            except (ValueError, TypeError):
                return 0
        pid = _int(props[0]) if props else 0
        nbytes = _int(props[1])
        ip = ""
        raw = str(peer_host).strip()
        if ipv4re.match(raw):
            ip = raw
        else:
            for v in props:
                if ipv4re.match(str(v).strip()):
                    ip = str(v).strip()
                    break
        port = _int(props[peer_port_idx]) if len(props) > peer_port_idx else 0
        _add(pid, direction, ip, port, nbytes, ts)

    rows = []
    for (pid, direction, ip, port, proto), a in agg.items():
        rows.append({"pid": pid, "direction": direction, "remote_ip": ip, "remote_port": port,
                     "protocol": proto, "bytes": a["bytes"], "last_seen": a["last"]})
    return rows


def process_detail(pid):
    """Company/description/signature/window title for one process, cached 60 s."""
    if not _WIN:
        return {"unsupported": True}
    pid = int(pid)
    hit = _detail_cache.get(pid)
    now = time.time()
    if hit and now < hit[0]:
        return hit[1]
    script = (
        "$p=Get-Process -Id " + str(pid) + " -ErrorAction Stop;"
        "$exe='';try{$exe=[string]$p.Path}catch{};"
        "$sig=$null;if($exe){$sig=Get-AuthenticodeSignature -FilePath $exe -ErrorAction SilentlyContinue};"
        "$ver=$null;if($exe){try{$ver=(Get-Item -LiteralPath $exe).VersionInfo|Select-Object ProductName,FileVersion,FileDescription,CompanyName}catch{}};"
        "[pscustomobject]@{"
        "pid="+str(pid)+";"
        "path=$exe;"
        "company=[string]$p.Company;"
        "description=[string]$p.Description;"
        "window_title=[string]$p.MainWindowTitle;"
        "start_time=$([string]$p.StartTime);"
        "responding=$([bool]$p.Responding);"
        "signature_status=$([string]$sig.Status);"
        "signature_signer=$([string]$sig.SignerCertificate.Subject);"
        "version_info=$ver"
        "}|ConvertTo-Json -Depth 4 -Compress")
    out = _run(script)
    if out is not None:
        _detail_cache[pid] = (now + _DETAIL_TTL, out)
    return out or {"error": "Process metadata unavailable"}


def firewall_profiles():
    """Firewall profile state (Domain/Private/Public), cached 30 s."""
    global _profiles_cache, _profiles_at
    if not _WIN:
        return []
    now = time.time()
    if _profiles_cache is not None and now < _profiles_at:
        return _profiles_cache
    script = (
        "Get-NetFirewallProfile -ErrorAction Stop | Sort-Object Name | "
        "Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction,"
        "NotifyOnUserRequest,LogMaxSizeKilobytes | ConvertTo-Json -Compress")
    out = _run(script, timeout=25)
    if isinstance(out, dict):
        out = [out]
    if isinstance(out, list):
        def _action(v):
            s = str(v).strip()
            return {"0": "NotConfigured", "1": "Allow", "2": "Block"}.get(s, s or "—")
        _bool = lambda v: "True" if v in (True, 1, "1", "True") else "False"
        _profiles_cache = [{
            "profile": str(p.get("Name") or ""),
            "enabled": _bool(p.get("Enabled")),
            "default_inbound_action": _action(p.get("DefaultInboundAction")),
            "default_outbound_action": _action(p.get("DefaultOutboundAction")),
            "notify": _bool(p.get("NotifyOnUserRequest")),
        } for p in out if isinstance(p, dict)]
    if _profiles_cache is not None:
        _profiles_at = now + _PROFILE_TTL
        return _profiles_cache
    return []


def firewall_rules(enabled_only=True, action="all", limit=400):
    """Live Windows firewall rule inventory joined with app/service/port/address filters."""
    if not _WIN:
        return []
    limit = max(1, min(int(limit), 2000))
    sel = ["-ErrorAction Stop"]
    if enabled_only:
        sel.append("-Enabled True")
    if action in ("block", "allow"):
        sel.append("-Action " + ("Block" if action == "block" else "Allow"))
    script = (
        "$rules=Get-NetFirewallRule " + " ".join(sel) +
        " | Sort-Object DisplayName | Select-Object -First " + str(limit) + ";"
        "$out=foreach($r in $rules){"
        "$prog='';$svc='';$rport='';$lport='';$proto='';$addr='';"
        "try{ $af=$r|Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue; $prog=[string]$af.Program }catch{};"
        "try{ $sf=$r|Get-NetFirewallServiceFilter -ErrorAction SilentlyContinue; $svc=[string]$sf.Service }catch{};"
        "try{ $pf=$r|Get-NetFirewallPortFilter -ErrorAction SilentlyContinue; $rport=@($pf.RemotePort)-join ','; $lport=@($pf.LocalPort)-join ','; $proto=[string]$pf.Protocol }catch{};"
        "try{ $adf=$r|Get-NetFirewallAddressFilter -ErrorAction SilentlyContinue; $addr=@($adf.RemoteAddress)-join ',' }catch{};"
        "[pscustomobject]@{name=$r.DisplayName;group=$r.Group;"
        "enabled=$([string]$r.Enabled);action=$([string]$r.Action);direction=$([string]$r.Direction);"
        "profile=$([string]$r.Profile);program=$prog;service=$svc;"
        "remote_ports=$rport;local_ports=$lport;protocol=$proto;remote_addresses=$addr}"
        "};"
        "$out|ConvertTo-Json -Depth 3 -Compress")
    out = _run(script, timeout=90)
    if isinstance(out, dict):
        out = [out]
    if not isinstance(out, list):
        return []
    return [r for r in out if isinstance(r, dict)]
