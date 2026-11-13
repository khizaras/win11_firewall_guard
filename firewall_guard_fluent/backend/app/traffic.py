"""Traffic inspector backend: merged live rows, WFP direction inference, capture aggregates."""
import asyncio, json, re, subprocess, sys, time
from pathlib import Path
from . import enrich
from .monitor import connections
from .firewall import rule_command, validate_target

BASE = Path(__file__).resolve().parents[1]
_WFP_TTL = 2.0
_wfp_cache = None
_wfp_at = 0.0
_cap_cache = None
_cap_at = 0.0
_cap_prev = {}
_cap_prev_at = 0.0


def query_events(limit=250, since=None):
    """Structured WFP/firewall events from the Security + Advanced-Security logs."""
    if sys.platform != "win32":
        return []
    limit = max(1, min(int(limit), 250))
    ids = "2004,2005,2006,5152,5156,5157"
    since_sql = ""
    script = (f"$ids=@({ids});$logs=@('Microsoft-Windows-Windows Firewall With Advanced Security/Firewall','Security');"
              f"$all=foreach($log in $logs){{try{{Get-WinEvent -FilterHashtable @{{LogName=$log;Id=$ids{since_sql}}} -MaxEvents {limit} -ErrorAction Stop}}catch{{}}}};"
              )
    # Since filtering: FilterHashtable supports StartTime as [datetime].
    script = None  # rebuilt below in one pass
    since_part = ""
    if since:
        since_part = f";StartTime=[datetime]'{str(since)}'"
    script = (f"$ids=@({ids});$logs=@('Microsoft-Windows-Windows Firewall With Advanced Security/Firewall','Security');"
              f"$all=foreach($log in $logs){{try{{Get-WinEvent -FilterHashtable @{{LogName=$log;Id=$ids{since_part}}} -MaxEvents {limit} -ErrorAction Stop}}catch{{}}}};"
              "$all|Sort-Object TimeCreated -Descending|Select-Object -First " + str(limit) + "|"
              "ForEach-Object{ [pscustomobject]@{TimeCreated=$_.TimeCreated;Id=$_.Id;ProviderName=$_.ProviderName;LevelDisplayName=$_.LevelDisplayName;"
              "Message=($_.Message.Substring(0,[Math]::Min(2500,$_.Message.Length)));Props=($_.Properties|ForEach-Object{$_.Value}) } }|ConvertTo-Json -Depth 4 -Compress")
    try:
        r = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
                           capture_output=True, text=True, timeout=15,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if r.returncode or not r.stdout.strip():
            return []
        data = json.loads(r.stdout)
        data = [data] if isinstance(data, dict) else data
    except Exception:
        return []
    out = []
    ipre = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")
    for x in data:
        if not isinstance(x, dict):
            continue
        row = {"time": str(x.get("TimeCreated", "")), "event_id": str(x.get("Id", "")),
               "provider": str(x.get("ProviderName", "")), "level": str(x.get("LevelDisplayName", "")),
               "message": str(x.get("Message", ""))}
        props = [str(v) for v in (x.get("Props") or [])]
        ips = [v for v in props if ipre.match(v)]
        row["direction"] = "inbound" if any("%14592" in v for v in props) else "outbound" if any("%14593" in v for v in props) else ""
        row["src_ip"] = ips[0] if ips else ""
        row["dst_ip"] = ips[1] if len(ips) > 1 else ""
        apps = [v for v in props if v.lower().endswith(".exe")]
        row["app"] = apps[0] if apps else ""
        msg = row["message"]
        if not row["src_ip"]:
            pm = re.search(r"Source Address: ([0-9.]+)", msg)
            row["src_ip"] = pm.group(1) if pm else ""
            pm = re.search(r"Destination Address:\s*([0-9.]+)", msg)
            row["dst_ip"] = pm.group(1) if pm else ""
        pm = re.search(r"Source Port:\s*(\d+)", msg)
        row["src_port"] = int(pm.group(1)) if pm else 0
        pm = re.search(r"Destination Port:\s*(\d+)", msg)
        row["dst_port"] = int(pm.group(1)) if pm else 0
        row["verdict"] = "permitted" if row["event_id"] == "5156" else ("blocked" if row["event_id"] in ("5152", "5157") else "rule-event")
        out.append(row)
    return out


