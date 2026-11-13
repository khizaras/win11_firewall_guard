import fnmatch, json, os
from pathlib import Path
from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (QMainWindow,QWidget,QVBoxLayout,QHBoxLayout,QLabel,QPushButton,QTabWidget,
 QTableWidget,QTableWidgetItem,QMessageBox,QCheckBox,QGroupBox,QHeaderView,QLineEdit,QInputDialog)
from core.monitor import NetworkMonitor
from core.audit_reader import read_firewall_events
from core.policy_engine import policy_matches,policy_target,validate_policy
from core.firewall_controller import create_block_rule,delete_owned_rule
from database.db import EventDB

def match_filter(text,pattern):
    return fnmatch.fnmatchcase(str(text or "").casefold(),str(pattern or "*").casefold())

class MainWindow(QMainWindow):
 def __init__(self,root):
  super().__init__(); self.root=root; cfg=root/"config"
  self.settings_path=cfg/"settings.json"; self.policies_path=cfg/"policies.json"
  for dst,src in [(self.settings_path,cfg/"settings.example.json"),(self.policies_path,cfg/"policies.example.json")]:
   if not dst.exists(): dst.write_text(src.read_text(encoding="utf-8"),encoding="utf-8")
  self.settings=self.load_json(self.settings_path,{}); self.policies=self.load_json(self.policies_path,{"policies":[]})
  dbp=Path(self.settings.get("database_path","data/firewall_guard_pro.db"))
  if not dbp.is_absolute(): dbp=root/dbp
  self.db=EventDB(dbp); self.connections=[]; self.processes=[]; self.events=[]; self.enforced=set()
  self.setWindowTitle("Windows Firewall Guard Pro"); self.resize(1380,820); self.setMinimumSize(1000,620)
  self.build_ui()
  self.monitor=NetworkMonitor(self.settings.get("poll_interval_seconds",3),self)
  self.monitor.updated.connect(self.on_connections); self.monitor.processes_updated.connect(self.on_processes); self.monitor.start()
  self.audit_timer=QTimer(self); self.audit_timer.setInterval(max(5000,int(self.settings.get("audit_refresh_interval_seconds",20)*1000)))
  self.audit_timer.timeout.connect(self.refresh_audit); self.audit_timer.start(); QTimer.singleShot(800,self.refresh_audit)
 def load_json(self,path,fallback):
  try: return json.loads(Path(path).read_text(encoding="utf-8"))
  except (OSError,json.JSONDecodeError): return fallback
 def table(self,headers):
  t=QTableWidget(0,len(headers)); t.setHorizontalHeaderLabels(headers); t.setAlternatingRowColors(True)
  t.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers); t.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
  t.verticalHeader().setVisible(False); t.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents); t.horizontalHeader().setStretchLastSection(True)
  return t
 def metric(self,label):
  g=QGroupBox(label); l=QVBoxLayout(g); v=QLabel("0"); v.setStyleSheet("font-size:25px;font-weight:700;color:#155eef"); l.addWidget(v); g.value=v; return g
 def build_ui(self):
  central=QWidget(); outer=QVBoxLayout(central); header=QHBoxLayout(); titlebox=QVBoxLayout()
  title=QLabel("Windows Firewall Guard Pro"); title.setStyleSheet("font-size:25px;font-weight:700;color:#14213d")
  subtitle=QLabel("Wildcard process discovery · Service-aware controls · Windows Defender Firewall"); subtitle.setStyleSheet("color:#64748b")
  titlebox.addWidget(title); titlebox.addWidget(subtitle); header.addLayout(titlebox); header.addStretch()
  self.pill=QLabel("DRY RUN" if self.settings.get("dry_run",True) else "LIVE ENFORCEMENT")
  self.pill.setStyleSheet("background:#e0f2fe;color:#075985;padding:8px 12px;font-weight:700;border-radius:6px"); header.addWidget(self.pill)
  refresh=QPushButton("Refresh now"); refresh.clicked.connect(self.refresh_all); header.addWidget(refresh); outer.addLayout(header)
  tabs=QTabWidget(); outer.addWidget(tabs); self.setCentralWidget(central)
  self.overview=QWidget(); self.proc_tab=QWidget(); self.conn_tab=QWidget(); self.policy_tab=QWidget(); self.event_tab=QWidget(); self.rules_tab=QWidget()
  for w,n in [(self.overview,"Overview"),(self.proc_tab,"Processes & Services"),(self.conn_tab,"Connections"),(self.policy_tab,"Policies"),(self.event_tab,"Firewall Events"),(self.rules_tab,"Managed Rules")]: tabs.addTab(w,n)
  l=QVBoxLayout(self.overview); cards=QHBoxLayout()
  self.m_conn=self.metric("Active connections"); self.m_proc=self.metric("Visible processes"); self.m_policy=self.metric("Enabled policies"); self.m_rules=self.metric("Managed rules"); self.m_events=self.metric("Windows events")
  for x in [self.m_conn,self.m_proc,self.m_policy,self.m_rules,self.m_events]: cards.addWidget(x)
  l.addLayout(cards); group=QGroupBox("Enforcement safety"); gl=QVBoxLayout(group)
  gl.addWidget(QLabel("Automatic rules use explicit selectors. Dry-run records matches without changing the firewall. Live changes require UAC approval."))
  self.dry=QCheckBox("Dry-run mode (recommended until policies are verified)"); self.dry.setChecked(bool(self.settings.get("dry_run",True))); self.dry.stateChanged.connect(self.change_dry); gl.addWidget(self.dry); l.addWidget(group)
  l.addWidget(QLabel("Recent activity")); self.activity=self.table(["Time","Category","Summary"]); l.addWidget(self.activity)
  # Process inventory and wildcard search
  pl=QVBoxLayout(self.proc_tab); pl.addWidget(QLabel("Wildcard search is case-insensitive: chrome*, *updater*, python?.exe."))
  self.proc_filter=QLineEdit(); self.proc_filter.setPlaceholderText("Process, path, service, PID or username pattern"); self.proc_filter.setText("*"); self.proc_filter.textChanged.connect(self.render_processes); pl.addWidget(self.proc_filter)
  self.proc_table=self.table(["PID","Process","Service names","Status","Username","Executable"]); pl.addWidget(self.proc_table)
  row=QHBoxLayout(); bp=QPushButton("Block outbound for process"); bp.clicked.connect(self.block_process); bs=QPushButton("Block outbound for service"); bs.clicked.connect(self.block_service)
  row.addWidget(bp); row.addWidget(bs); row.addStretch(); pl.addLayout(row)
  # Connection table
  cl=QVBoxLayout(self.conn_tab); cl.addWidget(QLabel("Connection snapshots. Service/process metadata can be unavailable when Windows denies access."))
  self.conn_filter=QLineEdit(); self.conn_filter.setPlaceholderText("Wildcard filter across process, service, endpoint, protocol, path"); self.conn_filter.setText("*"); self.conn_filter.textChanged.connect(self.render_connections); cl.addWidget(self.conn_filter)
  self.conn_table=self.table(["PID","Process","Services","Protocol","Local endpoint","Remote endpoint","State","Executable"]); cl.addWidget(self.conn_table)
  ipbtn=QPushButton("Block outbound to selected remote IP"); ipbtn.clicked.connect(self.block_remote_ip); cl.addWidget(ipbtn)
  # Policies
  ql=QVBoxLayout(self.policy_tab); ql.addWidget(QLabel("Edit config/policies.json. Wildcard process/service patterns are supported. Reload after editing."))
  self.policy_table=self.table(["ID","Name","Enabled","Automatic","Direction","Selectors","Validation"]); ql.addWidget(self.policy_table)
  qrow=QHBoxLayout(); rp=QPushButton("Reload policies"); rp.clicked.connect(self.reload_policies); op=QPushButton("Open policies.json"); op.clicked.connect(self.open_policies)
  qrow.addWidget(rp); qrow.addWidget(op); qrow.addStretch(); ql.addLayout(qrow)
  # Event viewer
  el=QVBoxLayout(self.event_tab); el.addWidget(QLabel("Windows Firewall and Filtering Platform audit events, when available."))
  self.event_filter=QLineEdit(); self.event_filter.setPlaceholderText("Wildcard filter events, e.g. *5157*"); self.event_filter.setText("*"); self.event_filter.textChanged.connect(self.render_events); el.addWidget(self.event_filter)
  self.event_table=self.table(["Time","Event ID","Provider","Level","Message"]); el.addWidget(self.event_table)
  eb=QPushButton("Refresh events"); eb.clicked.connect(self.refresh_audit); el.addWidget(eb)
  # Managed rules
  rl=QVBoxLayout(self.rules_tab); rl.addWidget(QLabel("Only rules created by this application are shown."))
  self.rule_filter=QLineEdit(); self.rule_filter.setPlaceholderText("Wildcard filter managed rules"); self.rule_filter.setText("*"); self.rule_filter.textChanged.connect(self.populate_rules); rl.addWidget(self.rule_filter)
  self.rule_table=self.table(["Created","Policy","Rule name","Target","Status"]); rl.addWidget(self.rule_table)
  rr=QHBoxLayout(); rrf=QPushButton("Refresh"); rrf.clicked.connect(self.populate_rules); rm=QPushButton("Remove selected rule"); rm.clicked.connect(self.remove_rule)
  rr.addWidget(rrf); rr.addWidget(rm); rr.addStretch(); rl.addLayout(rr)
  self.setStyleSheet("""
  QMainWindow,QWidget{background:#f5f7fb;color:#1f2937;font-size:13px}
  QTabWidget::pane{border:1px solid #dbe2ea;background:white;border-radius:7px}
  QTabBar::tab{background:#e9eef5;padding:10px 14px;margin-right:2px}
  QTabBar::tab:selected{background:white;color:#1457b8;font-weight:700}
  QTableWidget,QLineEdit{background:white;border:1px solid #d8e0ea;border-radius:5px;gridline-color:#edf1f6}
  QHeaderView::section{background:#edf2f7;padding:6px;border:0;font-weight:700}
  QPushButton{background:#155eef;color:white;border:0;border-radius:5px;padding:8px 12px;font-weight:600}
  QPushButton:hover{background:#104ec8}
  QGroupBox{background:white;border:1px solid #dbe2ea;border-radius:7px;margin-top:10px;padding:10px}
  """)
  self.populate_policies(); self.populate_rules(); self.refresh_activity()
 def change_dry(self,state):
  new=state==Qt.CheckState.Checked.value
  if not new:
   ans=QMessageBox.warning(self,"Enable live enforcement?","Automatic policies may create Windows Firewall block rules. Continue only after dry-run testing.",QMessageBox.StandardButton.Yes|QMessageBox.StandardButton.Cancel,QMessageBox.StandardButton.Cancel)
   if ans!=QMessageBox.StandardButton.Yes:
    self.dry.blockSignals(True); self.dry.setChecked(True); self.dry.blockSignals(False); return
  self.settings["dry_run"]=new; self.settings_path.write_text(json.dumps(self.settings,indent=2),encoding="utf-8")
  self.pill.setText("DRY RUN" if new else "LIVE ENFORCEMENT"); self.db.log("settings","Dry-run changed",str(new))
 def on_processes(self,rows): self.processes=rows; self.render_processes(); self.m_proc.value.setText(str(len(rows)))
 def render_processes(self):
  if not hasattr(self,"proc_table"): return
  pattern=self.proc_filter.text() or "*"; rows=[]
  for p in self.processes:
   fields=[p.get("pid"),p.get("process"),p.get("program_path"),p.get("username"),*p.get("services",[])]
   if any(match_filter(x,pattern) for x in fields): rows.append(p)
  self.proc_table.setSortingEnabled(False); self.proc_table.setRowCount(0)
  for p in rows:
   vals=[p["pid"],p["process"],", ".join(p.get("services",[])),p["status"],p["username"],p["program_path"]]
   r=self.proc_table.rowCount(); self.proc_table.insertRow(r)
   for j,v in enumerate(vals): self.proc_table.setItem(r,j,QTableWidgetItem(str(v)))
  self.proc_table.setSortingEnabled(True)
 def on_connections(self,rows): self.connections=rows; self.render_connections(); self.m_conn.value.setText(str(len(rows))); self.evaluate(rows)
 def render_connections(self):
  if not hasattr(self,"conn_table"): return
  pattern=self.conn_filter.text() or "*"; rows=[]
  for c in self.connections:
   fields=[c.get("pid"),c.get("process"),*c.get("services",[]),c.get("protocol"),c.get("local_address"),c.get("remote_address"),c.get("program_path")]
   if any(match_filter(x,pattern) for x in fields): rows.append(c)
  self.conn_table.setSortingEnabled(False); self.conn_table.setRowCount(0)
  for c in rows:
   vals=[c["pid"],c["process"],", ".join(c.get("services",[])),c["protocol"],c["local_address"],c["remote_address"],c["state"],c["program_path"]]
   r=self.conn_table.rowCount(); self.conn_table.insertRow(r)
   for j,v in enumerate(vals): self.conn_table.setItem(r,j,QTableWidgetItem(str(v)))
  self.conn_table.setSortingEnabled(True)
 def selected_process(self):
  r=self.proc_table.currentRow()
  if r<0:return None
  try: pid=int(self.proc_table.item(r,0).text())
  except (ValueError,AttributeError):return None
  return next((p for p in self.processes if p["pid"]==pid),None)
 def create_manual_rule(self,target,description):
  answer=QMessageBox.warning(self,"Create outbound block rule",description+"\n\nThis changes Windows Defender Firewall. Existing connections may not close immediately.",QMessageBox.StandardButton.Yes|QMessageBox.StandardButton.Cancel,QMessageBox.StandardButton.Cancel)
  if answer!=QMessageBox.StandardButton.Yes:return
  try:
   name=create_block_rule(target,"manual"); self.db.add_rule("manual",name,json.dumps(target),"created")
   self.db.log("firewall_rule","Manual block created",name+" | "+json.dumps(target)); self.populate_rules(); self.refresh_activity()
   QMessageBox.information(self,"Rule created",f"Created firewall rule:\n{name}")
  except Exception as e:
   self.db.log("firewall_error","Manual block failed",str(e)); QMessageBox.warning(self,"Firewall rule failed",str(e))
 def block_process(self):
  p=self.selected_process()
  if not p: QMessageBox.information(self,"Select process","Select a process row first."); return
  path=p.get("program_path","")
  if not path.lower().endswith(".exe"): QMessageBox.warning(self,"Path unavailable","No usable executable path is available for this process."); return
  self.create_manual_rule({"direction":"Outbound","protocol":"Any","program_path":path},f"Block outbound traffic for {p['process']} (PID {p['pid']}) by executable path?")
 def block_service(self):
  p=self.selected_process()
  if not p: QMessageBox.information(self,"Select service","Select a process row associated with a service."); return
  services=p.get("services",[])
  if not services: QMessageBox.warning(self,"No service","No Windows service is associated with this process."); return
  service=services[0]
  if len(services)>1:
   service,ok=QInputDialog.getItem(self,"Choose service","Service:",services,0,False)
   if not ok:return
  target={"direction":"Outbound","protocol":"Any","service_name":service}
  if p.get("program_path","").lower().endswith(".exe"): target["program_path"]=p["program_path"]
  self.create_manual_rule(target,f"Block outbound traffic for Windows service '{service}'?")
 def block_remote_ip(self):
  r=self.conn_table.currentRow()
  if r<0: QMessageBox.information(self,"Select connection","Select a connection row first."); return
  pid=self.conn_table.item(r,0).text(); remote=self.conn_table.item(r,5).text()
  c=next((x for x in self.connections if str(x.get("pid",""))==pid and x.get("remote_address")==remote),None)
  if c:self.create_manual_rule({"direction":"Outbound","protocol":"Any","remote_ip":c["remote_ip"]},f"Block outbound traffic to {c['remote_ip']} for all applications?")
 def populate_policies(self):
  self.policy_table.setSortingEnabled(False); self.policy_table.setRowCount(0)
  for p in self.policies.get("policies",[]):
   sels=[]
   for k in ("process_name_patterns","service_name_patterns","program_paths","remote_ips","remote_ports"):sels.extend(map(str,p.get(k,[])))
   errors=validate_policy(p) if p.get("enabled") else []
   vals=[p.get("id",""),p.get("name",""),p.get("enabled",False),p.get("automatic",False),p.get("direction","outbound"),", ".join(sels) or "(none)","; ".join(errors) or ("Ready" if p.get("enabled") else "Disabled")]
   r=self.policy_table.rowCount(); self.policy_table.insertRow(r)
   for j,v in enumerate(vals):self.policy_table.setItem(r,j,QTableWidgetItem(str(v)))
  self.policy_table.setSortingEnabled(True);self.m_policy.value.setText(str(sum(bool(p.get("enabled")) for p in self.policies.get("policies",[]))))
 def reload_policies(self):
  self.policies=self.load_json(self.policies_path,{"policies":[]});self.enforced.clear();self.populate_policies()
 def open_policies(self):
  try:os.startfile(str(self.policies_path))
  except Exception as e:QMessageBox.warning(self,"Open failed",str(e))
 def evaluate(self,rows):
  for p in self.policies.get("policies",[]):
   if not p.get("enabled") or not p.get("automatic"):continue
   errors=validate_policy(p)
   if errors:self.db.log("policy_error",p.get("id","?"),"; ".join(errors));continue
   for c in rows:
    if not policy_matches(p,c):continue
    target=policy_target(p,c)
    if not any((target.get("remote_ip"),target.get("remote_port"),target.get("program_path"),target.get("service_name"))):
     self.db.log("policy_error","Matched policy lacks enforceable target",p.get("id",""));continue
    key=(p["id"],json.dumps(target,sort_keys=True))
    if key in self.enforced:continue
    self.enforced.add(key);summary=f'{p.get("name",p["id"])} -> {target}'
    if self.settings.get("dry_run",True):self.db.log("dry_run","Would create block rule",summary);continue
    try:
     name=create_block_rule(target,p["id"]);self.db.add_rule(p["id"],name,json.dumps(target),"created");self.db.log("firewall_rule","Automatic block created",name+" | "+summary)
    except Exception as e:self.db.log("firewall_error","Automatic rule failed",str(e))
  self.populate_rules();self.refresh_activity()
 def refresh_audit(self):self.events=read_firewall_events(self.settings.get("max_events",200));self.render_events();self.m_events.value.setText(str(len(self.events)))
 def render_events(self):
  if not hasattr(self,"event_table"):return
  pat=self.event_filter.text() or "*";self.event_table.setRowCount(0)
  for e in self.events:
   vals=[e["time"],e["event_id"],e["provider"],e["level"],e["message"]]
   if not any(match_filter(v,pat) for v in vals):continue
   r=self.event_table.rowCount();self.event_table.insertRow(r)
   for j,v in enumerate(vals):
    it=QTableWidgetItem(str(v));it.setToolTip(str(v));self.event_table.setItem(r,j,it)
 def populate_rules(self):
  if not hasattr(self,"rule_table"):return
  pat=self.rule_filter.text() if hasattr(self,"rule_filter") else "*";rows=self.db.rules();self.rule_table.setRowCount(0)
  for created,policy,name,target,status in rows:
   vals=[created,policy,name,target,status]
   if not any(match_filter(v,pat) for v in vals):continue
   r=self.rule_table.rowCount();self.rule_table.insertRow(r)
   for j,v in enumerate(vals):self.rule_table.setItem(r,j,QTableWidgetItem(str(v)))
  self.m_rules.value.setText(str(len(rows)))
 def remove_rule(self):
  r=self.rule_table.currentRow()
  if r<0:QMessageBox.information(self,"Select rule","Select a managed rule.");return
  name=self.rule_table.item(r,2).text()
  ans=QMessageBox.warning(self,"Remove rule",f"Remove app-owned rule {name}?",QMessageBox.StandardButton.Yes|QMessageBox.StandardButton.Cancel,QMessageBox.StandardButton.Cancel)
  if ans!=QMessageBox.StandardButton.Yes:return
  try:
   delete_owned_rule(name)
   with self.db.connect() as c:c.execute("UPDATE managed_rules SET status='removed' WHERE display_name=?",(name,))
   self.db.log("firewall_rule","Removed managed rule",name);self.populate_rules();self.refresh_activity()
  except Exception as e:QMessageBox.warning(self,"Remove failed",str(e))
 def refresh_activity(self):
  self.activity.setRowCount(0)
  for ts,cat,summary,details in self.db.recent_activity(self.settings.get("max_events",200))[:100]:
   r=self.activity.rowCount();self.activity.insertRow(r)
   for j,v in enumerate([ts,cat,summary]):self.activity.setItem(r,j,QTableWidgetItem(str(v)))
 def refresh_all(self):
  self.monitor.refresh();self.refresh_audit();self.populate_rules();self.refresh_activity()
