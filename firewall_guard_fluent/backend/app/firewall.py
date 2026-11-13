"""Scoped Windows Defender Firewall rules. Mutations always use UAC elevation."""
import base64, ipaddress, os, subprocess, sys, uuid, json
from pathlib import Path
PREFIX = "FGF-"
GROUP = "Firewall Guard Fluent"

def validate_target(t):
    if not isinstance(t, dict): raise ValueError("Target must be an object")
    direction = str(t.get("direction", "Outbound")).capitalize()
    proto = str(t.get("protocol", "Any")).upper()
    if direction not in ("Inbound", "Outbound"): raise ValueError("Invalid direction")
    if proto not in ("ANY", "TCP", "UDP"): raise ValueError("Invalid protocol")
    ip = t.get("remote_ip")
    if ip:
        ipaddress.ip_address(str(ip))
    port = t.get("remote_port")
    if port is not None and not 1 <= int(port) <= 65535: raise ValueError("Port must be 1–65535")
    exe = t.get("program_path")
    if exe and (not str(exe).lower().endswith(".exe") or "\x00" in str(exe)): raise ValueError("Program must be an .exe path")
    svc = t.get("service_name")
    if svc and (not str(svc).strip() or any(x in str(svc) for x in "'\r\n\x00")): raise ValueError("Invalid service name")
    if not any((ip, port, exe, svc)): raise ValueError("Refusing an unscoped firewall rule")
    if svc and len(str(svc)) > 256: raise ValueError("Service name is too long")
    return {"direction": direction, "protocol": proto, "remote_ip": str(ip) if ip else None,
            "remote_port": int(port) if port is not None else None,
            "program_path": str(exe) if exe else None, "service_name": str(svc).strip() if svc else None}

def _q(x): return "'" + str(x).replace("'", "''") + "'"

def rule_command(target, name):
    t = validate_target(target)
    a = ["New-NetFirewallRule", "-DisplayName " + _q(name), "-Group " + _q(GROUP),
         "-Enabled True", "-Action Block", "-Direction " + t["direction"], "-Profile Any",
         "-Protocol " + _q(t["protocol"].capitalize())]
    for key, flag in (("remote_ip", "-RemoteAddress"), ("remote_port", "-RemotePort"),
                      ("program_path", "-Program"), ("service_name", "-Service")):
        if t[key] is not None: a += [flag + " " + _q(t[key])]
    return " ".join(a)

def elevated(script):
    if sys.platform != "win32": raise RuntimeError("Firewall changes require Windows.")
    body = "$ErrorActionPreference='Stop'; try { " + script + "; exit 0 } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }"
    enc = base64.b64encode(body.encode("utf-16le")).decode()
    launch = ("$p=Start-Process powershell.exe -ArgumentList @('-NoProfile','-NonInteractive','-EncodedCommand','" + enc + "') -Verb RunAs -Wait -PassThru; if($p.ExitCode -ne 0){exit $p.ExitCode}")
    r = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", launch], capture_output=True, text=True, timeout=75, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if r.returncode: raise RuntimeError((r.stderr or r.stdout or "UAC cancelled or firewall operation failed")[:1200])

def create_rule(target, policy="manual"):
    slug = "".join(c if c.isalnum() or c in "-_" else "-" for c in str(policy))[:24]
    name = f"{PREFIX}{slug}-{uuid.uuid4().hex[:10]}"
    # Verify the created rule inside the elevated PowerShell process; failures return nonzero.
    script = rule_command(target, name) + " | Out-Null; $r=Get-NetFirewallRule -DisplayName " + _q(name) + " -ErrorAction Stop; if(-not $r -or $r.Enabled -ne $true -or $r.Action.ToString() -ne 'Block'){throw 'Firewall rule verification failed'}"
    elevated(script)
    return name

def remove_rule(name):
    if not str(name).startswith(PREFIX): raise ValueError("Only app-owned rules can be removed.")
    script = "Get-NetFirewallRule -DisplayName " + _q(name) + " -ErrorAction Stop | Remove-NetFirewallRule; if(Get-NetFirewallRule -DisplayName " + _q(name) + " -ErrorAction SilentlyContinue){throw 'Rule still exists after removal'}"
    elevated(script)


def _slug(policy):
    return "".join(c if c.isalnum() or c in "-_" else "-" for c in str(policy))[:24] or "manual"


def _parse_outfile(path):
    if not os.path.exists(path):
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return None


def _batch_add_scope(targets, policy="manual"):
    """Validate targets and assign rule names. Returns (valid[(name,target)], items[], errors[])."""
    slug = _slug(policy)
    items, valid = [], []
    for i, raw in enumerate(targets):
        name = f"{PREFIX}{slug}-{uuid.uuid4().hex[:10]}-{i+1}"
        try:
            t = validate_target(raw)
        except (ValueError, TypeError) as e:
            items.append({"status": "invalid", "target": raw, "error": str(e)})
            continue
        valid.append((name, t))
        items.append({"name": name, "target": t, "status": "pending"})
    return valid, items


