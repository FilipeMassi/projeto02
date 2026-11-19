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
assert.match(html,/function projectedTable\(/,'motor unico de projecao ausente');
assert.match(html,/function saveScore\(/,'salvamento de placares ausente');
assert.match(html,/data-score-save/,'controles de placar ausentes');
assert.doesNotMatch(html,/cupResult\('m7-0'\)/,'identificador incorreto de final');
const score={home:2,away:0};const outcome=score.home>score.away?'home':score.home<score.away?'away':'draw';assert.equal(outcome,'home');
console.log('OK: sintaxe, calendario, classificacao, placares, integridade e identificadores');