def recent_events():
    """WFP events for direction inference; cached 2 s."""
    global _wfp_cache, _wfp_at
    import time as _t
    now = _t.time()
    if _wfp_cache is not None and now < _wfp_at:
        return _wfp_cache
    _wfp_cache = query_events(limit=250)
    _wfp_at = now + _WFP_TTL
    return _wfp_cache


def event_index():
    """[(pid, remote_ip, remote_port)] -> newest event row for direction/verdict inference."""
    idx = {}
    for r in recent_events():
        remote = r["dst_ip"] if r["direction"] == "outbound" else r["src_ip"]
        remote_port = r["dst_port"] if r["direction"] == "outbound" else r["src_port"]
        app = r["app"] or ""
        pid = extract_pid(app if False else "") # app path only; no pid → 0
        key = (int(pid or 0), remote or "", int(remote_port or 0))
        cur = idx.get(key)
        if not cur or (cur.get("time") or "") < (r.get("time") or ""):
            idx[key] = r
    return idx


def extract_pid(text):
    return 0


def traffic_rows(show_listeners=False):
    """Merged live rows: connections + recent WFP events; direction/verdict/hostname enrichment."""
    dns = enrich.dns_cache()
    ei = event_index()
    rows = []
    for c in connections(show_listeners=show_listeners, address_family="all"):
        # infer direction/verdict from newest matching WFP event
        ev = ei.get((int(c["pid"] or 0), c["remote_ip"] or "", int(c["remote_port"] or 0))) \
             or ei.get((int(c["pid"] or 0), c["remote_ip"] or "", 0)) \
             or ei.get((0, c["remote_ip"] or "", int(c["remote_port"] or 0))) \
             or ei.get((0, c["remote_ip"] or "", 0))
        rows.append({
            "kind": "conn",
            "id": f"conn:{c['pid']}:{c['remote_ip']}:{c['remote_port']}:{c['local_address']}",
            "time": "",
            "verdict": (ev or {}).get("verdict", "live"),
            "direction": (ev or {}).get("direction", ""),
            "event_id": (ev or {}).get("event_id", ""),
            "pid": c.get("pid", 0),
            "process": c.get("process", ""),
            "app": c.get("program_path", ""),
            "program_path": c.get("program_path", ""),
            "local_address": c.get("local_address", ""),
            "remote_ip": c.get("remote_ip", ""),
            "remote_port": c.get("remote_port", 0),
            "remote_address": c.get("remote_address", ""),
            "state": c.get("state", ""),
            "protocol": c.get("protocol", ""),
            "hostname": (dns.get(c.get("remote_ip", "")) or [None])[0] or "",
            "services": c.get("services", []),
            "message": (ev or {}).get("message", ""),
        })
    # prepend newest events (each is also valid for the inspection graph)
    for r in recent_events():
        remote = r["dst_ip"] if r["direction"] == "outbound" else r["src_ip"]
        remote_port = r["dst_port"] if r["direction"] == "outbound" else r["src_port"]
        rows.append({
            "kind": "event", "id": f"ev:{r['time']}:{r['event_id']}:{r['src_ip']}",
            "time": r["time"], "verdict": r["verdict"], "direction": r["direction"],
            "event_id": r["event_id"], "pid": 0, "process": "", "app": r["app"] or "",
            "program_path": r["app"] or "", "local_address": f"{r['src_ip']}:{r['src_port']}" if r["src_ip"] else "",
            "remote_ip": remote or "", "remote_port": remote_port or 0,
            "remote_address": f"{remote}:{remote_port}" if remote else "",
            "state": "", "protocol": "",
            "hostname": (dns.get(remote or "") or [None])[0] or "",
            "services": [],
            "message": r.get("message", ""),
        })
    return rows


# ---------------- optional ETW per-flow capture ----------------
manual_capture = {"on": False, "etl": str(BASE / "data" / "fgf_net.etl")}


