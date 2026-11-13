import psutil
from PySide6.QtCore import QObject, Signal, QTimer

def service_map():
    out={}
    if not hasattr(psutil,"win_service_iter"): return out
    try:
        for s in psutil.win_service_iter():
            try:
                d=s.as_dict(); pid=int(d.get("pid") or 0)
                if pid: out.setdefault(pid,[]).append(str(d.get("name") or ""))
            except (psutil.Error,OSError,ValueError): pass
    except (psutil.Error,OSError): pass
    return out

def collect_processes():
    sm=service_map(); out=[]
    for p in psutil.process_iter(["pid","name","exe","username","status"]):
        try:
            d=p.info; pid=int(d.get("pid") or 0)
            out.append({"pid":pid,"process":d.get("name") or "","program_path":d.get("exe") or "",
                        "username":d.get("username") or "","status":d.get("status") or "","services":sm.get(pid,[])})
        except (psutil.Error,OSError): pass
    return sorted(out,key=lambda x:(x["process"].casefold(),x["pid"]))

def collect_connections():
    sm=service_map(); out=[]
    try: conns=psutil.net_connections(kind="inet")
    except (psutil.AccessDenied,OSError): conns=[]
    for c in conns:
        if not c.raddr: continue
        pid=c.pid; name="Unknown / access denied"; exe=""; user=""
        if pid:
            try:
                p=psutil.Process(pid); name=p.name(); exe=p.exe() or ""; user=p.username() or ""
            except (psutil.Error,OSError): pass
        proto="TCP" if c.type==1 else "UDP" if c.type==2 else "Other"
        out.append({"pid":pid or 0,"process":name,"program_path":exe,"username":user,"services":sm.get(pid,[]) if pid else [],
          "protocol":proto,"local_address":f"{c.laddr.ip}:{c.laddr.port}" if c.laddr else "",
          "remote_ip":c.raddr.ip,"remote_port":c.raddr.port,"remote_address":f"{c.raddr.ip}:{c.raddr.port}",
          "state":getattr(c,"status","") or "N/A","direction":"outbound"})
    return sorted(out,key=lambda x:(x["process"].casefold(),x["remote_address"]))

class NetworkMonitor(QObject):
    updated=Signal(list)
    processes_updated=Signal(list)
    def __init__(self,seconds=3,parent=None):
        super().__init__(parent); self.timer=QTimer(self); self.timer.setInterval(max(1000,int(seconds*1000))); self.timer.timeout.connect(self.refresh)
    def start(self): self.refresh(); self.timer.start()
    def stop(self): self.timer.stop()
    def refresh(self): self.updated.emit(collect_connections()); self.processes_updated.emit(collect_processes())
