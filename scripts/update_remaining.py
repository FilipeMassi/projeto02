#!/usr/bin/env python3
"""Coleta confrontos restantes do Brasileirão com IDs ESPN e valida integridade."""
import datetime,json,pathlib,urllib.request,urllib.parse,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
DEST=ROOT/"data/remaining.json"
BASE="https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard"
today=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).date()
matches={}
errors=[]
for offset in range(0,52):
    day=today+datetime.timedelta(days=offset)
    url=BASE+"?"+urllib.parse.urlencode({"dates":day.strftime("%Y%m%d"),"limit":100})
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"OperacaoLiberta/1.0"}),timeout=15) as r: data=json.load(r)
    except Exception as exc:
        errors.append(f"{day}: {exc}")
        continue
    for ev in data.get("events",[]):
        c=(ev.get("competitions") or [{}])[0]
        teams=c.get("competitors") or []
        home=next((x for x in teams if x.get("homeAway")=="home"),None)
        away=next((x for x in teams if x.get("homeAway")=="away"),None)
        if not home or not away:continue
        status=c.get("status",{}).get("type",{})
        if status.get("completed"):continue
        hid=str(home.get("team",{}).get("id") or "")
        aid=str(away.get("team",{}).get("id") or "")
        eid=str(ev.get("id") or "")
        if not hid or not aid or not eid:continue
        matches[eid]={"id":eid,"date":ev.get("date"),"home_id":hid,"away_id":aid,"home":home.get("team",{}).get("displayName"),"away":away.get("team",{}).get("displayName"),"status":status.get("name","scheduled")}
if errors:
    print("Falhas de consulta; preservando última versão íntegra: "+str(len(errors)),file=sys.stderr)
    sys.exit(0)
rows=sorted(matches.values(),key=lambda m:m.get("date") or "")
# Não publicar lista vazia quando ainda há partidas restantes.
standings=json.loads((ROOT/"data/standings.json").read_text(encoding="utf-8"))
remaining=sum(38-x["played"] for x in standings.get("standings",[]))//2
ids={str(t["id"]) for t in standings.get("standings",[])}
invalid=[m for m in rows if m["home_id"] not in ids or m["away_id"] not in ids or m["home_id"]==m["away_id"]]
if invalid:
    print(f"Calendário rejeitado: {len(invalid)} equipes não identificadas.",file=sys.stderr)
    sys.exit(0)
if remaining>0 and len(rows)!=remaining:
    print(f"Cobertura divergente: {len(rows)}/{remaining} jogos; mantendo dados anteriores.",file=sys.stderr)
    sys.exit(0)
payload={"updated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"source":"ESPN","complete":True,"expected_matches":remaining,"matches":rows}
old=json.loads(DEST.read_text(encoding="utf-8")) if DEST.exists() else {}
if old.get("matches")!=rows:
    DEST.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Calendário publicado: {len(rows)} jogos.")
else:print("Calendário sem alterações.")
