import json,secrets,sys,subprocess,re,asyncio,os,time
from pathlib import Path
from fastapi import FastAPI,Header,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel,Field
from .monitor import processes,connections,services,metrics
from .firewall import create_rule,remove_rule,validate_target,inspect_rule,create_rules_batch,remove_rules_batch,elevated
from . import enrich,broker,traffic
from .store import Store
BASE=Path(__file__).resolve().parents[1]
CONFIG_PATH=BASE/"config"/"settings.json"
def read_json(name,default):
 try:return json.loads((BASE/"config"/name).read_text(encoding="utf-8"))
 except (OSError,json.JSONDecodeError):return default
CFG=read_json("settings.json",{"dry_run":True,"api_token":"dev-token-change-me","database_path":"data/firewall_guard.db"})
MAX_BATCH=50
DB=Store((BASE/CFG.get("database_path","data/firewall_guard.db")).resolve())
app=FastAPI(title="Firewall Guard Fluent API",version="1.1")
app.add_middleware(CORSMiddleware,allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],allow_methods=["GET","POST","DELETE"],allow_headers=["Authorization","Content-Type"])
class RuleRequest(BaseModel):
 target:dict
 reason:str=Field(default="manual",max_length=200)
class BatchRuleRequest(BaseModel):
 targets:list[dict]=Field(max_length=MAX_BATCH)
 policy:str=Field(default="manual",max_length=64)
class BatchRemoveRequest(BaseModel):
 names:list[str]=Field(max_length=MAX_BATCH)
class DryRequest(BaseModel): enabled:bool
class PatternRequest(BaseModel): pattern:str=Field(max_length=120)
class PatternEnabledRequest(BaseModel): enabled:bool
class CaptureRequest(BaseModel): on:bool
def auth(value):
 if not secrets.compare_digest(value or "","Bearer "+str(CFG.get("api_token",""))):raise HTTPException(401,"Invalid local API token")
@app.get("/api/health")
def health():return {"status":"ok","dry_run":CFG.get("dry_run",False),"platform":sys.platform}
@app.get("/api/overview")
def overview(authorization:str|None=Header(default=None)):
 auth(authorization);p=processes();c=connections();pol=read_json("policies.json",{"policies":[]}).get("policies",[])
 return {"process_count":len(p),"connection_count":len(c),"enabled_policies":sum(bool(x.get("enabled")) for x in pol),"managed_rules":sum(x["status"]=="created" for x in DB.rules()),"dry_run":CFG.get("dry_run",True),"profiles":enrich.firewall_profiles()}
@app.get("/api/processes")
def get_processes(authorization:str|None=Header(default=None)):auth(authorization);return processes()
@app.get("/api/processes/{pid}")
def get_process_detail(pid:int,authorization:str|None=Header(default=None)):
 auth(authorization)
 try:return enrich.process_detail(pid)
 except Exception as e:raise HTTPException(400,str(e))
@app.get("/api/services")
def get_services(authorization:str|None=Header(default=None)):auth(authorization);return services()
@app.get("/api/metrics")
def get_metrics(authorization:str|None=Header(default=None)):auth(authorization);return metrics()
@app.get("/api/connections")
def get_connections(show_listeners:bool=False,family:str|None=None,authorization:str|None=Header(default=None)):
 auth(authorization);return connections(show_listeners=show_listeners,address_family=family or "all")
@app.get("/api/policies")
def get_policies(authorization:str|None=Header(default=None)):
 auth(authorization);return read_json("policies.json",{"policies":[]}).get("policies",[])
@app.get("/api/rules")
def get_rules(authorization:str|None=Header(default=None)):auth(authorization);return DB.rules()
@app.get("/api/activity")
def get_activity(authorization:str|None=Header(default=None)):auth(authorization);return DB.activity(200)
@app.get("/api/firewall/profiles")
def get_firewall_profiles(authorization:str|None=Header(default=None)):
 auth(authorization)
 try:return enrich.firewall_profiles()
 except Exception as e:raise HTTPException(500,str(e))
@app.get("/api/firewall/rules")
def get_firewall_rules(enabled_only:bool=True,action:str="all",limit:int=400,authorization:str|None=Header(default=None)):
 auth(authorization)
 try:return enrich.firewall_rules(enabled_only=enabled_only,action=action,limit=limit)
 except Exception as e:raise HTTPException(500,str(e))
