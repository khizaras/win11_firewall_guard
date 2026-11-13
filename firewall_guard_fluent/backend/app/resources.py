"""Memory, GPU, and disk snapshots plus guarded process termination."""
import json, os, re, shutil, subprocess, sys, time
import psutil

CRITICAL = {
    "system", "registry", "smss.exe", "csrss.exe", "wininit.exe", "services.exe",
    "lsass.exe", "winlogon.exe", "fontdrvhost.exe", "secure system", "memory compression",
}
_io_prev = {}
_io_prev_at = 0.0
_disk_rate_prev = None
_disk_rate_at = 0.0
_gpu_cache = {"at": 0.0, "data": None}


def block_reason(pid: int, name: str) -> str | None:
    if int(pid) <= 4:
        return "System processes cannot be terminated."
    if int(pid) == os.getpid():
        return "The console process cannot terminate itself."
    if str(name or "").casefold() in CRITICAL:
        return f"{name} is a critical Windows process and cannot be terminated from here."
    return None


def terminate_process(pid: int) -> dict:
    if sys.platform != "win32":
        raise RuntimeError("Process termination is only available on Windows.")
    try:
        proc = psutil.Process(int(pid))
        name = proc.name()
    except psutil.NoSuchProcess as e:
        raise ValueError("That process is no longer running.") from e
    reason = block_reason(int(pid), name)
    if reason:
        raise ValueError(reason)
    proc.terminate()
    forced = False
    try:
        proc.wait(timeout=2)
    except psutil.TimeoutExpired:
        proc.kill()
        forced = True
    return {"status": "terminated", "pid": int(pid), "process": name, "forced": forced}


def _protected(pid: int, name: str) -> bool:
    return block_reason(pid, name) is not None


def _proc_rows():
    """Running processes with memory and disk-byte rates."""
    global _io_prev, _io_prev_at
    now = time.monotonic()
    dt = now - _io_prev_at if _io_prev_at and now > _io_prev_at else 0.0
    current = {}
    rows = []
    for proc in psutil.process_iter(["pid", "name", "exe", "memory_info", "memory_percent", "status"]):
        try:
            info = proc.info
            pid = int(info.get("pid") or 0)
            if pid <= 0:
                continue
            mem = info.get("memory_info")
            rss = int(mem.rss) if mem else 0
            read_b = write_b = 0
            try:
                io = proc.io_counters()
                read_b, write_b = int(io.read_bytes), int(io.write_bytes)
            except (psutil.Error, OSError, AttributeError):
                pass
            current[pid] = (read_b, write_b)
            prev = _io_prev.get(pid)
            rps = max(0, read_b - prev[0]) / dt if prev and dt else 0.0
            wps = max(0, write_b - prev[1]) / dt if prev and dt else 0.0
            name = info.get("name") or ""
            rows.append({
                "pid": pid,
                "process": name,
                "program_path": info.get("exe") or "",
                "status": info.get("status") or "",
                "memory_bytes": rss,
                "memory_percent": round(float(info.get("memory_percent") or 0), 1),
                "read_bytes_per_sec": round(rps),
                "write_bytes_per_sec": round(wps),
                "read_bytes_total": read_b,
                "write_bytes_total": write_b,
                "protected": _protected(pid, name),
            })
        except (psutil.Error, OSError):
            pass
    _io_prev, _io_prev_at = current, now
    return rows


def memory_snapshot():
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    standby = max(0, int(mem.available) - int(mem.free))
    apps = [p for p in _proc_rows() if p["memory_bytes"] >= 1024 * 1024]
    apps.sort(key=lambda p: p["memory_bytes"], reverse=True)
    return {
        "sampled_at": time.time(),
        "total_bytes": int(mem.total),
        "used_bytes": int(mem.used),
        "available_bytes": int(mem.available),
        "free_bytes": int(mem.free),
        "standby_bytes": standby,
        "used_percent": round(float(mem.percent), 1),
        "swap_total_bytes": int(swap.total),
        "swap_used_bytes": int(swap.used),
        "swap_free_bytes": int(swap.free),
        "swap_percent": round(float(swap.percent), 1),
        "apps": apps[:200],
    }


