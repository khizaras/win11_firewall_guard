import sqlite3
from pathlib import Path
from datetime import datetime,timezone
class EventDB:
    def __init__(self,path):
        self.path=Path(path); self.path.parent.mkdir(parents=True,exist_ok=True)
        with self.connect() as c:
            c.execute("CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY,timestamp TEXT,category TEXT,summary TEXT,details TEXT)")
            c.execute("CREATE TABLE IF NOT EXISTS managed_rules(id INTEGER PRIMARY KEY,timestamp TEXT,policy_id TEXT,display_name TEXT UNIQUE,target_json TEXT,status TEXT)")
    def connect(self):
        c=sqlite3.connect(self.path,timeout=5); c.execute("PRAGMA journal_mode=WAL"); return c
    def log(self,cat,summary,details=""):
        with self.connect() as c: c.execute("INSERT INTO activity(timestamp,category,summary,details) VALUES(?,?,?,?)",
          (datetime.now(timezone.utc).isoformat(),str(cat),str(summary),str(details)))
    def add_rule(self,policy,name,target,status):
        with self.connect() as c: c.execute("INSERT OR IGNORE INTO managed_rules(timestamp,policy_id,display_name,target_json,status) VALUES(?,?,?,?,?)",
          (datetime.now(timezone.utc).isoformat(),policy,name,target,status))
    def rules(self):
        with self.connect() as c: return c.execute("SELECT timestamp,policy_id,display_name,target_json,status FROM managed_rules ORDER BY id DESC").fetchall()
    def recent_activity(self,limit=200):
        with self.connect() as c: return c.execute("SELECT timestamp,category,summary,details FROM activity ORDER BY id DESC LIMIT ?",(int(limit),)).fetchall()
