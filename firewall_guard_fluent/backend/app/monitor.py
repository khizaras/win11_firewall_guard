"""Windows process, service, network, CPU, memory, disk and network-throughput telemetry."""
import time
import psutil

_io_previous = None
_io_previous_at = None
_perdisk_previous = None
_perdisk_previous_at = None
_net_previous = None
_net_previous_at = None
_proc_io_previous = {}
_proc_io_previous_at = None
_list_io_previous = {}
_list_io_previous_at = None


def services_by_pid():
    out = {}
    if not hasattr(psutil, "win_service_iter"):
        return out
    try:
        for s in psutil.win_service_iter():
            try:
                d = s.as_dict()
                pid = int(d.get("pid") or 0)
                if pid:
                    out.setdefault(pid, []).append(str(d.get("name") or ""))
            except (psutil.Error, OSError, ValueError):
                pass
    except (psutil.Error, OSError):
        pass
    return out


def services():
    out = []
    if not hasattr(psutil, "win_service_iter"):
        return out
    try:
        for s in psutil.win_service_iter():
            try:
                d = s.as_dict()
                install = d.get("install_date")
                out.append({
                    "name": str(d.get("name") or ""),
                    "display_name": str(d.get("display_name") or d.get("name") or ""),
                    "status": str(d.get("status") or "unknown"),
                    "pid": int(d.get("pid") or 0),
                    "start_type": str(d.get("start_type") or "unknown"),
                    "username": str(d.get("username") or ""),
                    "binpath": str(d.get("binary_path") or d.get("binpath") or ""),
                    "description": str(d.get("description") or ""),
                    "install_date": str(install) if install else "",
                })
            except (psutil.Error, OSError, ValueError):
                pass
    except (psutil.Error, OSError):
        pass
    return sorted(out, key=lambda x: (x["display_name"].casefold(), x["name"].casefold()))


def processes():
    sm = services_by_pid()
    out = []
    for proc in psutil.process_iter(["pid", "name", "exe", "username", "status", "memory_info",
                                     "memory_percent", "cmdline", "ppid", "num_threads",
                                     "create_time", "cpu_times", "nice"]):
        try:
            d = proc.info
            pid = int(d.get("pid") or 0)
            mem = d.get("memory_info")
            try:
                cpu = proc.cpu_percent(interval=None)
            except (psutil.Error, OSError):
                cpu = 0.0
            ct = d.get("cpu_times")
            cpu_time = round((ct.user + ct.system + getattr(ct, "iowait", 0.0)), 1) if ct else 0.0
            n_threads = int(d.get("num_threads") or 0)
            create_time = d.get("create_time")
            io_read_bytes = io_write_bytes = 0
            try:
                io_c = proc.io_counters()
                io_read_bytes, io_write_bytes = int(io_c.read_bytes), int(io_c.write_bytes)
            except (psutil.Error, OSError, AttributeError):
                pass
            out.append({
                "pid": pid, "process": d.get("name") or "", "program_path": d.get("exe") or "",
                "username": d.get("username") or "", "status": d.get("status") or "",
                "services": sm.get(pid, []), "cpu_percent": round(float(cpu), 1),
                "memory_bytes": int(mem.rss) if mem else 0,
                "memory_percent": round(float(d.get("memory_percent") or 0), 1),
                "cmdline": [str(a)[:300] for a in (d.get("cmdline") or [])][:40],
                "ppid": int(d.get("ppid") or 0),
                "threads": n_threads,
                "create_time": float(create_time) if create_time else 0.0,
                "cpu_time_seconds": cpu_time,
                "nice": d.get("nice"),
                "io_read_bytes_total": io_read_bytes,
                "io_write_bytes_total": io_write_bytes,
            })
        except (psutil.Error, OSError):
            pass
    names = {p["pid"]: p["process"] for p in out}
    global _list_io_previous, _list_io_previous_at
    now = time.monotonic()
    dt = now - _list_io_previous_at if _list_io_previous_at and now > _list_io_previous_at else 0.0
    old = _list_io_previous
    for p in out:
        prev = old.get(p["pid"])
        rps = max(0, p["io_read_bytes_total"] - prev[0]) / dt if prev and dt else 0.0
        wps = max(0, p["io_write_bytes_total"] - prev[1]) / dt if prev and dt else 0.0
        p["io_read_bytes_per_sec"] = round(rps)
        p["io_write_bytes_per_sec"] = round(wps)
        p["parent_name"] = names.get(p["ppid"], "") and names[p["ppid"]]
    _list_io_previous = {p["pid"]: (p["io_read_bytes_total"], p["io_write_bytes_total"]) for p in out}
    _list_io_previous_at = now
    return sorted(out, key=lambda x: (x["process"].casefold(), x["pid"]))


