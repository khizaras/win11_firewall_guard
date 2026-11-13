"""Queue bridge to the elevated fgf-broker.ps1 worker.

The backend (unprivileged) drops JSON command files into backend/data/broker/queue/.
The elevated worker (started once via UAC) picks them up, executes the op and writes
<id>.ack with the result. A heartbeat file tells us the worker is alive.
"""
import json, os, time, uuid
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / "data" / "broker"
QUEUE = BASE / "queue"
ACKS = BASE / "acks"
HEARTBEAT = BASE / "heartbeat.json"


def ensure_dirs():
    for d in (BASE, QUEUE, ACKS):
        d.mkdir(parents=True, exist_ok=True)


def clear_pending():
    ensure_dirs()
    for d in (QUEUE, ACKS):
        for p in d.glob("*"):
            try: p.unlink()
            except OSError: pass


def broker_alive(max_age=8.0):
    try:
        hb = json.loads(HEARTBEAT.read_text(encoding="utf-8-sig"))
        age = time.time() - float(hb.get("ts", 0))
        return age <= max_age, {"pid": hb.get("pid"), "age": round(age, 1), "started": hb.get("started"), "version": hb.get("version", 1)}
    except (OSError, ValueError):
        return False, None


def write_command(op, payload, timeout=90):
    ensure_dirs()
    cid = f"{op}-{uuid.uuid4().hex[:8]}"
    cmd = QUEUE / f"{cid}.cmd.json"
    cmd.write_text(json.dumps({"id": cid, "op": op, "payload": payload, "created": time.time()}), encoding="utf-8")
    ack_path = ACKS / f"{cid}.ack.json"
    deadline = time.time() + timeout
    while time.time() < deadline and not ack_path.exists():
        time.sleep(0.3)
    if not ack_path.exists():
        try: cmd.unlink()
        except OSError: pass
        return {"status": "timeout", "id": cid, "operation": op}
    try:
        result = json.loads(ack_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        result = {"status": "ack_unreadable", "id": cid, "operation": op}
    try: ack_path.unlink()
    except OSError: pass
    result.setdefault("id", cid)
    result["operation"] = op
    return result


def read_state(etl_name_default="fgf_net.etl"):
    ensure_dirs()
    return {"dir": str(BASE), "etl": str(BASE / etl_name_default)}
