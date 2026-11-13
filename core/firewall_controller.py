import base64, ctypes, ipaddress, subprocess, sys, uuid
PREFIX="WFGPro-"
def is_windows_admin():
    if sys.platform!="win32": return False
    try: return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception: return False
def validate_target(t):
    direction=str(t.get("direction","Outbound")).capitalize(); protocol=str(t.get("protocol","Any")).upper()
    if direction not in {"Inbound","Outbound"}: raise ValueError("Invalid direction")
    if protocol not in {"ANY","TCP","UDP"}: raise ValueError("Invalid protocol")
    ip=t.get("remote_ip")
    if ip: ipaddress.ip_address(str(ip))
    port=t.get("remote_port")
    if port is not None and not 1<=int(port)<=65535: raise ValueError("Port must be 1–65535")
    program=t.get("program_path")
    if program and (not str(program).lower().endswith(".exe") or "\\x00" in str(program)): raise ValueError("Program must be an .exe path")
    service=t.get("service_name")
    if service and (not str(service).strip() or any(ch in str(service) for ch in "'\\r\\n\\x00")): raise ValueError("Invalid service name")
    if not any((ip,port,program,service)): raise ValueError("Refusing an unscoped firewall rule")
    return {"direction":direction,"protocol":protocol,"remote_ip":str(ip) if ip else None,
      "remote_port":int(port) if port is not None else None,"program_path":str(program) if program else None,"service_name":str(service) if service else None}
def build_powershell_rule_command(target,name):
    t=validate_target(target); q=lambda x:"'"+str(x).replace("'","''")+"'"
    parts=["New-NetFirewallRule","-DisplayName "+q(name),"-Group "+q("Windows Firewall Guard Pro"),
      "-Enabled True","-Action Block","-Direction "+t["direction"],"-Profile Any","-Protocol "+q(t["protocol"].capitalize())]
    if t["remote_ip"]: parts += ["-RemoteAddress "+q(t["remote_ip"])]
    if t["remote_port"] is not None: parts += ["-RemotePort "+q(t["remote_port"])]
    if t["program_path"]: parts += ["-Program "+q(t["program_path"])]
    if t["service_name"]: parts += ["-Service "+q(t["service_name"])]
    return " ".join(parts)
def _run_elevated(script):
    if sys.platform!="win32": raise RuntimeError("Windows-only firewall integration")
    child="$ErrorActionPreference='Stop'; try { "+script+"; exit 0 } catch { Write-Error $_; exit 1 }"
    encoded=base64.b64encode(child.encode("utf-16le")).decode("ascii")
    launcher=("$p=Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-NonInteractive','-EncodedCommand','"+
      encoded+"') -Verb RunAs -Wait -PassThru; if($p.ExitCode -ne 0){exit $p.ExitCode}")
    r=subprocess.run(["powershell.exe","-NoProfile","-NonInteractive","-Command",launcher],capture_output=True,text=True,timeout=60,
      creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
    if r.returncode: raise RuntimeError((r.stderr or r.stdout or "UAC cancelled or elevated PowerShell failed")[:1200])
def create_block_rule(target,policy_id="manual"):
    safe="".join(c if c.isalnum() or c in "-_" else "-" for c in str(policy_id))[:28]
    name=f"{PREFIX}{safe}-{uuid.uuid4().hex[:10]}"
    _run_elevated(build_powershell_rule_command(target,name)+" | Out-Null")
    return name
def delete_owned_rule(name):
    if not str(name).startswith(PREFIX): raise ValueError("Refusing to delete a rule not owned by this app")
    q="'"+str(name).replace("'","''")+"'"
    _run_elevated("Get-NetFirewallRule -DisplayName "+q+" -ErrorAction Stop | Remove-NetFirewallRule")