@app.get("/api/events")
def get_events(authorization:str|None=Header(default=None),limit:int=200,since:str|None=None):
 auth(authorization)
 return traffic.query_events(limit=limit,since=since)
@app.post("/api/rules")
def post_rule(req:RuleRequest,authorization:str|None=Header(default=None)):
 auth(authorization)
 try:t=validate_target(req.target)
 except (ValueError,TypeError) as e:raise HTTPException(400,str(e))
 if CFG.get("dry_run",False):
  DB.log("dry_run","Would create block rule",json.dumps(t));return {"status":"dry_run","target":t}
 try:
  name=create_rule(t);DB.add_rule("manual",name,json.dumps(t));DB.log("firewall_rule","Rule created and verified",name+" "+json.dumps(t));return {"status":"created_verified","name":name,"target":t,"verified":True}
 except Exception as e:DB.log("firewall_error","Rule creation failed",str(e));raise HTTPException(500,str(e))
@app.post("/api/rules/batch")
def post_rules_batch(req:BatchRuleRequest,authorization:str|None=Header(default=None)):
 auth(authorization)
 items=[]
 if CFG.get("dry_run",False):
  for raw in req.targets:
   try:t=validate_target(raw)
   except (ValueError,TypeError) as e:items.append({"target":raw,"status":"invalid","error":str(e)});continue
   DB.log("dry_run","Would create block rule",json.dumps(t));items.append({"target":t,"status":"dry_run"})
  return {"dry_run":True,"success":sum(i["status"]=="dry_run" for i in items),"items":items}
 try:
  res=create_rules_batch(req.targets,req.policy)
 except Exception as e:
  DB.log("firewall_error","Batch creation failed",str(e));raise HTTPException(500,str(e))
 if res.get("error"):raise HTTPException(500,res["error"])
 for it in res.get("items",[]):
  if it.get("status")=="created_verified":
   DB.add_rule(req.policy,it["name"],json.dumps(it["target"]))
   DB.log("firewall_rule","Batch rule created and verified",it["name"]+" "+json.dumps(it["target"]))
  elif it.get("status")=="invalid":
   DB.log("dry_run","Batch target rejected",json.dumps(it["target"]))
  elif it.get("status")=="failed":
   DB.log("firewall_error","Batch rule failed",it.get("name","?")+" "+str(it.get("error")))
 return res
@app.post("/api/rules/delete-batch")
def delete_rules_batch(req:BatchRemoveRequest,authorization:str|None=Header(default=None)):
 auth(authorization)
 try:res=remove_rules_batch(req.names)
 except Exception as e:raise HTTPException(500,str(e))
 if res.get("error"):raise HTTPException(500,res["error"])
 for it in res.get("items",[]):
  if it.get("status")=="removed_verified":
   DB.set_status(it["name"],"removed");DB.log("firewall_rule","Batch rule removed and verified",it["name"])
  elif it.get("status")=="failed":
   DB.log("firewall_error","Batch removal failed",it.get("name","?")+" "+str(it.get("error")))
 return res
@app.delete("/api/rules/{name}")
def delete_rule(name:str,authorization:str|None=Header(default=None)):
 auth(authorization)
 try:remove_rule(name);DB.set_status(name,"removed");DB.log("firewall_rule","Rule removed and verified",name);return {"status":"removed_verified","verified":True}
 except Exception as e:raise HTTPException(400,str(e))
@app.get("/api/settings")
def get_settings(authorization:str|None=Header(default=None)):
 auth(authorization);return {"dry_run":bool(CFG.get("dry_run",False)),"live_enforcement":not bool(CFG.get("dry_run",False)),"poll_interval_seconds":int(CFG.get("poll_interval_seconds",3))}
@app.post("/api/dry-run")
def dry_run(req:DryRequest,authorization:str|None=Header(default=None)):
 auth(authorization)
 CFG["dry_run"]=req.enabled
 CONFIG_PATH.write_text(json.dumps(CFG,indent=2)+"\n",encoding="utf-8")
 DB.log("settings","Dry-run changed","enabled" if req.enabled else "disabled; live enforcement enabled")
 return {"dry_run":CFG["dry_run"],"live_enforcement":not CFG["dry_run"]}
