#!/usr/bin/env node
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert(match,'script principal ausente');
new vm.Script(match[1],{filename:'index-inline.js'});
const fixtures=JSON.parse(fs.readFileSync('data/remaining.json','utf8'));
const standings=JSON.parse(fs.readFileSync('data/standings.json','utf8'));
assert.equal(standings.standings.length,20,'classificacao incompleta');
const counts=Object.fromEntries(standings.standings.map(t=>[String(t.id),0]));
for(const m of fixtures.matches){assert(m.home_id in counts&&m.away_id in counts,'clube desconhecido');assert.notEqual(m.home_id,m.away_id);counts[m.home_id]++;counts[m.away_id]++}
for(const t of standings.standings)assert.equal(counts[String(t.id)],38-t.played,'jogos restantes de '+t.name);
assert.match(html,/const SCORE_KEY=/,'placares devem persistir');
assert.match(html,/G-6 assegurado pela final Palmeiras x Grêmio/,'faixa-base deve refletir final da Copa do Brasil');
assert.match(html,/atleticoRank<=limit/,'ampliacao do Galo depende da posicao');
assert.match(html,/const slots=\[5,6,7,8,9\]/,'hipóteses G5-G9 devem permanecer acessíveis');
const cutoffSource=match[1].slice(match[1].indexOf('function projectedCutoff('),match[1].indexOf('function renderLeagueStandings('));
function scenario({gremio=18,atletico=7,palmeiras=2,lib=true,sula=true}={}){
 const ordered=Array.from({length:20},(_,i)=>({name:'Equipe '+i}));
 ordered[palmeiras-1]={name:'Palmeiras'};ordered[atletico-1]={name:'Atlético-MG'};ordered[gremio-1]={name:'Grêmio'};
 const flat=[{id:'lib',type:'final',a:'Palmeiras'},{id:'sula',type:'final',a:'Atlético-MG'}];
 const context={flat,ordered,normalizeClub:x=>x.normalize('NFD').replace(/[^a-zA-Z]/g,'').toLowerCase().replace(/[^a-z]/g,''),cupResult:id=>(id==='lib'?lib:sula)?'home':'away'};
 vm.createContext(context);vm.runInContext(cutoffSource+';this.result=projectedCutoff(ordered,true)',context);return context.result.limit;
}
assert.equal(scenario({lib:false,sula:false,gremio:16}),6,'G6 inicial');
assert.equal(scenario({lib:false,sula:false}),7,'Grêmio rebaixado abre G7');
assert.equal(scenario({sula:false}),8,'Palmeiras campeão e Grêmio rebaixado abrem G8');
assert.equal(scenario(),9,'Galo em 7º e títulos continentais abrem G9');
assert.equal(scenario({atletico:10}),8,'Galo fora da faixa não abre G9');
assert.equal(scenario({gremio:16}),8,'Grêmio na Série A mantém teto G8 neste cenário');

assert.match(html,/function projectedTable\(/,'motor unico de projecao ausente');
assert.match(html,/function saveScore\(/,'salvamento de placares ausente');
assert.match(html,/data-score-save/,'controles de placar ausentes');
assert.doesNotMatch(html,/cupResult\('m7-0'\)/,'identificador incorreto de final');
const score={home:2,away:0};const outcome=score.home>score.away?'home':score.home<score.away?'away':'draw';assert.equal(outcome,'home');

const source=match[1];
const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'função não encontrada: '+start);return source.slice(a,b)};
const engine=extract('const pickFromScore=', 'function brazilDate(');
const context={leagueStandings:[{id:1,name:'Vasco',points:40,wins:10,draws:10,losses:10,played:30,goal_difference:2,goals_for:30,rank:8},{id:2,name:'Rival',points:40,wins:10,draws:10,losses:10,played:30,goal_difference:2,goals_for:30,rank:7}],remainingFixtures:[{id:'test',home_id:1,away_id:2}],fullPicks:{},scores:{},SCORE_KEY:'test-scores',setFullPick:function(id,pick){this.fullPicks[id]=pick},localStorage:{getItem:()=>null,setItem:()=>{}},flat:[],state:{},KEY:'test',renderFullSimulator:()=>{},render:()=>{},toast:()=>{}};
for(let i=3;i<=20;i++)context.leagueStandings.push({id:i,name:'Time '+i,points:0,wins:0,draws:0,losses:30,played:30,goal_difference:0,goals_for:0,rank:i});
context.setFullPick=(id,pick)=>{context.fullPicks[id]=pick};
vm.createContext(context);
vm.runInContext(engine+';this.api={projectedTable,saveScore,scoreFor,setResult,pickFromScore}',context);
assert.equal(context.api.saveScore('test',2,0),true,'placar válido');
let p=context.api.projectedTable();
assert.equal(p.selected,1);assert.equal(p.scored,1);assert.equal(p.teams[0].id,1);
assert.equal(p.teams[0].points,43);assert.equal(p.teams[0].wins,11);
assert.equal(p.teams[0].goal_difference,4);assert.equal(p.teams[0].goals_for,32);
assert.equal(p.teams[1].goal_difference,0);
assert.equal(context.api.saveScore('test',-1,0),false,'placar negativo rejeitado');
assert.equal(context.api.saveScore('test',1.5,0),false,'placar fracionário rejeitado');
assert.equal(context.api.saveScore('test','',0),false,'placar vazio rejeitado');
context.scores={};context.fullPicks={test:'draw'};
p=context.api.projectedTable();assert.equal(p.scored,0);assert.equal(p.teams[0].points,41);assert.equal(p.teams[1].points,41);
assert.equal(p.teams[0].goal_difference,2,'sem placar não altera saldo');
assert.equal(context.api.pickFromScore(0,3),'away');
assert.equal(context.api.pickFromScore(2,2),'draw','empate deve preservar resultado X');
assert.equal(context.api.saveScore('test',1,1),true,'placar de empate deve ser aceito');
p=context.api.projectedTable();
assert.equal(p.teams.find(t=>t.id===1).points,41,'empate soma um ponto ao mandante');
assert.equal(p.teams.find(t=>t.id===2).points,41,'empate soma um ponto ao visitante');
assert.equal(p.teams.find(t=>t.id===1).goal_difference,2,'empate nao altera saldo');
assert.equal(p.teams.find(t=>t.id===1).goals_for,31,'empate acrescenta gols pro');
assert.equal(p.teams.find(t=>t.id===1).draws,11,'empate incrementa empates');
assert.equal(context.api.saveScore('test',0,2),true,'vitoria visitante deve ser aceita');
p=context.api.projectedTable();
assert.equal(p.teams.find(t=>t.id===2).points,43,'vitoria visitante soma tres pontos');
assert.equal(p.teams.find(t=>t.id===2).wins,11,'vitoria visitante incrementa vitorias');
assert.equal(p.teams.find(t=>t.id===1).losses,11,'derrota incrementa derrotas');
assert.equal(p.teams.find(t=>t.id===1).goal_difference,0,'saldo mandante atualizado');
assert.equal(p.teams.find(t=>t.id===2).goal_difference,4,'saldo visitante atualizado');
assert.match(html,/delete scores\['torcida:'\+m\.id\]/,'sincronizacao deve limpar placares locais obsoletos');

console.log('OK: sintaxe, calendario, classificacao, placares, integridade e identificadores');