def connections(show_listeners=False, address_family="all"):
    """Snapshot of TCP/UDP sockets with remote endpoints; optionally local listeners."""
    sm = services_by_pid()
    out = []
    kinds = [("inet", "IPv4")]
    if address_family in ("all", "ipv6"):
        kinds.append(("inet6", "IPv6"))
    for kind, family in kinds:
        try:
            cons = psutil.net_connections(kind=kind)
        except (psutil.AccessDenied, OSError):
            cons = []
        for c in cons:
            if not c.raddr and not show_listeners:
                continue
            pid = c.pid or 0
            name = "Unknown / access denied"
            exe = ""
            user = ""
            if pid:
                try:
                    p = psutil.Process(pid)
                    name = p.name(); exe = p.exe() or ""; user = p.username() or ""
                except (psutil.Error, OSError):
                    pass
            proto = "TCP" if c.type == 1 else "UDP" if c.type == 2 else "Other"
            remote_ip = c.raddr.ip if c.raddr else ""
            if family == "IPv6" and remote_ip:
                remote_ip = remote_ip.strip("%0").replace("%", "") or remote_ip
            out.append({"pid": pid, "process": name, "program_path": exe, "username": user,
                        "services": sm.get(pid, []) if pid else [], "protocol": proto,
                        "family": family,
                        "local_address": f"{c.laddr.ip}:{c.laddr.port}" if c.laddr else "",
                        "remote_ip": remote_ip,
                        "remote_port": c.raddr.port if c.raddr else 0,
                        "remote_address": f"{c.raddr.ip}:{c.raddr.port}" if c.raddr else (f"{c.laddr.ip}:{c.laddr.port}" if c.laddr else ""),
                        "state": getattr(c, "status", "") or "N/A",
                        "listener": not bool(c.raddr)})
    if not show_listeners:
        out = [c for c in out if not c["listener"]]
    return sorted(out, key=lambda x: (x["process"].casefold(), x["remote_address"], x["local_address"]))


def _disk_busy(io_per_disk, previous, now):
    busy = {}
    if not previous or not _perdisk_previous_at or now <= _perdisk_previous_at:
        return busy
    dt = now - _perdisk_previous_at
    for name, d in (io_per_disk or {}).items():
        busy[name] = round(min(100.0, max(0.0,
            (d.read_time - previous[name].read_time + d.write_time - previous[name].write_time)
            / (dt * 1000.0) * 100.0)), 1)
    return busy