@app.get("/api/rules/{name}/verify")
def verify_rule(name:str,authorization:str|None=Header(default=None)):
 auth(authorization)
 try:return inspect_rule(name)
 except Exception as e:raise HTTPException(400,str(e))

# ---------------- traffic inspector ----------------
@app.get("/api/traffic")
def get_traffic(include_listeners:bool=False,authorization:str|None=Header(default=None)):
 auth(authorization)
 rows=traffic.traffic_rows(show_listeners=include_listeners)
 alive,binfo=broker.broker_alive()
 audit=enrich.audit_state()
 return {"count":len(rows),"rows":rows[:1500],"audit":audit,"broker":{"alive":alive,"info":binfo},"capture":{"on":traffic.manual_capture["on"]}}

@app.get("/api/broker/status")
def get_broker_status(authorization:str|None=Header(default=None)):
 auth(authorization)
 alive,info=broker.broker_alive()
 pending=len(list(broker.QUEUE.glob("*.cmd.json"))) if broker.QUEUE.exists() else 0
 return {"alive":alive,"info":info,"queue_pending":pending,"dir":str(broker.BASE)}

@app.post("/api/broker/start")
def post_broker_start(authorization:str|None=Header(default=None)):
 auth(authorization)
 if sys.platform!="win32":raise HTTPException(400,"Windows only")
 broker.ensure_dirs();broker.clear_pending()
 script=str(BASE.parent/"scripts"/"fgf-broker.ps1")
 launch=("$p=Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"
         +"'"+str(script)+"') -Verb RunAs")
 try:
  r=subprocess.run(["powershell.exe","-NoProfile","-NonInteractive","-Command",launch],capture_output=True,text=True,timeout=60,creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
  if r.returncode:raise HTTPException(500,(r.stderr or "UAC declined or start failed")[:400])
 except HTTPException:raise
 except Exception as e:raise HTTPException(500,str(e))
 for _ in range(30):
  time.sleep(0.5)
  alive,info=broker.broker_alive()
  if alive:return {"status":"started","info":info}
 return {"status":"pending_user_consent","hint":"Approve the UAC prompt to start the elevated worker."}

@app.post("/api/audit/enable")
def post_audit_enable(authorization:str|None=Header(default=None)):
 auth(authorization)
 alive,_=broker.broker_alive()
 if alive:
  ack=broker.write_command("audit-enable",{},timeout=60)
  if ack.get("status")!="ok":raise HTTPException(500,"Broker audit-enable failed: "+json.dumps(ack)[:300])
 else:
  script="auditpol /set /subcategory:'Filtering Platform Packet Drop' /success:enable; auditpol /set /subcategory:'Filtering Platform Connection' /success:enable"
  script="auditpol /set /subcategory:\"Filtering Platform Packet Drop\" /success:enable; auditpol /set /subcategory:\"Filtering Platform Connection\" /success:enable"
  try:elevated(script)
  except Exception as e:raise HTTPException(500,str(e))
 enrich.clear_caches()
 DB.log("audit","Filtering-Platform packet audit enabled","success events (5156) now visible")
 return {"status":"ok","audit":enrich.audit_state()}

@app.get("/api/domain-patterns")
def get_domain_patterns(authorization:str|None=Header(default=None)):
 auth(authorization)
 try:plan=traffic.domain_plan(DB)
 except Exception as e:raise HTTPException(500,str(e))
 patterns=DB.domain_patterns()
 for p in patterns:
  p["resolved"]=plan["per_pattern"].get(p["pattern"],{})
 active=[r["name"] for r in DB.rules() if r["status"]=="created" and str(r["policy_id"]).startswith("domain:")]
 return {"patterns":patterns,"active_rules_count":len(active),"per_pattern":plan["per_pattern"]}

@app.post("/api/domain-patterns")
def post_domain_pattern(req:PatternRequest,authorization:str|None=Header(default=None)):
 auth(authorization)
 pat=req.pattern.strip()
 if not pat or pat.strip("*")=="":raise HTTPException(400,"Enter a domain wildcard, e.g. *microsoft.com*")
 if any(ch in pat for ch in "'\"`\r\n\x00"):raise HTTPException(400,"Invalid characters in pattern")
 if len(pat)>120:raise HTTPException(400,"Pattern too long")
 p=DB.add_pattern(pat)
 DB.log("domain_pattern","Pattern added",pat)
 return {"status":"ok","pattern":p}

@app.delete("/api/domain-patterns/{pid}")
def delete_domain_pattern(pid:int,authorization:str|None=Header(default=None)):
 auth(authorization)
 DB.delete_pattern(pid)
 DB.log("domain_pattern","Pattern removed",str(pid))
 return {"status":"ok"}

@app.patch("/api/domain-patterns/{pid}")
def patch_domain_pattern(pid:int,req:PatternEnabledRequest,authorization:str|None=Header(default=None)):
 auth(authorization)
 DB.set_pattern_enabled(pid,req.enabled)
 DB.log("domain_pattern","Pattern "+("enabled" if req.enabled else "disabled"),str(pid))
 return {"status":"ok"}

@app.get("/api/domain-patterns/status")
def get_domain_status(authorization:str|None=Header(default=None)):
 auth(authorization)
 try:plan=traffic.domain_plan(DB)
 except Exception as e:raise HTTPException(500,str(e))
 return {"add_n":sum(1 for a in plan["adding"]),"remove_n":len(plan["removing"]),"per_pattern":plan["per_pattern"],"broker_alive":broker.broker_alive()[0],"dry_run":CFG.get("dry_run",False)}

@app.post("/api/domain-patterns/apply")
def post_domain_apply(authorization:str|None=Header(default=None)):
 auth(authorization)
 try:plan=traffic.domain_plan(DB)
 except Exception as e:raise HTTPException(500,str(e))
 if CFG.get("dry_run",False):
  DB.log("dry_run","Domain apply requested",json.dumps({"add":len(plan["adding"]),"remove":len(plan["removing"])}))
  return {"status":"dry_run","add_n":len(plan["adding"]),"remove_n":len(plan["removing"]),"per_pattern":plan["per_pattern"]}
 res=traffic.apply_domain_plan(DB,plan,DB.log)
 DB.log("domain_pattern","Apply finished",str(res)[:400])
 return res

@app.post("/api/capture/start")
def post_capture_start(req:CaptureRequest,authorization:str|None=Header(default=None)):
 auth(authorization)
 traffic.manual_capture["on"]=bool(req.on)
 alive,_=broker.broker_alive()
 cmd={"etl":traffic.manual_capture["etl"]}
 if req.on:
  if alive:ack=broker.write_command("capture-start",cmd,timeout=60)
  else:elevated("logman delete FGFNetCapture 2>$null | Out-Null; logman create trace FGFNetCapture -o "+broker.BASE.as_posix()+"/fgf_net.etl -p Microsoft-Windows-Kernel-Network 0xffffffff -nb 32 128 -mode Circular -ets")
 else:
  if alive:ack=broker.write_command("capture-stop",{},timeout=60)
  else:elevated("logman stop FGFNetCapture -ets 2>$null | Out-Null; logman delete FGFNetCapture 2>$null | Out-Null")
 DB.log("capture","Network capture "+("started" if req.on else "stopped"),"via "+("broker" if alive else "direct UAC"))
 return {"status":"ok","on":bool(req.on)}

@app.get("/api/capture/state")
def get_capture_state(authorization:str|None=Header(default=None)):
 auth(authorization)
 st=traffic.capture_state()
 st["broker_alive"]=broker.broker_alive()[0]
 return st

async def _domain_refresh_loop():
 while True:
  await asyncio.sleep(300)
  try:
   if not CFG.get("dry_run",False) and broker.broker_alive()[0] and DB.domain_patterns():
    plan=traffic.domain_plan(DB)
    if plan["adding"] or plan["removing"]:
     res=traffic.apply_domain_plan(DB,plan,DB.log)
     DB.log("domain_pattern","Auto-refresh applied",str(res)[:300])
  except Exception as e:
   DB.log("domain_pattern","Auto-refresh failed",str(e)[:300])

@app.on_event("startup")
async def _startup():asyncio.get_event_loop().create_task(_domain_refresh_loop())

_DIST=BASE.parent/"frontend"/"dist"
if _DIST.is_dir():
 app.mount("/",StaticFiles(directory=str(_DIST),html=True),name="frontend")
