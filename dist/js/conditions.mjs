// Evaluate only evidence visible on the player's board. null means undecided.
function tableExpression(node,tables,locations){
  if(typeof node==='number')return node;
  const [op,...args]=node;
  if(op==='at')return locations.get(args[0])??null;
  if(['row','inv','changed'].includes(op)){
    const rows=tables.get(args[0]);if(!rows)return null;
    if(op==='changed')return rows.includes(null)?null:rows.filter((v,i)=>v!==args[1][i]).length;
    const index=tableExpression(args[1],tables,locations);if(index===null)return null;
    if(op==='row')return rows[index-1]??null;
    const i=rows.indexOf(index);return i<0?null:i+1;
  }
  const vs=args.map(n=>tableExpression(n,tables,locations)),[x,y]=vs;
  if(op==='and')return vs.includes(false)?false:vs.includes(null)?null:true;
  if(op==='or')return vs.includes(true)?true:vs.includes(null)?null:false;
  if(vs.includes(null))return null;
  switch(op){case 'eq':return x===y;case 'ne':return x!==y;case 'lt':return x<y;case 'add':return x+y;case 'distance':return Math.abs(x-y);case 'in':return vs.slice(1).includes(x);default:return null;}
}
export function clueConflicts(p,b){
  const out=[],tables=new Map(),locations=new Map();
  if(p.genre==='logic')for(const t of p.board.tables){
    tables.set(t.id,t.rows.map(r=>{const n=t.options.indexOf(b.marks[r.key])+1;locations.set(r.key,n||null);return n||null;}));
  }
  for(const [i,clue] of p.clues.entries()){
    let broken=false;
    if(p.genre==='logic')broken=tableExpression(clue.test,tables,locations)===false;
    if(p.genre==='symbol'){
      const c=clue.constraint;
      if(c.type==='domain')continue;
      const words=[c.left,c.right,...(c.result?[c.result]:[])];
      if(words.some(w=>w.length>1&&b.marks[w[0]]==='0'))broken=true;
      const vals=words.map(w=>{
        const digits=[...w].map(k=>/^[0-9]$/.test(k)?k:b.marks[k]);
        return digits.includes(undefined)?null:Number(digits.join(''));
      });
      if(!vals.includes(null)){
        const [l,r,n]=vals;broken ||= c.type==='less'?l>=r:(c.op==='+'?l+r:l-r)!==n;
      }
    }
    if(broken)out.push('条件 '+(i+1)+'「'+clue.text+'」と、置いた値が合いません。');
  }
  return out;
}
export function hasAssignment(t,b){
  const assigned=new Map();
  function find(row,seen){
    const allowed=b.marks[row.key]?[b.marks[row.key]]:t.options.filter(v=>!(b.cross[row.key]||[]).includes(v));
    for(const v of allowed){
      if(seen.has(v))continue;
      seen.add(v);
      if(!assigned.has(v)||find(assigned.get(v),seen)){assigned.set(v,row);return true;}
    }
    return false;
  }
  return t.rows.every(r=>find(r,new Set()));
}
export function routeRelations(p,values){
  const board=p.board, map=new Map(board.cells.map((c,i)=>[c.key,values[i]])),out=[];
  for(const c of board.constraints){
    if(!c.cells)continue;
    const vs=c.cells.map(k=>map.get(k)),known=vs.filter(Boolean),whites=vs.filter(v=>v==='W').length;
    let broken=false;
    if(c.type==='quota')broken=whites>c.number||whites+vs.length-known.length<c.number;
    if(c.type==='same')broken=known.includes('W')&&known.includes('B');
    if(c.type==='different')broken=known.length===2&&vs[0]===vs[1];
    if(c.type==='implies')broken=vs[0]===c.values[0]&&!!vs[1]&&vs[1]!==c.values[1];
    if(broken){const idx=p.clues.findIndex(x=>x.id===c.id);out.push('条件 '+(idx+1)+'「'+p.clues[idx].text+'」と、置いた色が合いません。');}
  }
  return out;
}

