import sqlite3
from pathlib import Path
from datetime import datetime,timezone
class Store:
 def __init__(self,path):
  self.path=Path(path);self.path.parent.mkdir(parents=True,exist_ok=True)
  with self.db() as c:
   c.execute("CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY,ts TEXT,category TEXT,summary TEXT,details TEXT)")
   c.execute("CREATE TABLE IF NOT EXISTS rules(id INTEGER PRIMARY KEY,ts TEXT,policy_id TEXT,name TEXT UNIQUE,target TEXT,status TEXT)")
   c.execute("CREATE TABLE IF NOT EXISTS domain_patterns(id INTEGER PRIMARY KEY AUTOINCREMENT,pattern TEXT UNIQUE,enabled INTEGER DEFAULT 1,created TEXT,last_applied TEXT)")
 def db(self):
  c=sqlite3.connect(self.path,timeout=5);c.execute("PRAGMA journal_mode=WAL");return c
 def log(self,cat,summary,details=""):
  with self.db() as c:c.execute("INSERT INTO activity(ts,category,summary,details) VALUES(?,?,?,?)",(datetime.now(timezone.utc).isoformat(),cat,summary,details))
 def add_rule(self,policy,name,target,status="created"):
  with self.db() as c:c.execute("INSERT OR IGNORE INTO rules(ts,policy_id,name,target,status) VALUES(?,?,?,?,?)",(datetime.now(timezone.utc).isoformat(),policy,name,target,status))
 def rules(self):
  with self.db() as c:return [dict(created=a,policy_id=b,name=n,target=t,status=s) for a,b,n,t,s in c.execute("SELECT ts,policy_id,name,target,status FROM rules ORDER BY id DESC")]
 def activity(self,limit=100):
  with self.db() as c:return [dict(time=a,category=b,summary=s,details=d) for a,b,s,d in c.execute("SELECT ts,category,summary,details FROM activity ORDER BY id DESC LIMIT ?",(limit,))]
 def set_status(self,name,status):
  with self.db() as c:c.execute("UPDATE rules SET status=? WHERE name=?",(status,name))
 def domain_patterns(self):
  with self.db() as c:return [dict(id=i,pattern=p,enabled=bool(e),created=t,last_applied=a) for i,p,e,t,a in c.execute("SELECT id,pattern,enabled,created,last_applied FROM domain_patterns ORDER BY id DESC")]
 def add_pattern(self,pattern,enabled=True):
  with self.db() as c:
   c.execute("INSERT OR IGNORE INTO domain_patterns(pattern,enabled,created) VALUES(?,?,?)",(pattern,1 if enabled else 0,datetime.now(timezone.utc).isoformat()))
   row=c.execute("SELECT id,pattern,enabled,created FROM domain_patterns WHERE pattern=?",(pattern,)).fetchone()
   return dict(id=row[0],pattern=row[1],enabled=bool(row[2]),created=row[3],last_applied=None) if row else None
 def set_pattern_enabled(self,pid:int,enabled:bool):
  with self.db() as c:c.execute("UPDATE domain_patterns SET enabled=? WHERE id=?",(1 if enabled else 0,pid))
 def delete_pattern(self,pid:int):
  with self.db() as c:c.execute("DELETE FROM domain_patterns WHERE id=?",(pid,))
 def touch_applied(self,pid:int):
  with self.db() as c:c.execute("UPDATE domain_patterns SET last_applied=? WHERE id=?",(datetime.now(timezone.utc).isoformat(),pid))
