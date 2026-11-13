import fnmatch, ipaddress, os
def wildcard_match(value, patterns):
    return any(fnmatch.fnmatchcase(str(value or "").casefold(),str(p).casefold()) for p in patterns if isinstance(p,str) and p)
def validate_policy(p):
    errors=[]; count=0
    if not str(p.get("id","")).strip(): errors.append("Policy ID is required.")
    if p.get("action","block")!="block": errors.append("Only block action is supported.")
    if str(p.get("direction","outbound")).lower() not in ("inbound","outbound"): errors.append("Invalid direction.")
    if str(p.get("protocol","Any")).lower() not in ("any","tcp","udp"): errors.append("Invalid protocol.")
    for key in ("process_name_patterns","service_name_patterns","program_paths","remote_ips","remote_ports"):
        values=p.get(key,[])
        if not isinstance(values,list): errors.append(f"{key} must be a list."); continue
        for v in values:
            if not str(v).strip(): errors.append(f"Empty selector in {key}."); continue
            if key=="remote_ips":
                try: ipaddress.ip_network(str(v),strict=False)
                except ValueError: errors.append(f"Invalid IP/CIDR: {v}"); continue
            if key=="remote_ports":
                try:
                    if not 1<=int(v)<=65535: raise ValueError()
                except (ValueError,TypeError): errors.append(f"Invalid port: {v}"); continue
            count+=1
    if not count: errors.append("At least one explicit selector is required.")
    return errors
def matches(p,c):
    if not p.get("enabled") or not p.get("automatic") or validate_policy(p): return False
    if str(p.get("direction","outbound")).lower()!=str(c.get("direction","outbound")).lower(): return False
    proto=str(p.get("protocol","Any")).lower()
    if proto!="any" and proto!=str(c.get("protocol","")).lower(): return False
    if p.get("process_name_patterns") and not wildcard_match(c.get("process",""),p["process_name_patterns"]): return False
    if p.get("service_name_patterns") and not any(wildcard_match(s,p["service_name_patterns"]) for s in c.get("services",[])): return False
    if p.get("program_paths"):
        actual=os.path.normcase(os.path.abspath(c.get("program_path",""))) if c.get("program_path") else ""
        if actual not in {os.path.normcase(os.path.abspath(x)) for x in p["program_paths"]}: return False
    if p.get("remote_ips"):
        try: addr=ipaddress.ip_address(c.get("remote_ip",""))
        except ValueError: return False
        if not any(addr in ipaddress.ip_network(n,strict=False) for n in p["remote_ips"]): return False
    if p.get("remote_ports") and int(c.get("remote_port",-1)) not in {int(x) for x in p["remote_ports"]}: return False
    return True
