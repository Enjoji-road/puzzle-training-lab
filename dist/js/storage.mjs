import {copy,fresh,fields,SKILLS,hasReasonMark} from './model.mjs';
export const STORAGE_KEY='puzzle-training-lab/v1';
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const assert=(test,msg)=>{if(!test)throw Error(msg||'バックアップの形式を確認してください。');};
const safe=k=>typeof k==='string'&&!['__proto__','prototype','constructor'].includes(k);
const id=k=>safe(k)&&/^[a-zA-Z0-9-]{1,90}$/.test(k);
const num=n=>Number.isSafeInteger(n)&&n>=0;
const txt=(s,limit)=>typeof s==='string'&&s.length<=limit;
function validateAttempt(a,p){
  assert(plain(a)&&id(a.id)&&['practice','review'].includes(a.mode)&&[a.started,a.updated,a.solved].every(num));
  const rows=new Map(fields(p).map(f=>[f.key,f.options]));
  const allKeys=new Set(p.genre==='route'?p.board.cells.map(c=>c.key):rows.keys());
  const clueIds=new Set(p.clues.map(c=>c.id));
  const noteKey=k=>{const [field,...rest]=k.split('~');return allKeys.has(field)&&(!rest.length||(rest.length===1&&rows.get(field)?.includes(rest[0])));};
  function board(b){
    assert(plain(b)&&['marks','cross','notes','links'].every(k=>plain(b[k]))&&txt(b.focus,100)&&(!b.focus||clueIds.has(b.focus)));
    for(const [k,v] of Object.entries(b.marks))assert(rows.get(k)?.includes(v));
    for(const [k,values] of Object.entries(b.cross))assert(rows.has(k)&&Array.isArray(values)&&new Set(values).size===values.length&&values.every(v=>rows.get(k).includes(v)&&v!==b.marks[k]));
    for(const [k,v] of Object.entries(b.notes))assert(noteKey(k)&&txt(v,600));
    for(const [k,sources] of Object.entries(b.links))assert(noteKey(k)&&hasReasonMark(b,k)&&Array.isArray(sources)&&new Set(sources).size===sources.length&&sources.every(s=>typeof s==='string'&&(s.startsWith('c:')?clueIds.has(s.slice(2)):s.startsWith('f:')&&noteKey(s.slice(2))&&hasReasonMark(b,s.slice(2)))));
  }
  function frame(f){
    assert(plain(f));board(f.board);
    if(f.branch){assert(plain(f.branch)&&txt(f.branch.name,60));board(f.branch.base);}
  }
  frame(a.frame);assert(Array.isArray(a.points)&&a.points.length<=5000);
  for(const point of a.points){assert(id(point.id)&&txt(point.name,60));frame(point.frame);}
  const stats=a.stats;
  assert(plain(stats)&&['wrong','checks','undos','redos','restores','branches','conflicts','recoveries','restarts'].every(k=>num(stats[k])));
  assert(Array.isArray(stats.hints)&&stats.hints.every(n=>[1,2,3].includes(n))&&num(stats.explanation)&&stats.explanation<=p.steps.length);
  assert(Array.isArray(stats.self)&&stats.self.every(t=>SKILLS.includes(t))&&['','answer','local'].includes(a.pending));
  for(const key of ['hintsAtClear','explanationAtClear'])if(stats[key]!==undefined)assert(num(stats[key]));
  if(a.solved)assert(Object.entries(p.solution).every(([k,v])=>a.frame.board.marks[k]===v));
  // Replay both history directions on copies. Only known, safe paths can be mutated.
  for(const [list,side] of [[a.undo,1],[a.redo,2]]){
    assert(Array.isArray(list)&&list.length<=20000);
    const f=copy(a.frame);
    for(let i=list.length-1;i>=0;i--){
      const delta=list[i];assert(Array.isArray(delta)&&delta.length<=5000);
      for(const item of delta){
        assert(Array.isArray(item)&&item.length===3);
        const path=item[0];assert(Array.isArray(path)&&path.length>=1&&path.length<=5&&path.every(safe));
        let sub=path;
        if(path[0]==='branch'){
          if(path.length>1){
            if(path[1]==='name'){assert(path.length===2);}
            else {assert(path[1]==='base');sub=['board',...path.slice(2)];}
          }
        }else assert(path[0]==='board');
        if(sub[0]==='board'){
          assert(['marks','cross','notes','links','focus'].includes(sub[1])&&sub.length===(sub[1]==='focus'?2:3));
        }
        let obj=f;for(const k of path.slice(0,-1)){assert(plain(obj[k]));obj=obj[k];}
        const key=path.at(-1),value=item[side];if(value===null)delete obj[key];else obj[key]=copy(value);
      }
      frame(f);
    }
  }
}
export function parseBackup(text,puzzles){
  assert(typeof text==='string'&&text.length<=16_000_000,'このファイルは大きすぎます。');
  const data=JSON.parse(text,(k,v)=>{assert(safe(k));return v;});
  assert(plain(data)&&data.version===1&&plain(data.attempts)&&['light','dark','system'].includes(data.theme)&&id(data.epoch),'Puzzle Training Lab のバージョン1の記録を選んでください。');
  const map=new Map(puzzles.map(p=>[p.id,p]));
  for(const [k,a] of Object.entries(data.attempts)){assert(id(k)&&a.id===k&&map.has(a.pid));validateAttempt(a,map.get(a.pid));}
  assert(data.last===''||Object.hasOwn(data.attempts,data.last));
  return data;
}
export function readLocal(puzzles){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){const state=fresh();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return {state};}
    return {state:parseBackup(raw,puzzles)};
  }catch{return {state:fresh(),error:'保存済みの記録を読み込めませんでした。このタブの記録は、学習記録からJSONで書き出せます。'};}
}
export function saveLocal(state,replace=false){
  try{
    if(!replace){
      const raw=localStorage.getItem(STORAGE_KEY), disk=raw&&JSON.parse(raw);
      if(disk?.version===1&&disk.epoch===state.epoch){
        for(const [id,other] of Object.entries(disk.attempts)){
          if(!state.attempts[id]||other.updated>state.attempts[id].updated)state.attempts[id]=other;
        }
      }
    }
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;
  }catch{return false;}
}