def metrics():
    """Sampled system and per-process CPU/memory/disk/network counters. First sample rates are zero."""
    global _io_previous, _io_previous_at, _perdisk_previous, _perdisk_previous_at
    global _net_previous, _net_previous_at, _proc_io_previous, _proc_io_previous_at
    now = time.monotonic()
    wall = time.time()
    cpu = psutil.cpu_percent(interval=None)
    per_core = psutil.cpu_percent(interval=None, percpu=True)
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    net_io = psutil.net_io_counters()
    net_sent = net_recv = 0
    if net_io and _net_previous and _net_previous_at and now > _net_previous_at:
        dt = now - _net_previous_at
        net_sent = max(0, net_io.bytes_sent - _net_previous.bytes_sent) / dt
        net_recv = max(0, net_io.bytes_recv - _net_previous.bytes_recv) / dt
    if net_io:
        _net_previous, _net_previous_at = net_io, now
    disk_rows = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disk_rows.append({"device": part.device, "mountpoint": part.mountpoint, "filesystem": part.fstype,
                              "total_bytes": usage.total, "used_bytes": usage.used, "free_bytes": usage.free,
                              "percent": usage.percent})
        except (PermissionError, OSError):
            continue
    io = psutil.disk_io_counters(perdisk=False)
    read_rate = write_rate = 0.0
    if io and _io_previous and _io_previous_at and now > _io_previous_at:
        dt = now - _io_previous_at
        read_rate = max(0, io.read_bytes - _io_previous.read_bytes) / dt
        write_rate = max(0, io.write_bytes - _io_previous.write_bytes) / dt
    if io:
        _io_previous, _io_previous_at = io, now
    try:
        io_per_disk = psutil.disk_io_counters(perdisk=True)
        disk_busy = _disk_busy(io_per_disk, _perdisk_previous, now)
        _perdisk_previous, _perdisk_previous_at = io_per_disk, now
    except (psutil.Error, OSError):
        disk_busy = {}
    procs = []
    current_io = {}
    for p in psutil.process_iter(["pid", "name", "memory_info"]):
        try:
            d = p.info
            pid = int(d.get("pid") or 0)
            meminfo = d.get("memory_info")
            try: pct = float(p.cpu_percent(interval=None))
            except (psutil.Error, OSError): pct = 0.0
            read_b = write_b = 0
            try:
                io_c = p.io_counters()
                read_b, write_b = int(io_c.read_bytes), int(io_c.write_bytes)
                current_io[pid] = (read_b, write_b)
            except (psutil.Error, OSError, AttributeError):
                pass
            old = _proc_io_previous.get(pid)
            dt = now - _proc_io_previous_at if _proc_io_previous_at and now > _proc_io_previous_at else 0
            rps = max(0, read_b-old[0])/dt if old and dt else 0
            wps = max(0, write_b-old[1])/dt if old and dt else 0
            procs.append({"pid": pid, "process": d.get("name") or "", "cpu_percent": round(pct, 1),
                          "memory_bytes": int(meminfo.rss) if meminfo else 0,
                          "read_bytes_per_sec": round(rps), "write_bytes_per_sec": round(wps),
                          "read_bytes_total": read_b, "write_bytes_total": write_b})
        except (psutil.Error, OSError):
            pass
    _proc_io_previous, _proc_io_previous_at = current_io, now
    return {"sampled_at": wall, "boot_time": psutil.boot_time(),
            "cpu_percent": round(float(cpu), 1),
            "cpu_per_core_percent": [round(float(x), 1) for x in per_core],
            "cpu_count_logical": psutil.cpu_count(logical=True) or 0,
            "memory_total_bytes": mem.total, "memory_available_bytes": mem.available,
            "memory_used_bytes": mem.used, "memory_percent": mem.percent,
            "swap_total_bytes": swap.total, "swap_used_bytes": swap.used,
            "swap_percent": swap.percent,
            "net_sent_bytes_per_sec": round(net_sent), "net_recv_bytes_per_sec": round(net_recv),
            "net_sent_total_bytes": net_io.bytes_sent, "net_recv_total_bytes": net_io.bytes_recv,
            "disk_read_bytes_per_sec": round(read_rate),
            "disk_write_bytes_per_sec": round(write_rate),
            "disk_busy_percent": disk_busy, "disks": disk_rows,
            "top_cpu": sorted(procs, key=lambda x: x["cpu_percent"], reverse=True)[:20],
            "top_disk": sorted(procs, key=lambda x: x["read_bytes_per_sec"]+x["write_bytes_per_sec"], reverse=True)[:20]}
