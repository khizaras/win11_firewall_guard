import fnmatch, ipaddress, os

def wildcard_match(value, patterns):
    value = str(value or "").casefold()
    return any(fnmatch.fnmatchcase(value, str(p).casefold()) for p in patterns if str(p))

def validate_policy(p):
    errors=[]
    if not str(p.get("id","")).strip(): errors.append("Missing policy id.")
    if p.get("action","block") != "block": errors.append("Only action='block' is supported.")
    if str(p.get("direction","outbound")).lower() not in {"inbound","outbound"}: errors.append("Invalid direction.")
    if str(p.get("protocol","Any")).lower() not in {"any","tcp","udp"}: errors.append("Invalid protocol.")
    n=0
    for key in ("process_name_patterns","service_name_patterns"):
        for x in p.get(key,[]):
            if not isinstance(x,str) or not x.strip(): errors.append(f"Invalid selector in {key}.")
            else: n+=1
    for x in p.get("program_paths",[]):
        if str(x).strip(): n+=1
        else: errors.append("Empty executable path.")
    for x in p.get("remote_ips",[]):
        try: ipaddress.ip_network(str(x),strict=False); n+=1
        except ValueError: errors.append(f"Invalid IP/CIDR: {x}")
    for x in p.get("remote_ports",[]):
        try:
            if not 1 <= int(x) <= 65535: raise ValueError()
            n+=1
        except (ValueError,TypeError): errors.append(f"Invalid port: {x}")
    if not n: errors.append("At least one explicit selector is required.")
    return errors

def ip_matches(ip, ranges):
    try: address=ipaddress.ip_address(str(ip))
    except ValueError: return False
    for r in ranges:
        try:
            if address in ipaddress.ip_network(str(r),strict=False): return True
        except ValueError: pass
    return False

def normpath(p): return os.path.normcase(os.path.abspath(os.path.expandvars(str(p))))

def policy_matches(p,c):
    if not p.get("enabled") or not p.get("automatic") or p.get("action","block")!="block" or validate_policy(p): return False
    if str(p.get("direction","outbound")).lower()!=str(c.get("direction","outbound")).lower(): return False
    proto=str(p.get("protocol","Any")).lower()
    if proto!="any" and proto!=str(c.get("protocol","")).lower(): return False
    if p.get("process_name_patterns") and not wildcard_match(c.get("process",""),p["process_name_patterns"]): return False
    if p.get("service_name_patterns") and not any(wildcard_match(s,p["service_name_patterns"]) for s in c.get("services",[])): return False
    if p.get("program_paths") and (not c.get("program_path") or normpath(c["program_path"]) not in {normpath(x) for x in p["program_paths"]}): return False
    if p.get("remote_ips") and not ip_matches(c.get("remote_ip",""),p["remote_ips"]): return False
    if p.get("remote_ports"):
        try:
            if int(c.get("remote_port",-1)) not in {int(x) for x in p["remote_ports"]}: return False
        except (ValueError,TypeError): return False
    return True

def policy_target(p,c):
    t={"direction":str(p.get("direction","outbound")).capitalize(),"protocol":str(p.get("protocol","Any")).upper(),
       "remote_ip":None,"remote_port":None,"program_path":None,"service_name":None}
    if p.get("remote_ips") and ip_matches(c.get("remote_ip",""),p["remote_ips"]): t["remote_ip"]=c["remote_ip"]
    if p.get("remote_ports"): t["remote_port"]=int(c["remote_port"])
    if p.get("program_paths") and c.get("program_path"): t["program_path"]=os.path.abspath(c["program_path"])
    if p.get("service_name_patterns"):
        t["service_name"]=next((s for s in c.get("services",[]) if wildcard_match(s,p["service_name_patterns"])),None)
    if not any((t["remote_ip"],t["remote_port"],t["program_path"],t["service_name"])) and c.get("program_path"):
        t["program_path"]=os.path.abspath(c["program_path"])
    return t