def build_batch_add_script(valid, out_path):
    """PowerShell that creates+verifies rules for (name,target) pairs and writes JSON results."""
    cmds = ["$ErrorActionPreference='Continue'", "$created=@();$failed=@()"]
    for name, t in valid:
        cmds.append(
            "try{ " + rule_command(t, name) + " | Out-Null; $created+=" + _q(name) +
            " }catch{ $failed+=" + _q(name + "|creation failed") + " }")
    for name, _t in valid:
        cmds.append(
            "try{ $r=Get-NetFirewallRule -DisplayName " + _q(name) + " -ErrorAction Stop;"
            "if(-not $r -or $r.Enabled -ne $true -or $r.Action.ToString() -ne 'Block'){throw 'verification failed'} }"
            "catch{ $failed+=" + _q(name + "|verification failed") + " }")
    cmds.append("foreach($n in $created){ $ok=Get-NetFirewallRule -DisplayName $n -ErrorAction SilentlyContinue; if(-not $ok){ $failed += $n + '|missing after create' } }")
    cmds.append("try{ @{created=@($created);failed=@($failed)} | ConvertTo-Json -Compress | Set-Content -LiteralPath " + _q(str(out_path)) + " -Encoding UTF8 }catch{}")
    return ";".join(cmds)


def build_batch_remove_script(names, out_path):
    cmds = ["$ErrorActionPreference='Continue'", "$removed=@();$failed=@()"]
    for n in names:
        cmds.append(
            "try{ Get-NetFirewallRule -DisplayName " + _q(n) + " -ErrorAction Stop | Remove-NetFirewallRule;"
            "if(Get-NetFirewallRule -DisplayName " + _q(n) + " -ErrorAction SilentlyContinue){throw 'rule still exists'}; $removed+=" + _q(n) +
            " }catch{ $failed+=" + _q(n + "|removal failed") + " }")
    cmds.append("try{ @{removed=@($removed);failed=@($failed)} | ConvertTo-Json -Compress | Set-Content -LiteralPath " + _q(str(out_path)) + " -Encoding UTF8 }catch{}")
    return ";".join(cmds)


def _apply_batch(script, out_path, valid, items, created_status="created_verified"):
    try:
        elevated("$ErrorActionPreference='Continue';" + script)
    finally:
        data = _parse_outfile(out_path)
        try: out_path.unlink()
        except OSError: pass
    if not data:
        return {"error": "Batch run produced no output; UAC may have been cancelled"}
    done = set(data.get("created") or []) | set(data.get("removed") or [])
    failed = data.get("failed") or []
    good_key = "created" if created_status == "created_verified" else "removed"
    for name, _t in valid:
        for it in items:
            if it.get("name") == name:
                if name in done:
                    it["status"] = created_status; it["verified"] = True
                else:
                    msg = next((f.split("|", 1)[1] for f in failed if f.startswith(name + "|")), "operation failed")
                    it["status"] = "failed"; it["error"] = msg
    return {"good": good_key, "items": items}


def create_rules_batch(targets, policy="manual"):
    """Create many block rules inside ONE UAC-elevated PowerShell run.

    Returns {"created": [...], "items": [{"name", "status", "error"?}]}.
    Invalid targets are rejected up front without touching Windows.
    """
    if sys.platform != "win32": raise RuntimeError("Firewall changes require Windows.")
    valid, items = _batch_add_scope(targets, policy)
    if not valid:
        return {"success": 0, "items": items}
    out_path = Path(os.environ.get("TEMP", os.getcwd())) / f"fgf_batch_{uuid.uuid4().hex[:8]}.json"
    res = _apply_batch(build_batch_add_script(valid, out_path), out_path, valid, items)
    if "error" in res:
        return res
    return {"success": len([i for i in items if i.get("status") == "created_verified"]), "items": items}


def remove_rules_batch(names):
    """Remove many app-owned rules inside ONE UAC-elevated PowerShell run."""
    if sys.platform != "win32": raise RuntimeError("Firewall changes require Windows.")
    names = [str(n) for n in names if str(n).startswith(PREFIX)]
    out_path = Path(os.environ.get("TEMP", os.getcwd())) / f"fgf_rbatch_{uuid.uuid4().hex[:8]}.json"
    res = _apply_batch(build_batch_remove_script(names, out_path), out_path, [(n, None) for n in names],
                       [{"name": n, "status": "pending"} for n in names], created_status="removed_verified")
    if "error" in res:
        return res
    return {"success": len([i for i in items if i.get("status") == "removed_verified"]), "items": items}

def inspect_rule(name):
    """Return the effective firewall rule state using a read-only PowerShell query."""
    if sys.platform != "win32": return {"verified": False, "reason": "Windows-only check"}
    if not str(name).startswith(PREFIX): raise ValueError("Only app-owned rules can be inspected.")
    script = "$r=Get-NetFirewallRule -DisplayName " + _q(name) + " -ErrorAction Stop | Select-Object -First 1; if(-not $r){throw 'Rule not found'}; [pscustomobject]@{name=$r.DisplayName;enabled=[string]$r.Enabled;action=[string]$r.Action;direction=[string]$r.Direction;profile=[string]$r.Profile}|ConvertTo-Json -Compress"
    r = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script], capture_output=True, text=True, timeout=20, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if r.returncode or not r.stdout.strip(): return {"verified": False, "reason": (r.stderr or "Rule not found")[:500]}
    try: data = json.loads(r.stdout)
    except json.JSONDecodeError: return {"verified": False, "reason": "Unable to parse firewall state"}
    data["verified"] = data.get("enabled") == "True" and data.get("action") == "Block"
    return data