def capture_state():
    """Aggregate per-flow bytes from the ETW capture (throttled internally)."""
    global _cap_cache, _cap_at, _cap_prev, _cap_prev_at
    if sys.platform != "win32":
        return {"on": manual_capture["on"], "flows": [], "rates_computed": False}
    import time as _t
    now = _t.time()
    if _cap_cache is None or now >= _cap_at:
        rows = enrich.kernel_net_rows(manual_capture["etl"], limit=8000) if Path(manual_capture["etl"]).exists() else []
        _cap_cache = {(r["pid"], r["direction"], r["remote_ip"], r["remote_port"]): r["bytes"] for r in rows}
        _cap_at = now + 5.0
    rates = {}
    dt = now - _cap_prev_at if _cap_prev and _cap_prev_at and now > _cap_prev_at else 0.0
    for key, total in _cap_cache.items():
        prev = _cap_prev.get(key, total if _cap_prev_at == 0.0 else 0)
        rates[key] = max(0, total - prev) / dt if dt else 0
    _cap_prev = dict(_cap_cache)
    _cap_prev_at = now
    flows = []
    names = {}
    try:
        import psutil
        for (pid, direction, ip, port), b in _cap_cache.items():
            name = names.get(pid)
            if name is None:
                try: name = psutil.Process(pid).name()
                except Exception: name = ""
                names[pid] = name
            flows.append({"pid": pid, "process": name, "direction": direction, "remote_ip": ip,
                          "remote_port": port, "bytes_total": b,
                          "bytes_per_sec": round(rates.get((pid, direction, ip, port), 0))})
    except Exception:
        pass
    flows.sort(key=lambda f: f["bytes_total"], reverse=True)
    return {"on": manual_capture["on"], "flows": flows[:400], "rates_computed": True}


# ---------------- domain wildcard patterns ----------------
def pattern_candidates(pattern):
    """Turn '*microsoft.com*' / '*.microsoft.com' / 'example.*' into resolvable FQDN candidates."""
    pat = str(pattern or "").strip()
    if not pat or any(ch in pat for ch in "'`\r\n\x00"):
        return []
    parts = [p for p in pat.split("*") if p]
    out = []
    core = pat.strip("*").strip(".") if pat != "*" else ""
    if core:
        out.append(core)
    for p in parts:
        if p and p != core:
            out.append(p)
    # drop wildcard-only and duplicate candidates, cap list
    return list(dict.fromkeys(x for x in out if x))[:8]


def domain_plan(db):
    """Compute the resolved IPs per enabled pattern and diff them against DB-stored FGF-dom rules."""
    patterns = [p for p in db.domain_patterns() if p["enabled"]]
    resolved = enrich.domain_matches([p["pattern"] for p in patterns])
    # augment with direct resolves for un-cached candidates
    names_to_resolve = []
    for p in patterns:
        for fqdn in pattern_candidates(p["pattern"]):
            if fqdn not in names_to_resolve:
                names_to_resolve.append(fqdn)
    if names_to_resolve:
        resolved_direct = enrich.resolve_names(names_to_resolve)
        for fqdn, ips in resolved_direct.items():
            for p in patterns:
                core = pattern_candidates(p["pattern"])
                if core and any(fqdn == c or fqdn.endswith("." + c) for c in core):
                    merged = resolved.setdefault(p["pattern"], {"domains": [], "ips": []})
                    for ip in ips:
                        if ip not in merged["ips"]:
                            merged["ips"].append(ip)
                    if fqdn not in merged["domains"]:
                        merged["domains"].append(fqdn)
    # active rules per pattern from DB (rule names FGF-dom-...; policy_id 'domain:<pattern>')
    active = {}
    for r in db.rules():
        if r["status"] == "created" and str(r["policy_id"]).startswith("domain:"):
            pat = str(r["policy_id"])[len("domain:"):]
            try:
                t = json.loads(r["target"])
                ip = t.get("remote_ip")
            except (ValueError, TypeError):
                ip = None
            if ip:
                active.setdefault(pat, {})[r["name"]] = ip
    adding, removing = [], []
    per_pattern = {}
    for p in patterns:
        pat = p["pattern"]
        info = resolved.get(pat, {"domains": [], "ips": []})
        wanted = set(info["ips"])
        existing_by_ip = active.get(pat, {})
        have = set(existing_by_ip.values())
        n_add = n_rm = 0
        for ip in (wanted - have):
            target = validate_target({"direction": "Outbound", "protocol": "ANY", "remote_ip": ip})
            name = "FGF-dom-" + "".join(ch if ch.isalnum() or ch in "-" else "-" for ch in pat)[:30] + "-" + ip.replace(":", "-").replace(".", "-")
            adding.append({"name": name, "target": target, "command": rule_command(target, name), "pattern_id": p["id"], "pattern_string": pat})
            n_add += 1
        for name, ip0 in existing_by_ip.items():
            if ip0 not in wanted:
                removing.append({"name": name, "ip": ip0, "pattern": pat})
                n_rm += 1
        per_pattern[pat] = {"domains": info["domains"][:30], "ips": list(info["ips"])[:100],
                            "active_rules": len(existing_by_ip), "add_n": n_add, "remove_n": n_rm}
    return {"adding": adding, "removing": removing, "per_pattern": per_pattern, "patterns": patterns}


