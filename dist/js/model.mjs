import {clueConflicts,hasAssignment,routeRelations} from './conditions.mjs';
export const SKILLS = ['条件の読み取り','局所的な推理','消去法','複数条件の統合','離れた情報の関連づけ','候補管理','仮定と場合分け','矛盾の検出','全体構造の把握','桁上がり・桁下がり'];
export const GOALS = ['基礎ルールの確認','2〜3条件の組み合わせ','離れた情報の関連づけ','場合分けと矛盾の検出','全体構造を使う複合推理'];
export const GENRES = {
  route:{name:'ルート・白黒推理',short:'白黒ルート',desc:'白と黒を置きながら、ひと続きの道を見つける。',icon:'route'},
  logic:{name:'配置・対応推理',short:'配置推理',desc:'手がかりを照らし合わせて、順番や対応を絞り込む。',icon:'grid'},
  symbol:{name:'覆面算・記号対応',short:'覆面算',desc:'桁をまたぐ計算から、記号に隠れた数字を探る。',icon:'shapes'}
};
export const copy = x => JSON.parse(JSON.stringify(x));
const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
export const makeId = () => globalThis.crypto?.randomUUID?.() || (Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
export const fresh = () => ({version:1,theme:'system',last:'',attempts:{},epoch:makeId()});
const emptyBoard = () => ({marks:{},cross:{},notes:{},links:{},focus:''});
export function newAttempt(p,mode='practice'){
  const now=Date.now();
  return {id:makeId(),pid:p.id,mode,started:now,updated:now,solved:0,frame:{board:emptyBoard()},undo:[],redo:[],points:[],
    stats:{hints:[],explanation:0,wrong:0,checks:0,undos:0,redos:0,restores:0,branches:0,conflicts:0,recoveries:0,restarts:0,self:[]},pending:''};
}
export function fields(p) {
  if(p.genre==='route') return p.board.cells.filter(c=>!c.given).map(c=>({key:c.key,label:c.label,options:['W','B']}));
  return p.board.tables.flatMap(t=>t.rows.map(r=>({...r,options:t.options})));
}
export const labelFor = (p,key) => (p.genre==='route'?p.board.cells:fields(p)).find(f=>f.key===key)?.label || key;
export const valueLabel = (p,v) => p.genre==='route'?({W:'白',B:'黒'}[v]||'未確定'):v;
export const changed = a => {a.updated=Math.max(Date.now(),a.updated+1);};
function patches(before,after,path=[],out=[]){
  if(eq(before,after)) return out;
  if(plain(before)&&plain(after)){
    for(const key of new Set([...Object.keys(before),...Object.keys(after)])) patches(before[key],after[key],[...path,key],out);
  } else out.push([path,before??null,after??null]);
  return out;
}
function applyDelta(frame,delta,side){
  for(const entry of delta){
    const path=entry[0]; let obj=frame;
    for(const key of path.slice(0,-1)) obj=obj[key];
    const k=path.at(-1),v=entry[side];
    if(v===null) delete obj[k]; else obj[k]=copy(v);
  }
}
export function edit(a,fn){
  if(a.solved) return false;
  const before=copy(a.frame);
  fn(a.frame);
  const delta=patches(before,a.frame);
  if(!delta.length) return false;
  a.undo.push(delta); a.redo=[];
  changed(a); return true;
}
export function travel(a,forward=false){
  if(a.solved) return false;
  const from=forward?a.redo:a.undo, to=forward?a.undo:a.redo;
  if(!from.length)return false;
  const delta=from.pop();applyDelta(a.frame,delta,forward?2:1);to.push(delta);
  a.stats[forward?'redos':'undos']++;changed(a);return true;
}
export function beginBranch(a,name){
  if(a.solved||a.frame.branch)return false;
  if(!edit(a,f=>{f.branch={name:name.trim().slice(0,60)||'仮定 '+(a.stats.branches+1),base:copy(f.board)};}))return false;
  a.stats.branches++;return true;
}
export function discardBranch(a){
  if(!a.frame.branch)return false;
  const result=edit(a,f=>{f.board=copy(f.branch.base);delete f.branch;});
  if(result)a.stats.restores++;return result;
}
export function checkpoint(a,name){
  if(a.solved)return;
  a.points.push({id:makeId(),name:name.trim().slice(0,60)||'記録点 '+(a.points.length+1),frame:copy(a.frame)});
  changed(a);
}
export function restore(a,id){
  const point=a.points.find(c=>c.id===id);
  if(!point)return false;
  const result=edit(a,f=>{f.board=copy(point.frame.board);if(point.frame.branch)f.branch=copy(point.frame.branch);else delete f.branch;});
  if(result)a.stats.restores++;return result;
}
export function isTrial(frame,field,key,value){
  const base=frame.branch?.base;if(!base)return false;
  if(field==='cross')return !(base.cross[key]||[]).includes(value);
  return !eq(base[field][key],frame.board[field][key]);
}
export function hasReasonMark(board,key){
  const [field,option]=key.split('~');
  return option===undefined?Boolean(board.marks[field]):Boolean(board.cross[field]?.includes(option));
}
export function reasonMarks(board){
  return [...Object.keys(board.marks), ...Object.entries(board.cross).flatMap(([key,values])=>values.map(v=>key+'~'+v))];
}
function unlink(f,key){
  delete f.board.links[key];
  for(const target of Object.keys(f.board.links)){
    const next=f.board.links[target].filter(s=>s!=='f:'+key);
    if(next.length)f.board.links[target]=next;else delete f.board.links[target];
  }
}
export function mark(a,key,v,action='mark'){
  return edit(a,f=>{
    const b=f.board, was=b.marks[key];
    const set=new Set(b.cross[key]||[]);
    if(action==='cross'){
      if(set.has(v))set.delete(v);else {set.add(v);if(was===v)delete b.marks[key];}
    } else if(action==='erase'){
      if(!v||was===v)delete b.marks[key];
      if(v)set.delete(v);else set.clear();
    } else {b.marks[key]=v;set.delete(v);}
    if(was!==b.marks[key] && was!==undefined)unlink(f,key);
    for(const oldValue of b.cross[key]||[])if(!set.has(oldValue))unlink(f,key+'~'+oldValue);
    if(set.size)b.cross[key]=[...set];else delete b.cross[key];
  });
}
export function addLink(a,target,source){
  if(a.solved||!hasReasonMark(a.frame.board,target))return '先に、つなぎ先のマスに印を置いてください。';
  const links=a.frame.board.links;
  if(source.startsWith('f:')){
    const k=source.slice(2), seen=new Set();
    if(!hasReasonMark(a.frame.board,k))return '印のあるマスか条件を選んでください。';
    function reaches(key){if(key===target)return true;if(seen.has(key))return false;seen.add(key);return (links[key]||[]).some(x=>x.startsWith('f:')&&reaches(x.slice(2)));}
    if(reaches(k))return '自分自身に戻るつながりです。別の根拠を選んでください。';
  }
  edit(a,f=>{f.board.links[target]=[...new Set([...(f.board.links[target]||[]),source])];});
  return '';
}
export function useHint(a,n){if(!a.stats.hints.includes(n)){a.stats.hints.push(n);changed(a);}}
export function explain(a,n){if(n>a.stats.explanation){a.stats.explanation=n;changed(a);}}
export function report(a,tag){const s=new Set(a.stats.self);if(s.has(tag))s.delete(tag);else s.add(tag);a.stats.self=[...s];changed(a);}
export function checkAnswer(p,a){
  const all=Object.entries(p.solution), marks=a.frame.board.marks;
  if(all.some(([k])=>!marks[k]))return 'incomplete';
  if(a.solved)return 'solved';
  a.stats.checks++;changed(a);
  if(all.some(([k,v])=>marks[k]!==v)){
    a.stats.wrong++;flag(a,'answer');return 'wrong';
  }
  // A full verified solution discharges the assumption, including every mark in it.
  a.stats.hintsAtClear=a.stats.hints.length;a.stats.explanationAtClear=a.stats.explanation;
  delete a.frame.branch;a.solved=Date.now();a.undo=[];a.redo=[];recover(a);return 'solved';
}
export function flag(a,kind){if(!a.pending){a.stats.conflicts++;a.pending=kind;changed(a);}}
export function recover(a){if(a.pending){a.stats.recoveries++;a.pending='';changed(a);}}
export function reconcile(p,a){
  if(!a.pending)return;
  if(a.pending==='answer'){
    // Count a return from a wrong submission only once the wrong entries are removed.
    if(!Object.entries(a.frame.board.marks).some(([k,v])=>p.solution[k]!==v))recover(a);
  }else if(!conflicts(p,a).length)recover(a);
}
function routeConflicts(p,marks){
  const {size:n,cells}=p.board, values=cells.map(c=>c.given||marks[c.key]||''), out=[];
  const neighbors=i=>[[0,-1],[0,1],[-1,0],[1,0]].map(([dy,dx])=>{
    const y=Math.floor(i/n)+dy,x=i%n+dx;return x>=0&&y>=0&&x<n&&y<n?y*n+x:-1;
  });
  cells.forEach((c,i)=>{
    const ns=neighbors(i), nv=ns.map(k=>k<0?'B':values[k]), white=nv.filter(v=>v==='W').length, possible=nv.filter(v=>v!=='B').length;
    if(values[i]==='W'){
      const needed=['S','G'].includes(c.badge)?1:2;
      if(white>needed||possible<needed)out.push(c.label+' の白に、道を '+needed+' 方向だけつなげられません。');
      if(c.badge==='直' && ![[0,1],[2,3]].some(pair=>pair.every(j=>nv[j]!=='B')&&nv.every((v,j)=>v!=='W'||pair.includes(j))))out.push(c.label+' を直進できる向きがありません。');
      if(c.badge==='曲' && ([0,1].every(j=>nv[j]==='W')||[2,3].every(j=>nv[j]==='W')||![0,1].some(j=>nv[j]!=='B')||![2,3].some(j=>nv[j]!=='B')))out.push(c.label+' で曲がるための縦横の道が足りません。');
    }
    if(c.given==='B'&&/^[0-4]$/.test(String(c.badge)) && (white>Number(c.badge)||possible<Number(c.badge)))out.push(c.label+' の数字と、上下左右の白の数が合いません。');
  });
  const start=values.indexOf('W'), seen=new Set(),todo=start<0?[]:[start];
  while(todo.length){const i=todo.pop();if(seen.has(i))continue;seen.add(i);for(const k of neighbors(i))if(k>=0&&values[k]!=='B'&&!seen.has(k))todo.push(k);}
  if(values.some((v,i)=>v==='W'&&!seen.has(i)))out.push('黒で隔てられ、ほかの白とつながれない白マスがあります。');
  const visited=new Set();
  for(let i=0;i<cells.length;i++){
    if(values[i]!=='W'||visited.has(i))continue;
    let vertices=0,edges=0;const stack=[i];
    while(stack.length){
      const v=stack.pop();if(visited.has(v))continue;visited.add(v);vertices++;
      const attached=neighbors(v).filter(k=>k>=0&&values[k]==='W');edges+=attached.length;
      for(const next of attached)if(!visited.has(next))stack.push(next);
    }
    if(edges/2>=vertices){out.push('白だけで一周できる輪があります。一本道は輪を作れません。');break;}
  }
  return out.concat(routeRelations(p,values));
}
export function conflicts(p,a){
  const b=a.frame.board;
  if(p.genre==='route')return routeConflicts(p,b.marks);
  const out=[];
  for(const t of p.board.tables){
    const used=new Map();
    for(const r of t.rows){
      const v=b.marks[r.key];
      if((b.cross[r.key]||[]).length===t.options.length)out.push(r.label+' の候補がすべて × になっています。');
      if(t.distinct!==false && v && used.has(v))out.push(used.get(v)+' と '+r.label+' の両方に「'+v+'」が入っています。');
      if(v)used.set(v,r.label);
    }
    if(t.distinct!==false&&!out.length&&!hasAssignment(t,b))out.push(t.title+' で、各行に違う候補を一つずつ割り当てられません。');
  }
  return out.concat(clueConflicts(p,b));
}
export const attemptsFor = (s,pid) => Object.values(s.attempts).filter(a=>a.pid===pid).sort((a,b)=>b.started-a.started||b.updated-a.updated);
export const didClear = (s,pid) => attemptsFor(s,pid).some(a=>a.solved);
export function growth(s,pid){
  const arr=attemptsFor(s,pid).reverse();
  return arr.some((a,i)=>a.solved && !(a.stats.hintsAtClear??a.stats.hints.length) && !(a.stats.explanationAtClear??a.stats.explanation) && arr.slice(0,i).some(b=>(b.stats.hintsAtClear??b.stats.hints.length)||b.stats.wrong||(b.stats.explanationAtClear??b.stats.explanation)));
}
export function evidence(s,puzzles,tag){
  const ids=new Set(puzzles.filter(p=>p.skills.includes(tag)).map(p=>p.id));
  const runs=Object.values(s.attempts).filter(a=>ids.has(a.pid));
  return {runs:runs.length, kinds:new Set(runs.map(a=>a.pid)).size,solves:runs.filter(a=>a.solved).length,h2:runs.filter(a=>a.stats.hints.includes(2)).length, self:runs.filter(a=>a.stats.self.includes(tag)).length,recover:runs.reduce((v,a)=>v+a.stats.recoveries,0)};
}
export function reviewList(s,puzzles,tag){
  const pool=puzzles.filter(p=>!tag||p.skills.includes(tag));
  function rank(p){
    const runs=attemptsFor(s,p.id), last=runs[0];
    if(!last)return 2;
    if(last.mode==='review'&&last.solved)return 5;
    if(last.stats.self.includes(tag)||last.stats.wrong||last.stats.hints.length||last.stats.conflicts)return 0;
    return last.solved?4:1;
  }
  return [...pool].sort((a,b)=>rank(a)-rank(b)||Math.abs(a.level-3)-Math.abs(b.level-3)||a.level-b.level||a.id.localeCompare(b.id));
}