def _volume_space(mount: str):
    if sys.platform == "win32":
        import ctypes
        free_avail = ctypes.c_ulonglong()
        total = ctypes.c_ulonglong()
        total_free = ctypes.c_ulonglong()
        ok = ctypes.windll.kernel32.GetDiskFreeSpaceExW(
            str(mount), ctypes.byref(free_avail), ctypes.byref(total), ctypes.byref(total_free))
        if ok and total.value:
            used = int(total.value - total_free.value)
            return {
                "total_bytes": int(total.value),
                "used_bytes": used,
                "free_bytes": int(total_free.value),
                "available_bytes": int(free_avail.value),
                "percent": round(used / total.value * 100, 1),
            }
    usage = psutil.disk_usage(mount)
    return {
        "total_bytes": int(usage.total), "used_bytes": int(usage.used),
        "free_bytes": int(usage.free), "available_bytes": int(usage.free),
        "percent": round(float(usage.percent), 1),
    }


def disk_snapshot():
    global _disk_rate_prev, _disk_rate_at
    now = time.monotonic()
    volumes = []
    for part in psutil.disk_partitions(all=False):
        try:
            space = _volume_space(part.mountpoint)
        except (PermissionError, OSError):
            continue
        volumes.append({
            "device": part.device, "mountpoint": part.mountpoint, "filesystem": part.fstype, **space,
        })
    read_rate = write_rate = 0.0
    try:
        io = psutil.disk_io_counters(perdisk=False)
    except (psutil.Error, OSError):
        io = None
    if io and _disk_rate_prev and _disk_rate_at and now > _disk_rate_at:
        dt = now - _disk_rate_at
        read_rate = max(0, io.read_bytes - _disk_rate_prev.read_bytes) / dt
        write_rate = max(0, io.write_bytes - _disk_rate_prev.write_bytes) / dt
    if io:
        _disk_rate_prev, _disk_rate_at = io, now
    apps = [p for p in _proc_rows() if (p["read_bytes_per_sec"] + p["write_bytes_per_sec"]) > 0 or p["write_bytes_total"] > 0]
    apps.sort(key=lambda p: p["read_bytes_per_sec"] + p["write_bytes_per_sec"], reverse=True)
    return {
        "sampled_at": time.time(),
        "read_bytes_per_sec": round(read_rate),
        "write_bytes_per_sec": round(write_rate),
        "volumes": volumes,
        "apps": apps[:200],
    }


