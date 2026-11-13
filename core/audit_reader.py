import json, subprocess, sys
def read_firewall_events(limit=100):
    if sys.platform!="win32": return []
    limit=max(1,min(int(limit),300)); ids="2004,2005,2006,5152,5156,5157"
    script=("$ids=@("+ids+"); $logs=@('Microsoft-Windows-Windows Firewall With Advanced Security/Firewall','Security'); "
      "$all=foreach($log in $logs){try{Get-WinEvent -FilterHashtable @{LogName=$log;Id=$ids} -MaxEvents "+str(limit)+
      " -ErrorAction Stop | Select-Object TimeCreated,Id,ProviderName,LevelDisplayName,Message}catch{}}; "
      "$all | Sort-Object TimeCreated -Descending | Select-Object -First "+str(limit)+" | ConvertTo-Json -Depth 3 -Compress")
    try:
        r=subprocess.run(["powershell.exe","-NoProfile","-NonInteractive","-Command",script],capture_output=True,text=True,timeout=15,
          creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
        if r.returncode or not r.stdout.strip(): return []
        data=json.loads(r.stdout); data=[data] if isinstance(data,dict) else data
        return [{"time":str(x.get("TimeCreated","")),"event_id":str(x.get("Id","")),"provider":str(x.get("ProviderName","")),
                 "level":str(x.get("LevelDisplayName","")),"message":str(x.get("Message",""))[:3500]} for x in data if isinstance(x,dict)]
    except (OSError,ValueError,subprocess.SubprocessError,json.JSONDecodeError): return []