def apply_domain_plan(db, plan, log):
    """Execute add/remove through the broker if alive, else one direct UAC batch."""
    from . import broker as broker_mod
    from .firewall import create_rules_batch, remove_rules_batch
    adding = plan["adding"]
    removing = plan["removing"]
    if not adding and not removing:
        return {"status": "noop", "added": 0, "removed": 0}
    alive, info = broker_mod.broker_alive()
    if alive:
        payload = {"add": [{"name": a["name"], "command": a["command"]} for a in adding],
                   "remove": [r["name"] for r in removing]}
        ack = broker_mod.write_command("firewall-batch", payload, timeout=120)
        if ack.get("status") == "ok":
            done = set(ack.get("created") or [])
            for a in adding:
                if a["name"] in done:
                    db.add_rule("domain:" + str(a["pattern_string"]), a["name"], json.dumps(a["target"]))
                    log("firewall_rule", "Domain block rule created", a["name"] + " " + json.dumps(a["target"]))
            for r in removing:
                if r["name"] in done:
                    db.set_status(r["name"], "removed")
                    log("firewall_rule", "Domain block rule removed", r["name"])
            for p in plan["patterns"]:
                db.touch_applied(p["id"])
            added = len([a for a in adding if a["name"] in done])
            removed = len([r for r in removing if r["name"] in done])
            return {"status": "ok", "via": "broker", "added": added, "removed": removed, "failed": ack.get("failed", [])}
        if ack.get("status") == "timeout":
            return {"status": "broker_timeout", "added": 0, "removed": 0, "failed": []}
        return {"status": "broker_failed", "error": ack.get("error"), "added": 0, "removed": 0, "failed": []}
    # fallback: one direct UAC batch
    added = removed = 0
    problems = []
    targets = [a["target"] for a in adding]
    if targets:
        r1 = create_rules_batch(targets, policy="domain")
        for it in r1.get("items", []):
            if it.get("status") == "created_verified":
                db.add_rule("domain:" + next((a["pattern_string"] for a in adding if a["target"] == it["target"]), "unknown"),
                            it["name"], json.dumps(it["target"]))
                added += 1
            else:
                problems.append(it)
    if removing:
        r2 = remove_rules_batch([r["name"] for r in removing])
        for it in r2.get("items", []):
            if it.get("status") == "removed_verified":
                db.set_status(it["name"], "removed")
                removed += 1
            else:
                problems.append(it)
    if (added or removed) and not problems:
        for p in plan["patterns"]:
            db.touch_applied(p["id"])
    status = "ok" if (added + removed) and not problems else ("failed" if not (added + removed) else "partial")
    return {"status": status, "via": "direct", "added": added, "removed": removed, "failed": problems}