def _nvidia_adapters():
    exe = shutil.which("nvidia-smi")
    if not exe:
        return None
    query = ["--query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu", "--format=csv,noheader,nounits"]
    try:
        r = subprocess.run([exe, *query], capture_output=True, text=True, timeout=6,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except (OSError, subprocess.TimeoutExpired):
        return None
    if r.returncode != 0 or not r.stdout.strip():
        return None
    adapters = []
    for line in r.stdout.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 6:
            continue
        try:
            total, used, free, util = (float(parts[2]), float(parts[3]), float(parts[4]), float(parts[5]))
        except ValueError:
            continue
        mb = 1024 * 1024
        adapters.append({
            "name": parts[1] or f"GPU {parts[0]}",
            "usage_percent": round(util, 1),
            "memory_total_bytes": int(total * mb),
            "memory_used_bytes": int(used * mb),
            "memory_free_bytes": int(free * mb),
            "memory_available_bytes": int(free * mb),
            "shared_used_bytes": 0,
        })
    return adapters or None


_GPU_SCRIPT = r"""
$ErrorActionPreference = 'SilentlyContinue'
$samples = @(Get-Counter -Counter @(
  '\GPU Engine(*)\Utilization Percentage',
  '\GPU Process Memory(*)\Dedicated Usage',
  '\GPU Process Memory(*)\Shared Usage',
  '\GPU Adapter Memory(*)\Dedicated Usage',
  '\GPU Adapter Memory(*)\Shared Usage'
)).CounterSamples
$names = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name })
$rows = @()
foreach ($s in $samples) {
  $inst = [string]$s.InstanceName
  $rows += [pscustomobject]@{ path = [string]$s.Path; instance = $inst; value = [double]$s.CookedValue }
}
@{ names = @($names); samples = @($rows) } | ConvertTo-Json -Compress -Depth 4
"""


def _parse_gpu_payload(payload: dict) -> dict:
    names = [str(n) for n in (payload.get("names") or []) if n]
    adapters: dict[str, dict] = {}
    apps: dict[int, dict] = {}
    for sample in payload.get("samples") or []:
        inst = str(sample.get("instance") or "")
        path = str(sample.get("path") or "").lower()
        try:
            value = float(sample.get("value") or 0)
        except (TypeError, ValueError):
            continue
        luid = ""
        m = re.search(r"luid_(0x[0-9a-f]+_0x[0-9a-f]+)", inst, re.I)
        if m:
            luid = m.group(1).lower()
        pid_m = re.search(r"pid_(\d+)", inst, re.I)
        if "gpu adapter memory" in path and luid:
            slot = adapters.setdefault(luid, {"dedicated": 0, "shared": 0, "util": 0.0, "util_n": 0})
            if "dedicated usage" in path:
                slot["dedicated"] += value
            elif "shared usage" in path:
                slot["shared"] += value
        elif "gpu engine" in path and "utilization" in path and luid:
            slot = adapters.setdefault(luid, {"dedicated": 0, "shared": 0, "util": 0.0, "util_n": 0})
            if "engtype_3d" in inst.lower():
                slot["util"] += value
                slot["util_n"] += 1
        elif "gpu process memory" in path and pid_m:
            pid = int(pid_m.group(1))
            if pid <= 0:
                continue
            row = apps.setdefault(pid, {"dedicated": 0.0, "shared": 0.0, "util": 0.0})
            if "dedicated usage" in path:
                row["dedicated"] += value
            elif "shared usage" in path:
                row["shared"] += value
        elif "gpu engine" in path and "utilization" in path and pid_m:
            pid = int(pid_m.group(1))
            row = apps.setdefault(pid, {"dedicated": 0.0, "shared": 0.0, "util": 0.0})
            if "engtype_3d" in inst.lower():
                row["util"] = max(row["util"], value)
    adapter_rows = []
    for i, (_luid, slot) in enumerate(adapters.items()):
        util = (slot["util"] / slot["util_n"]) if slot["util_n"] else 0.0
        adapter_rows.append({
            "name": names[i] if i < len(names) else f"GPU {i}",
            "usage_percent": round(min(100.0, util), 1),
            "memory_total_bytes": 0,
            "memory_used_bytes": int(slot["dedicated"]),
            "memory_free_bytes": 0,
            "memory_available_bytes": 0,
            "shared_used_bytes": int(slot["shared"]),
        })
    app_rows = []
    for pid, row in apps.items():
        if row["dedicated"] < 1024 and row["shared"] < 1024 and row["util"] <= 0:
            continue
        try:
            proc = psutil.Process(pid)
            name = proc.name()
            path = proc.exe() or ""
        except (psutil.Error, OSError):
            name, path = f"PID {pid}", ""
        app_rows.append({
            "pid": pid, "process": name, "program_path": path,
            "usage_percent": round(row["util"], 1),
            "dedicated_bytes": int(row["dedicated"]),
            "shared_bytes": int(row["shared"]),
            "protected": _protected(pid, name),
        })
    app_rows.sort(key=lambda a: a["dedicated_bytes"] + a["shared_bytes"], reverse=True)
    return {"adapters": adapter_rows, "apps": app_rows[:200]}


def _windows_gpu():
    if sys.platform != "win32":
        return {"adapters": [], "apps": [], "note": "GPU counters are available on Windows."}
    try:
        r = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", _GPU_SCRIPT],
            capture_output=True, text=True, timeout=12,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except (OSError, subprocess.TimeoutExpired) as e:
        return {"adapters": [], "apps": [], "note": str(e)}
    raw = (r.stdout or "").strip()
    start = raw.find("{")
    if start < 0:
        return {"adapters": [], "apps": [], "note": (r.stderr or "GPU performance counters are not available on this PC.")[:300]}
    try:
        payload = json.loads(raw[start:])
    except json.JSONDecodeError:
        return {"adapters": [], "apps": [], "note": "Could not read GPU performance counters."}
    parsed = _parse_gpu_payload(payload if isinstance(payload, dict) else {})
    parsed["note"] = "" if parsed["adapters"] or parsed["apps"] else "No GPU engine counters were reported."
    return parsed


def gpu_snapshot():
    now = time.time()
    if _gpu_cache["data"] is not None and now - _gpu_cache["at"] < 3.0:
        return _gpu_cache["data"]
    nvidia = _nvidia_adapters()
    windows = _windows_gpu()
    adapters = nvidia or windows.get("adapters") or []
    if nvidia and windows.get("adapters"):
        for i, adapter in enumerate(adapters):
            extra = windows["adapters"][i] if i < len(windows["adapters"]) else None
            if extra and not adapter.get("usage_percent"):
                adapter["usage_percent"] = extra.get("usage_percent") or 0
            if extra:
                adapter["shared_used_bytes"] = extra.get("shared_used_bytes") or 0
    data = {
        "sampled_at": now,
        "source": "nvidia-smi" if nvidia else ("windows-counters" if adapters or windows.get("apps") else "none"),
        "note": "" if nvidia or windows.get("apps") else (windows.get("note") or "No GPU was detected."),
        "adapters": adapters,
        "apps": windows.get("apps") or [],
    }
    _gpu_cache["at"] = now
    _gpu_cache["data"] = data
    return data
