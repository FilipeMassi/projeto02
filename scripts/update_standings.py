#!/usr/bin/env python3
"""Coleta a classificação do Brasileirão; publica apenas tabelas completas e válidas."""
import datetime,json,pathlib,urllib.request,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
DEST=ROOT/"data/standings.json"
URL="https://site.api.espn.com/apis/v2/sports/soccer/bra.1/standings"
req=urllib.request.Request(URL,headers={"User-Agent":"OperacaoLiberta/1.0","Accept":"application/json"})
with urllib.request.urlopen(req,timeout=25) as response:
    raw=json.load(response)
def walk(obj):
    if isinstance(obj,dict):
        if isinstance(obj.get("entries"),list):
            yield from obj["entries"]
        for k,v in obj.items():
            if k!="entries": yield from walk(v)
    elif isinstance(obj,list):
        for x in obj: yield from walk(x)
def stat(entry, keys):
    stats=entry.get("stats") or []
    for item in stats:
        if item.get("name") in keys or item.get("abbreviation") in keys:
            value=item.get("value")
            if value is None:value=item.get("displayValue")
            try:return int(float(value))
            except (ValueError,TypeError):pass
    return None
teams={}
for e in walk(raw):
    team=e.get("team") or {}
    tid=str(team.get("id") or "")
    name=team.get("displayName") or team.get("name")
    if not tid or not name:continue
    pts=stat(e,{"points","PTS"});gp=stat(e,{"gamesPlayed","GP","matchesPlayed"})
    wins=stat(e,{"wins","W"});draws=stat(e,{"ties","draws","D"});losses=stat(e,{"losses","L"})
    gf=stat(e,{"pointsFor","goalsFor","GF"});ga=stat(e,{"pointsAgainst","goalsAgainst","GA"})
    diff=stat(e,{"pointDifferential","goalDifference","GD"})
    rank=stat(e,{"rank","RANK"})
    if pts is None or gp is None or wins is None or draws is None or losses is None:continue
    if gp!=wins+draws+losses or pts!=wins*3+draws:continue
    if not (0<=gp<=38 and 0<=pts<=114):continue
    teams[tid]={"id":tid,"name":name,"abbreviation":team.get("abbreviation",""),"rank":rank,"points":pts,"played":gp,"wins":wins,"draws":draws,"losses":losses,"goals_for":gf,"goals_against":ga,"goal_difference":diff}
if len(teams)!=20:
    print(f"Tabela não publicada: apenas {len(teams)} equipes válidas (esperadas 20).",file=sys.stderr)
    sys.exit(0)
rows=list(teams.values())
if all(x["rank"] is not None for x in rows) and sorted(x["rank"] for x in rows)==list(range(1,21)):
    rows.sort(key=lambda x:x["rank"])
else:
    rows.sort(key=lambda x:(-x["points"],-x["wins"],-(x["goal_difference"] if x["goal_difference"] is not None else -999),x["name"]))
    for x in rows:x["rank"]=None
payload={"updated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"source":"ESPN","source_url":URL,"complete":True,"standings":rows}
old=json.loads(DEST.read_text(encoding="utf-8")) if DEST.exists() else {}
if old.get("standings")==rows:
    print("Classificação sem alterações.")
else:
    DEST.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Classificação atualizada: 20 equipes.")
