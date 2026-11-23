import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as M from '../dist/js/model.mjs';
import {parseBackup,saveLocal,readLocal,STORAGE_KEY} from '../dist/js/storage.mjs';
import {player} from '../dist/js/player.mjs';
import {home,review,analysis,records,catalog} from '../dist/js/pages.mjs';
const data=name=>JSON.parse(readFileSync(new URL('../dist/data/'+name,import.meta.url),'utf8'));
const puzzles=data('catalog.json').files.flatMap(data);
const p=id=>puzzles.find(q=>q.id===id);
const options={key:'',opt:'',zoom:1,brush:'inspect',steps:0,hintCount:0};
const freshAttempt=(pid,mode='practice')=>M.newAttempt(p(pid),mode);
const stateWith=(...runs)=>{const s=M.fresh();for(const a of runs)s.attempts[a.id]=a;s.last=runs.at(-1)?.id||'';return s;};
const finish=(q,a)=>{for(const [k,v] of Object.entries(q.solution))M.mark(a,k,v);return M.checkAnswer(q,a);};
const reloaded=a=>parseBackup(JSON.stringify(stateWith(a)),puzzles).attempts[a.id];

for(const q of puzzles){
  test(q.id+' uses the same editable fields, printed proof and grade as its dataset',()=>{
    const a=M.newAttempt(q),s=stateWith(a);
    assert.deepEqual(M.fields(q).map(x=>x.key).sort(),Object.keys(q.solution).sort());
    const initial=player(q,a,options);
    assert(!initial.includes(q.hints[0].text));assert(!initial.includes(q.steps[0].text));
    assert.equal(M.checkAnswer(q,a),'incomplete');assert.equal(a.stats.wrong,0);
    assert.deepEqual(M.conflicts(q,a),[]);
    for(const step of q.steps){
      for(const [k,v] of Object.entries(step.facts)){
        assert(M.fields(q).find(f=>f.key===k).options.includes(v));M.mark(a,k,v);
      }
      assert.deepEqual(M.conflicts(q,a),[],step.title);
    }
    assert.deepEqual(a.frame.board.marks,q.solution);
    assert.equal(M.checkAnswer(q,a),'solved');assert(M.didClear(s,q.id));
    assert.deepEqual(reloaded(a).frame,a.frame);assert.equal(M.travel(a),false);
    const wrong=M.newAttempt(q);for(const [k,v] of Object.entries(q.solution))M.mark(wrong,k,v);
    const field=M.fields(q)[0];M.mark(wrong,field.key,field.options.find(v=>v!==q.solution[field.key]));
    assert.equal(M.checkAnswer(q,wrong),'wrong');assert.equal(wrong.stats.wrong,1);assert.equal(wrong.solved,0);
  });
}
test('a named branch discards dependent marks, candidates, notes and links after restart',()=>{
  const a=freshAttempt('symbol-2');M.mark(a,'a','6');M.addLink(a,'a','c:c1');
  M.checkpoint(a,'前半');const baseline=M.copy(a.frame.board);
  M.beginBranch(a,'十の位');M.mark(a,'b','1');M.mark(a,'c','6','cross');
  M.edit(a,f=>{f.board.notes['b~1']='仮の判断';f.board.focus='c2';});M.addLink(a,'b','f:a');
  assert(M.isTrial(a.frame,'marks','b'));assert(!M.isTrial(a.frame,'marks','a'));
  M.checkpoint(a,'試し置き');const saved=reloaded(a);
  assert(M.discardBranch(saved));assert.deepEqual(saved.frame.board,baseline);
  assert(!saved.frame.branch);assert(M.travel(saved));assert.equal(saved.frame.branch.name,'十の位');
  assert.equal(saved.frame.board.notes['b~1'],'仮の判断');assert(M.travel(saved,true));assert.deepEqual(saved.frame.board,baseline);
  assert(M.restore(saved,saved.points[1].id));assert(M.isTrial(saved.frame,'marks','b'));
  assert(M.restore(saved,saved.points[0].id));assert.deepEqual(saved.frame.board,baseline);
  assert.deepEqual(reloaded(saved),saved);
});
test('checkpoints save distinct alternatives without converting either to established facts',()=>{
  const a=freshAttempt('route-2');M.mark(a,'r2c2','W');M.beginBranch(a,'東');M.mark(a,'r2c3','W');
  M.checkpoint(a,'東の案');M.discardBranch(a);M.beginBranch(a,'南');M.mark(a,'r2c3','B');M.checkpoint(a,'南の案');
  M.restore(a,a.points[0].id);assert.equal(a.frame.branch.name,'東');M.discardBranch(a);
  assert.deepEqual(a.frame.board.marks,{r2c2:'W'});assert.deepEqual(reloaded(a),a);
});
test('partial contradictory route clues, matching/zero constraints and recovery',()=>{
  const q=p('route-2'),a=M.newAttempt(q);M.mark(a,'r2c2','W');M.beginBranch(a,'右');M.mark(a,'r2c3','W');
  assert(M.conflicts(q,a).some(v=>v.includes('C1')));M.flag(a,'local');M.flag(a,'local');M.discardBranch(a);M.reconcile(q,a);
  assert.equal(a.stats.conflicts,1);assert.equal(a.stats.recoveries,1);
  const l=p('logic-1'),b=M.newAttempt(l);
  const row=M.fields(l).find(x=>x.key==='map');M.mark(b,'map',row.options[0]);assert(M.conflicts(l,b).some(v=>v.includes('条件 1')));
  const sym=p('symbol-5'),c=M.newAttempt(sym);M.mark(c,'a','0');assert(M.conflicts(sym,c).some(v=>v.includes('条件')));
  const d=M.newAttempt(l);for(const r of M.fields(l).slice(0,2))for(const v of r.options.slice(1))M.mark(d,r.key,v,'cross');
  assert(M.conflicts(l,d).some(t=>t.includes('割り当て')));
});
test('wrong full hypothesis stays tentative and only verified success discharges it',()=>{
  const q=p('symbol-1'),a=M.newAttempt(q);M.beginBranch(a,'別の数字');M.mark(a,'a','3');M.mark(a,'b','4');
  assert.equal(M.checkAnswer(q,a),'wrong');assert(a.frame.branch);M.mark(a,'a','2');M.reconcile(q,a);
  assert.equal(M.checkAnswer(q,a),'solved');assert(!a.frame.branch);assert.equal(a.stats.recoveries,1);
});
test('evidence, growth and skill review reflect separate attempts and freeze help at clear',()=>{
  const q=p('symbol-2'),a=M.newAttempt(q);M.useHint(a,1);M.useHint(a,2);M.report(a,'候補管理');finish(q,a);
  const b=M.newAttempt(q,'review');b.started=a.started+100;finish(q,b);const s=stateWith(a,b);
  assert(M.growth(s,q.id));M.explain(b,1);M.useHint(b,1);assert(M.growth(s,q.id));
  assert.equal(M.evidence(s,puzzles,'候補管理').self,1);
  const list=M.reviewList(s,puzzles,'桁上がり・桁下がり');
  assert(list.length>1&&list.every(q=>q.skills.includes('桁上がり・桁下がり')));assert.equal(list.at(-1).id,q.id);
  for(const html of [home(s,puzzles),catalog(s,puzzles,'logic',3),review(s,puzzles,'候補管理'),analysis(s,puzzles),records(s,puzzles)]){
    assert(html.length>200);assert(!html.includes('undefined'));
  }
});
test('undo and redo survive reload, a new edit forks history, and witness links cannot cycle',()=>{
  const a=freshAttempt('symbol-2');M.mark(a,'a','6');M.mark(a,'b','1');assert.equal(M.addLink(a,'b','f:a'),'');
  assert(M.addLink(a,'a','f:b'));M.travel(a);const b=reloaded(a);assert(M.travel(b,true));assert.deepEqual(b.frame.board.links,{b:['f:a']});
  M.travel(b);M.mark(b,'c','3');assert.equal(b.redo.length,0);
});
test('a removed candidate can carry a reason and serve as the basis for another mark',()=>{
  const q=p('symbol-2'),a=M.newAttempt(q);
  M.mark(a,'b','1');
  M.beginBranch(a,'候補を除く');
  M.mark(a,'c','8','cross');M.mark(a,'a','8');
  assert.equal(M.addLink(a,'c~8','f:b'),'');
  assert.equal(M.addLink(a,'a','f:c~8'),'');
  assert(M.addLink(a,'b','f:a'));
  assert.deepEqual(reloaded(a).frame.board.links,{ 'c~8':['f:b'],a:['f:c~8'] });
  const html=player(q,a,{...options,key:'c',opt:'8'});
  assert(html.includes('8（×） の根拠'));assert(html.includes('（仮定）'));
  M.mark(a,'c','8','erase');
  assert.deepEqual(a.frame.board.links,{});M.travel(a);
  assert(a.frame.board.links.a);M.discardBranch(a);
  assert.deepEqual(a.frame.board.marks,{b:'1'});
  assert.deepEqual(a.frame.board.links,{});
});
test('import validates complete history and refuses damaged records before changing storage',()=>{
  const a=freshAttempt('symbol-1');M.mark(a,'a','2');const good=JSON.stringify(stateWith(a));assert.doesNotThrow(()=>parseBackup(good,puzzles));
  const corrupt=JSON.parse(good);corrupt.attempts[a.id].frame.board.marks.a='19';assert.throws(()=>parseBackup(JSON.stringify(corrupt),puzzles));
  const bad=JSON.parse(good);bad.attempts[a.id].undo[0][0][0]=['board','__proto__','x'];assert.throws(()=>parseBackup(JSON.stringify(bad),puzzles));
  assert.throws(()=>parseBackup('{"version":1}',puzzles));assert.throws(()=>parseBackup('broken',puzzles));
});
test('local storage retains independent attempts from two tabs and reports quota errors',()=>{
  const cache=new Map();globalThis.localStorage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)};
  const first=readLocal(puzzles).state,second=readLocal(puzzles).state;assert.equal(first.epoch,second.epoch);
  const x=freshAttempt('route-1'),y=freshAttempt('logic-1');first.attempts[x.id]=x;second.attempts[y.id]=y;
  assert(saveLocal(first));assert(saveLocal(second));assert.equal(Object.keys(parseBackup(cache.get(STORAGE_KEY),puzzles).attempts).length,2);
  globalThis.localStorage.setItem=()=>{throw Error('quota');};assert.equal(saveLocal(second),false);delete globalThis.localStorage;
});
test('loading the expanded catalog preserves a legacy v1 backup and its pending hypothesis',()=>{
  const old=['routes.json','logic.json','symbols.json'].flatMap(data);
  const before=M.newAttempt(p('route-2'));
  M.mark(before,'r2c2','W');
  M.checkpoint(before,'仮定の前');
  M.beginBranch(before,'右の案');
  M.mark(before,'r2c3','W');
  M.useHint(before,1);
  M.useHint(before,2);
  const serialized=JSON.stringify(stateWith(before));
  const original=parseBackup(serialized,old);
  const expanded=parseBackup(serialized,puzzles);
  assert.deepEqual(expanded,original);
  const resumed=expanded.attempts[before.id];
  assert(M.discardBranch(resumed));
  assert.deepEqual(resumed.frame.board.marks,{r2c2:'W'});
  assert.deepEqual(resumed.stats.hints,[1,2]);
  assert(M.travel(resumed));
  assert.equal(resumed.frame.branch.name,'右の案');
  assert(M.travel(resumed,true));
  assert.equal(resumed.frame.branch,undefined);
});
test('the 30 additions are reachable by genre, level, and review skill',()=>{
  const baseIds=new Set(['routes.json','logic.json','symbols.json'].flatMap(data).map(q=>q.id));
  const added=puzzles.filter(q=>!baseIds.has(q.id));
  const state=stateWith();
  for(const genre of Object.keys(M.GENRES)){
    for(const lv of [4,5]){
      const group=added.filter(q=>q.genre===genre&&q.level===lv);
      assert(group.length>=5);
      const html=catalog(state,puzzles,genre,lv);
      assert(group.every(q=>html.includes('data-pid="'+q.id+'"')));
    }
  }
  for(const [tag,genre] of [['複数条件の統合','logic'],['全体構造の把握','route'],['候補管理','symbol']]){
    const html=review(state,puzzles,tag,5,genre);
    const visible=puzzles.filter(q=>html.includes('data-pid="'+q.id+'"'));
    assert(visible.some(q=>!baseIds.has(q.id)));
    assert(visible.every(q=>q.genre===genre&&q.level===5&&q.skills.includes(tag)));
  }
});

