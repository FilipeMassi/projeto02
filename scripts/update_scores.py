#!/usr/bin/env python3
"""Atualiza placares encerrados via ESPN, preservando resultados manuais."""
import json, os, pathlib, datetime, urllib.request, urllib.parse, unicodedata, re, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
FIXTURES=json.loads((ROOT/"data/fixtures.json").read_text(encoding="utf-8"))
DEST=ROOT/"data/results.json"
data=json.loads(DEST.read_text(encoding="utf-8"))
data.setdefault("matches",{})
today=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).date()
def norm(s):
    s=unicodedata.normalize("NFKD",s.casefold())
    return re.sub(r"[^a-z0-9]","", "".join(c for c in s if not unicodedata.combining(c)))
aliases={"vasco":["vasco","vascodagama"],"atleticomg":["atleticomg","atleticomineiro"],"bragantino":["bragantino","redbullbragantino","rbbragantino"],"athleticopr":["athleticopr","atleticoparanaense"],"gremio":["gremio"],"saopaulo":["saopaulo"],"coritiba":["coritiba"],"internacional":["internacional","inter"],"botafogo":["botafogo"],"bocajuniors":["bocajuniors"],"estudiantes":["estudiantes","estudiantesdelaplata"]}
def eq(a,b):
    a,b=norm(a),norm(b)
    return a==b or b in aliases.get(a,[]) or a in aliases.get(b,[])
def fetch(league, date):
    url=f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard?dates={date}"
    req=urllib.request.Request(url,headers={"User-Agent":"OperacaoLiberta/1.0"})
    with urllib.request.urlopen(req,timeout=18) as resp:
        return json.load(resp).get("events",[])
changed=0
cache={}
for f in FIXTURES:
    d=datetime.date.fromisoformat(f["date"])
    if d>today: continue
    old=data["matches"].get(f["id"])
    if old and old.get("source")=="manual": continue
    key=(f["competition"],d.strftime("%Y%m%d"))
    if key not in cache:
        try: cache[key]=fetch(*key)
        except Exception as exc:
            print(f"AVISO: não foi possível consultar {key}: {exc}",file=sys.stderr)
            cache[key]=[]
    for event in cache[key]:
        comp=(event.get("competitions") or [{}])[0]
        teams=comp.get("competitors",[])
        if len(teams)!=2: continue
        home=next((x for x in teams if x.get("homeAway")=="home"),None)
        away=next((x for x in teams if x.get("homeAway")=="away"),None)
        if not home or not away: continue
        hn=home.get("team",{}).get("displayName","")
        an=away.get("team",{}).get("displayName","")
        if not (eq(f["home"],hn) and eq(f["away"],an)): continue
        status=comp.get("status",{}).get("type",{})
        if not status.get("completed"): continue
        try: hs=int(home["score"]);aw=int(away["score"])
        except (ValueError,KeyError,TypeError): continue
        result={"home":hs,"away":aw,"source":"espn","status":"final","event_id":str(event.get("id",""))}
        if old and all(old.get(k)==v for k,v in result.items()): break
        data["matches"][f["id"]]=result
        changed+=1
        print(f'{f["id"]}: {f["home"]} {hs} x {aw} {f["away"]}')
        break
if changed:
    data["updated_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
    DEST.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"Atualizações: {changed}")
