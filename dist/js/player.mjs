import {GENRES,fields,labelFor,valueLabel,isTrial,hasReasonMark,reasonMarks} from './model.mjs';
import {esc as E,icon as I} from './visual.mjs';
import {act,link,panel} from './pages.mjs';
const dis=(yes)=>yes?'disabled':'';
const eqText=(p,k,v)=>E(labelFor(p,k))+' ＝ '+E(valueLabel(p,v));
const shape=(label)=>`<span class="cell-symbol">${label}</span>`;
const hintTitles=['着眼点','推理の接続','具体的な一手'];
function markName(p,b,key){
  const [field,option]=key.split('~');
  return labelFor(p,field)+(option===undefined?' ＝ '+valueLabel(p,b.marks[field]):' · '+option+'（×）');
}
function sourceName(p,b,id){
  if(id.startsWith('c:'))return '条件 '+(p.clues.findIndex(c=>c.id===id.slice(2))+1);
  return markName(p,b,id.slice(2));
}
export function clueList(p,b,action){
  return `<ol class="clues">${p.clues.map((c,i)=>`<li><button type="button" data-action="${action}" data-id="${E(c.id)}" class="clue ${b.focus===c.id?'on':''}" aria-pressed="${b.focus===c.id}"><b>${String(i+1).padStart(2,'0')}</b><span>${E(c.text)}</span></button></li>`).join('')}</ol>`;
}
function routeBoard(p,a,u){
  const {size:n,cells}=p.board,b=a.frame.board,all=cells.map(c=>c.given||b.marks[c.key]);
  const rule=p.board.constraints.find(c=>c.id===b.focus);
  const related=new Set(rule?.at?[rule.at]:rule?.cells||[]);
  const visit=(i,dy,dx)=>{const x=i%n+dx,y=Math.floor(i/n)+dy;return x>=0&&x<n&&y>=0&&y<n?y*n+x:-1;};
  let html='<span class="coordinate origin"></span>';
  for(let x=0;x<n;x++)html+=`<span class="coordinate">${String.fromCharCode(65+x)}</span>`;
  cells.forEach((c,i)=>{
    if(i%n===0)html+=`<span class="coordinate">${Math.floor(i/n)+1}</span>`;
    const v=all[i],trial=!c.given && v&&isTrial(a.frame,'marks',c.key),sel=u.key===c.key;
    const spotted=related.has(c.key);
    const name=[c.label,c.badge,c.given?'固定':null,valueLabel(p,v),trial?'仮定':null,spotted?'注目条件':null].filter(Boolean).join(' ');
    let lines='';if(v==='W'){
      for(const [dy,dx,cls] of [[-1,0,'north'],[1,0,'south'],[0,-1,'west'],[0,1,'east']]){
        const j=visit(i,dy,dx);if(j>=0&&all[j]==='W')lines+=`<i aria-hidden="true" class="path-line ${cls} ${trial||(!cells[j].given&&isTrial(a.frame,'marks',cells[j].key))?'tentative':''}"></i>`;
      }
    }
    const symbol=c.badge??(v==='W'?'○':v==='B'?(c.given?'':'■'):'');
    html+=`<button class="tile ${v==='W'?'white':v==='B'?'black':'unknown'} ${c.given?'fixed':''} ${trial?'trial':''} ${sel?'selected':''} ${c.badge?'badged':''}" type="button" data-action="cell" data-key="${E(c.key)}" aria-label="${E(name)}" aria-pressed="${sel}">${lines}${shape(E(symbol))}${spotted?'<i class="focus-mark"></i>':''}${trial?'<b class="trial-mark">?</b>':''}${b.notes[c.key]?'<i class="note-mark">＊</i>':''}</button>`;
  });
  const cell=u.fit?`min(44px, calc((100cqw - ${24+n}px) / ${n}))`:Math.round(44*u.zoom)+'px';
  return `<div class="board-scroll" data-scroll="route" tabindex="0" aria-label="ルート盤面、はみ出す部分はスクロール"><div class="route-board ${u.fit?'overview':''}" style="--n:${n};--cell:${cell}">${html}</div></div>`;
}
function matrixBoard(p,a,u){
  const b=a.frame.board;
  return p.board.tables.map((t,i)=>`<section class="matrix-section"><h3>${E(t.title)}</h3><div class="board-scroll" data-scroll="table-${i}" tabindex="0" aria-label="${E(t.title)}、横にスクロールできます"><table class="matrix" style="--cell:${Math.round(44*u.zoom)}px"><thead><tr><th scope="col">${p.genre==='symbol'?'記号':'項目'}</th>${t.options.map(v=>`<th scope="col">${E(v)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr><th scope="row">${E(r.label)}</th>${t.options.map(v=>{
    const yes=b.marks[r.key]===v,no=(b.cross[r.key]||[]).includes(v),sel=u.key===r.key&&u.opt===v,trial=(yes&&isTrial(a.frame,'marks',r.key))||(no&&isTrial(a.frame,'cross',r.key,v));
    return `<td><button type="button" class="matrix-cell ${yes?'yes':no?'no':''} ${trial?'trial':''} ${sel?'selected':''}" data-action="cell" data-key="${E(r.key)}" data-opt="${E(v)}" aria-pressed="${sel}" aria-label="${E(r.label)}・${E(v)}・${yes?'○':no?'×':'未確定'}${trial?'・仮定':''}">${yes?'○':no?'×':'·'}${trial?'<b class="trial-mark">?</b>':''}${b.notes[r.key+'~'+v]?'<i class="note-mark">＊</i>':''}</button></td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('');
}
export function reasonTarget(p,b,view){
  const {key,opt}=view;
  if(p.genre==='route'||b.marks[key]===opt)return key;
  return key+'~'+opt;
}
function organize(p,a,u){
  const f=a.frame,b=f.board,k=u.key,fk=k+(u.opt?'~'+u.opt:''),readonly=a.solved?'disabled':'',selection=!!k;
  const reasonKey=reasonTarget(p,b,u),valid=selection&&hasReasonMark(b,reasonKey);
  const target=selection?E(labelFor(p,k))+(u.opt?' · '+E(u.opt):''):'未選択';
  const links=Object.entries(b.links);
  const sources=[...p.clues.map(c=>'c:'+c.id),...reasonMarks(b).filter(x=>x!==reasonKey).map(x=>'f:'+x)];
  const facts=Object.entries(b.marks).filter(([id])=>!isTrial(f,'marks',id)),trials=Object.entries(b.marks).filter(([id])=>isTrial(f,'marks',id));
  const rowList=ar=>ar.length?ar.map(([id,v])=>`<span class="fact">${eqText(p,id,v)}</span>`).join(''):'<span class="muted">まだありません。</span>';
  return panel('notes','マスのメモと推理のつながり',`<p class="selection">選択中 <b>${target}</b></p>${selection?`<form data-form="note"><label for="tile-note">このマスのメモ</label><textarea id="tile-note" name="note" maxlength="600" rows="2" ${readonly}>${E(b.notes[fk]||'')}</textarea><button class="btn small" ${readonly}>メモを保存</button></form>`:'<p class="muted">「調べる」を選んでから、盤面や表のマスをタップしてください。</p>'}
  ${valid?`<form data-form="link"><label for="reason-src">${E(markName(p,b,reasonKey))} の根拠</label><select id="reason-src" name="source" ${readonly}>${sources.map(id=>`<option value="${E(id)}" ${id==='c:'+b.focus?'selected':''}>${E(sourceName(p,b,id))}${id.startsWith('c:')?' · '+E(p.clues.find(c=>c.id===id.slice(2)).text):''}</option>`).join('')}</select><button class="btn small" ${readonly}>根拠をつなぐ</button></form>`:''}
  ${links.length?`<h3>推理のつながり</h3><ul class="reasons">${links.map(([id,ss])=>`<li>${ss.map(x=>E(sourceName(p,b,x))).join(' ＋ ')} <span aria-label="から">→</span> ${E(markName(p,b,id))}${isTrial(f,'links',id)?'（仮定）':''}</li>`).join('')}</ul>`:''}`,'link')+
  panel('facts','確定情報の一覧',`<p class="caption">自分で確定した ${facts.length} 件</p><div class="facts">${rowList(facts)}</div>${f.branch?`<p class="caption">仮定「${E(f.branch.name)}」で置いた ${trials.length} 件</p><div class="facts">${rowList(trials)}</div>`:''}`,'list');
}
function guidance(p,a,u){
  const openHints=u.hintCount||0,n=u.steps||0;
  const ids=cs=>cs.map(id=>'条件 '+(p.clues.findIndex(c=>c.id===id)+1)).join('・');
  return panel('guide','ヒント・解説',`<div class="hints">${p.hints.slice(0,openHints).map((h,i)=>`<article><small>ヒント ${i+1} ／ ${hintTitles[i]}</small><p>${E(h.text)}</p><span class="caption">${E(ids(h.clues))}</span></article>`).join('')}
  ${openHints<3?act('hint',I('bulb',16)+' ヒント'+(openHints+1)+'「'+hintTitles[openHints]+'」を見る','','btn'):'<p class="caption">3段階のヒントを表示しました。</p>'}</div>
  <div class="walkthrough"><h3>段階解説</h3>${n?`${p.steps.slice(0,n).map((step,i)=>`<article><small>手順 ${i+1} / ${p.steps.length}</small><h4>${E(step.title)}</h4><p>${E(step.text)}</p><span class="caption">${E(ids(step.clues))}</span></article>`).join('')}${n<p.steps.length?act('step','次の手順を見る') : `<h4>間違えやすいところ</h4><p>${E(p.pitfall)}</p><h4>次の問題で使うなら</h4><p>${E(p.transfer)}</p>`}`:`<p class="muted">解答に至る過程を一手ずつ開きます。</p>${act('explain','解説を開く') }`}</div>`,'bulb');
}
export function player(p,a,u){
  const b=a.frame.board,trial=a.frame.branch,route=p.genre==='route',completed=Object.keys(b.marks).length,total=fields(p).length,g=GENRES[p.genre];
  const opts=route?[['W','○ 白'],['B','■ 黒'],['inspect','調べる'],['erase','消す']]:[['mark','○ 入れる'],['cross','× 除外'],['inspect','調べる'],['erase','消す']];
  const focus=p.clues.find(c=>c.id===b.focus);
  return `${link('genre/'+p.genre,g.name,'crumb')}<div class="play-heading"><div><div class="line-meta">Lv.${p.level} ・ ${a.mode==='review'?'重点復習':g.name}</div><h1>${E(p.title)}</h1><p>${E(p.intro)}</p></div></div>
  <div class="play-grid"><div class="play-primary"><section class="panel board-panel"><div class="board-heading"><div><h2>${route?'ルート盤面':p.genre==='symbol'?'数字の候補表':'推理の対応表'}</h2><span class="quiet">${route?(p.board.size+' × '+p.board.size+'　'):''}${completed} / ${total} 入力</span></div><div class="zoom" aria-label="盤面の拡大縮小">${route?act('fit',u.fit?'入力表示':'全体表示',`aria-pressed="${Boolean(u.fit)}"`,'btn small fit-btn'):''}${u.fit?'':act('zoom-out','−',`aria-label="盤面を縮小" ${dis(u.zoom<=.75)}`,'icon-btn')+`<span>${Math.round(u.zoom*100)}%</span>`+act('zoom-in','＋',`aria-label="盤面を拡大" ${dis(u.zoom>=1.75)}`,'icon-btn')}</div></div>
  ${p.board.equations?`<div class="equations" aria-label="計算式">${p.board.equations.map(eq=>`<div>${E(eq)}</div>`).join('')}</div>`:''}
  <div class="focus-strip">${I('pin',15)}<span>${focus?'注目中の条件 '+(p.clues.indexOf(focus)+1)+'　'+E(focus.text):'注目する手がかりを選べます'}</span>${act('to-clues','条件を見る','','text-link')}</div>
  ${trial?`<div class="trial-banner">${I('branch',17)}<b>仮定中 · ${E(trial.name)}</b>${act('discard','仮定前に戻す','','btn small')}</div>`:''}
  ${u.fit?`<p class="overview-note">全体表示中 · タップして位置を確認${u.key?' ／ '+E(labelFor(p,u.key)):''}</p>`:!a.solved?`<div class="brushes" aria-label="入力方法">${opts.map(([k,v])=>act('brush',v,`data-value="${k}" aria-pressed="${u.brush===k}"`,u.brush===k?'tool chosen':'tool')).join('')}</div>`:''}
  ${route?routeBoard(p,a,u):matrixBoard(p,a,u)}
  <div class="board-key"><span><b>○</b> ${route?'白':'対応'}</span><span><b>${route?'■':'×'}</b> ${route?'黒':'除外'}</span><span><b class="key-trial">?</b> 仮定</span><span>${route?'空欄':'·'} 未確定</span></div>
  ${a.solved?`<div class="clear-msg">${I('check',20)}<b>クリアしました</b></div><div class="actions">${act('retry','この問題を復習する','data-pid="'+p.id+'"','btn primary')}${link('records','学習記録へ')}</div>`:`<div class="board-actions"><div class="actions">${act('undo',I('undo',16)+' 一手戻す',dis(!a.undo.length),'btn small')}${act('redo',I('redo',16)+' やり直す',dis(!a.redo.length),'btn small')}</div><div class="actions">${act('inspect-check','矛盾を点検','','btn small')}${act('grade','解答を判定','','btn primary')}</div></div>`}
  ${u.feedback?`<div role="status" class="feedback ${u.feedback.bad?'bad':''}">${E(u.feedback.text)}</div>`:''}</section>
  ${panel('branch','仮定・チェックポイント',`<p>仮定中に置いた印、候補、メモ、根拠は、仮定前にまとめて戻せます。</p><div class="actions">${trial?act('discard','「'+E(trial.name)+'」の前へ戻す',dis(a.solved)):act('begin',I('branch',16)+' 名前を付けて仮定',dis(a.solved))}${act('point',I('flag',16)+' ここを保存',dis(a.solved))}</div>${a.points.length?`<ul class="point-list">${a.points.map(c=>`<li><span>${E(c.name)}${c.frame.branch?'（仮定中）':''}</span>${act('restore','ここへ戻す',`data-id="${E(c.id)}" ${dis(a.solved)}`,'btn small')}</li>`).join('')}</ul>`:''}`,'branch')}
  ${organize(p,a,u)}</div><aside class="play-aside"><section class="panel padded" id="clue-panel" tabindex="-1"><div class="mini-heading">${I('list',18)}<h2>手がかり</h2></div>${clueList(p,b,'focus')}</section>
  ${panel('rules','遊び方・ルール',`<ul>${p.rules.map(r=>`<li>${E(r)}</li>`).join('')}</ul><p>${route?'白・黒を選んで空きマスをタップします。隣り合う白には自動で線が付きます。':'○か×を選び、行と列の交点をタップします。○は一行に一つ。×は候補から外す印です。'}</p>`,'book')}
  ${guidance(p,a,u)}
  ${panel('reflection','振り返り',`<p>この問題で、どこで手が止まりましたか。あとから変更できます。</p><div class="choose-skills">${p.skills.map(t=>act('self',E(t),`data-value="${E(t)}" aria-pressed="${a.stats.self.includes(t)}"`,a.stats.self.includes(t)?'filter on':'filter')).join('')}</div>${a.solved?'':act('restart','最初からもう一度','','text-link')}`,'note')}
  </aside></div>`;
}

