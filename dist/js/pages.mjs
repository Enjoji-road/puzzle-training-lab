import {GENRES,SKILLS,GOALS,attemptsFor,didClear,growth,evidence,reviewList} from './model.mjs';
import {esc as E,icon as I,stamp} from './visual.mjs';
export const act=(action,text,attrs='',cl='btn')=>`<button type="button" class="${cl}" data-action="${action}" ${attrs}>${text}</button>`;
export const link=(url,text,cl='btn')=>`<a class="${cl}" href="#/${url}">${text}</a>`;
export const tag=t=>`<span class="tag">${E(t)}</span>`;
export const panel=(id,title,body,ico='list',open=false)=>`<details class="panel fold" data-panel="${id}" ${open?'open':''}><summary>${I(ico)}<span>${title}</span>${I('chevron',17)}</summary><div class="fold-body">${body}</div></details>`;
const head=(title,desc='')=>`<div class="page-title"><div><h1>${title}</h1>${desc?`<p>${desc}</p>`:''}</div></div>`;
const section=(title,side='')=>`<div class="section-title"><h2>${title}</h2>${side}</div>`;
export const pill=(kind,text)=>`<span class="pill ${kind}">${text}</span>`;
const primary=ps=>ps.filter(p=>p.pool!=='review');
const number=(a,b)=>`<span class="metric">${a}<small> / ${b}</small></span>`;
const navItems=[['home','home','ホーム'],['catalog','grid','問題一覧'],['review','focus','重点復習'],['records','chart','学習記録']];
export function navigation(where,dark){
  const active=({genre:'catalog',play:'catalog',analysis:'records'})[where]||where;
  const items=navItems.map(([url,img,name])=>`<a href="#/${url}" class="nav-item ${active===url?'active':''}" ${active===url?'aria-current="page"':''}>${I(img,18)}<span>${name}</span></a>`).join('');
  return [`<div class="head-inner"><a class="brand" href="#/home" aria-label="Puzzle Training Lab ホーム"><img src="./icon.svg" width="36" height="36" alt=""><span>Puzzle Training <b>Lab</b></span></a><nav aria-label="メインナビゲーション">${items}</nav>${act('theme',I(dark?'sun':'moon',20),`aria-label="${dark?'ライト':'ダーク'}モードに切り替え" title="表示テーマを切り替え"`,'icon-btn theme')}</div>`,items];
}
function genreCards(state,ps){
  return `<div class="genre-grid">${Object.entries(GENRES).map(([id,g])=>{
    const list=primary(ps).filter(p=>p.genre===id),n=list.filter(p=>didClear(state,p.id)).length;
    return `<a class="genre-card ${id}" href="#/genre/${id}"><div class="card-art"><canvas data-art="${id}" aria-hidden="true"></canvas></div><div class="card-body"><h3>${g.name}</h3><p>${g.desc}</p><div class="genre-meta"><span>${list.length}問</span><i></i><span>Lv.1–5</span><span class="genre-count">${n}/${list.length} クリア</span></div></div></a>`;
  }).join('')}</div>`;
}
function miniStats(state,ps){
  const arr=Object.values(state.attempts),base=primary(ps);
  return `<div class="mini-stats">${[
    ['flag','クリアした問題',base.filter(p=>didClear(state,p.id)).length,' / '+base.length+' 問'],
    ['repeat','復習でクリア',new Set(arr.filter(a=>a.solved&&a.mode==='review').map(a=>a.pid)).size,' 問'],
    ['layers','練習したスキル',SKILLS.filter(t=>evidence(state,ps,t).runs).length,' / '+SKILLS.length+' 種類']
  ].map(([i,t,n,s])=>`<div><span class="stat-icon">${I(i,21)}</span><div><p>${t}</p><strong>${n}</strong><small>${s}</small></div></div>`).join('')}</div>`;
}
export function home(s,ps){
  const a=s.attempts[s.last], ongoing=a&&!a.solved?a:Object.values(s.attempts).filter(r=>!r.solved).sort((x,y)=>y.updated-x.updated)[0];
  const recommended=ps.find(p=>p.id==='route-2'),p=ongoing?ps.find(p=>p.id===ongoing.pid):recommended;
  const g=GENRES[p.genre];
  return `<div class="page-title home-title"><h1>トレーニングホーム</h1><span class="quiet home-total">${I('layers',16)} 3ジャンル・全${primary(ps).length}問</span></div>
  <section class="hero"><div class="hero-copy"><div class="hero-label">${I(ongoing?'history':'compass',19)} ${ongoing?'前回の続き':'おすすめの一問'}</div><div class="hero-meta"><span class="level">Lv.${p.level}</span><span>${g.name}</span></div><h2>${E(p.title)}</h2><p>${E(p.goal)}。</p>${ongoing?link('play/'+ongoing.id,I('play',16)+' 続きから解く','btn mint'):act('start',I('play',16)+' この問題を解く',`data-pid="${p.id}"`,'btn mint')}</div>
  <div class="hero-picture"><canvas data-art="hero-${p.genre}" aria-hidden="true"></canvas>${p.genre==='route'?'<div class="drawing-key"><span><i></i>確定</span><span><i></i>仮定</span></div>':''}</div></section>
  <section>${section('ジャンルから選ぶ',link('catalog','問題一覧','text-link'))}${genreCards(s,ps)}</section>
  <section>${section('学習のようす',link('records','学習記録を見る','text-link'))}${miniStats(s,ps)}</section>`;
}
function row(s,p,review=false){
  const tries=attemptsFor(s,p.id),clear=tries.some(a=>a.solved),seen=tries.length;
  return `<div class="problem-row"><div class="lv-box ${p.genre}"><small>Lv.</small>${p.level}</div><div class="problem-details"><div class="line-meta">${GENRES[p.genre].short} · ${p.pool==='review'?'復習問題':GOALS[p.level-1]}</div><h3>${E(p.title)}</h3><p>${E(p.goal)}</p></div><div class="row-end">${clear?pill('success',I('check',14)+' クリア'):seen?pill('neutral','挑戦中'):''}${act(review?'review-start':'start',review?'復習する':clear?'もう一度':seen?'続きへ':'解く',`data-pid="${p.id}"`,'btn small')}</div></div>`;
}
function levelPicker(filter){
  return `<label class="level-filter">レベル <select id="level-filter">${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${n===filter?'selected':''}>${n?'Lv.'+n:'すべて'}</option>`).join('')}</select></label>`;
}
export function catalog(s,ps,genre,filter){
  const g=GENRES[genre],base=primary(ps).filter(p=>!g||p.genre===genre);
  const heading=g?g.name:'問題一覧';
  return `${g?link('catalog','問題一覧','crumb'):''}${head(heading,g?g.desc:'ジャンルとレベルを選んで、練習する問題を開きましょう。')}
  <div class="genre-filters">${link('catalog','すべて',!g?'filter on':'filter')}${Object.entries(GENRES).map(([k,v])=>link('genre/'+k,I(v.icon,16)+v.short,genre===k?'filter on':'filter')).join('')}</div>
  <div class="section-title compact"><h2>難易度を選ぶ</h2>${levelPicker(filter)}</div>
  <div class="panel row-list">${base.filter(p=>!filter||p.level===filter).sort((a,b)=>a.level-b.level).map(p=>row(s,p)).join('')}</div>`;
}
export function review(s,ps,tagName,level=0,genre=''){
  const selected=SKILLS.includes(tagName)?tagName:'';
  const list=reviewList(s,ps,selected).filter(p=>(!level||p.level===level)&&(!genre||p.genre===genre));
  const genrePicker=`<label class="level-filter">ジャンル <select id="review-genre"><option value="">すべて</option>${Object.entries(GENRES).map(([k,g])=>`<option value="${k}" ${k===genre?'selected':''}>${g.short}</option>`).join('')}</select></label>`;
  return `${head('重点復習','練習したい考え方を選ぶと、同じスキルを使う問題を別のジャンルからも探せます。')}
  <section class="panel padded"><h2>練習するスキル</h2><div class="choose-skills">${link('review','すべて',!selected?'filter on':'filter')}${SKILLS.map((t,i)=>link('review/'+i,E(t),selected===t?'filter on':'filter')).join('')}</div></section>
  ${section(selected?E(selected)+' の演習':'復習できる問題',`<span class="quiet">${list.length}問</span>`)}
  <div class="review-filters">${genrePicker}${levelPicker(level)}</div>
  <div class="panel row-list">${list.length?list.map(p=>row(s,p,true)).join(''):'<p class="empty">このスキル・ジャンル・レベルの組み合わせに該当する問題はありません。</p>'}</div>`;
}
function tabs(current){return `<div class="tabs">${link('records','学習記録',current==='records'?'current':'')}${link('analysis','苦手分析',current==='analysis'?'current':'')}</div>`;}
export function analysis(s,ps){
  const strongest=SKILLS.map(t=>({t,...evidence(s,ps,t)})).filter(e=>e.self||e.h2).sort((a,b)=>b.self-a.self||b.h2-a.h2);
  return `${head('苦手分析','困ったと感じた場面と、使ったヒントを振り返れます。数字は次に練習する題材を選ぶ目安です。')}${tabs('analysis')}
  <div class="panel padded"><h2>記録から見えること</h2>${strongest.length?strongest.slice(0,3).map(e=>`<p><b>${E(e.t)}</b>を使う${e.runs}回の挑戦のうち、${e.self?'「困った」と記録した回が'+e.self+'回':'ヒント2を開いた回が'+e.h2+'回'}あります。 ${link('review/'+SKILLS.indexOf(e.t),'このスキルを復習','text-link')}</p>`).join(''):'<p class="muted">ヒント2を開いたり、問題の「振り返り」に困ったことを残したりすると、ここに傾向が表示されます。</p>'}</div>
  ${section('スキルごとの練習状況')}<div class="panel row-list">${SKILLS.map((t,i)=>{const e=evidence(s,ps,t);return `<div class="analysis-row"><div><h3>${E(t)}</h3><p>${e.kinds}問・${e.runs}回挑戦 ／ ヒント2 ${e.h2}回 ／ 自己申告 ${e.self}回</p></div>${link('review/'+i,'復習','btn small')}</div>`;}).join('')}</div>`;
}
function bars(title,items){
  return `<section class="panel padded"><h2>${title}</h2>${items.map(([n,v,t])=>`<div class="bar-entry"><div><span>${n}</span>${number(v,t)}</div><div class="bar"><i style="width:${t?v/t*100:0}%"></i></div></div>`).join('')}</section>`;
}
export function records(s,ps){
  const base=primary(ps),runs=Object.values(s.attempts).sort((a,b)=>b.started-a.started||b.updated-a.updated),improved=ps.filter(p=>growth(s,p.id));
  const count=arr=>[arr.filter(p=>didClear(s,p.id)).length,arr.length];
  return `${head('学習記録')}${tabs('records')}${miniStats(s,ps)}
  <div class="two-col">${bars('ジャンル別クリア数',Object.entries(GENRES).map(([k,g])=>[g.name,...count(base.filter(p=>p.genre===k))]))}${bars('難易度別クリア数',[1,2,3,4,5].map(n=>['Lv.'+n,...count(base.filter(p=>p.level===n))]))}</div>
  <section class="panel padded"><h2>前回からの変化</h2>${improved.length?improved.map(p=>`<p class="positive">${I('check',16)} ${E(p.title)}を、再挑戦でヒント・解説を使わずクリアしました。</p>`).join(''):'<p class="muted">ヒントや解説を使った問題、または誤答した問題を、次の挑戦で自力でクリアするとここに残ります。</p>'}</section>
  ${section('挑戦の履歴',link('analysis','スキル別に見る','text-link'))}<div class="panel row-list">${runs.length?runs.map(a=>{
    const p=ps.find(q=>q.id===a.pid),x=a.stats;
    return `<div class="history-row"><div class="line-meta">${stamp(a.started)} · ${a.mode==='review'?'重点復習':'通常練習'} · Lv.${p.level}</div><h3>${link('play/'+a.id,E(p.title),'inline-link')} ${pill(a.solved?'success':'neutral',a.solved?'クリア':'途中')}</h3><p>ヒント ${x.hints.length}/3　解説 ${x.explanation?'閲覧済み':'未使用'}　誤答 ${x.wrong}回　仮定 ${x.branches}回　矛盾から復帰 ${x.recoveries}/${x.conflicts}回</p><p>一手戻す ${x.undos}回　巻き戻し ${x.restores}回　最初から ${x.restarts}回${x.self.length?'　振り返り：'+x.self.map(E).join('・'):''}</p></div>`;
  }).join(''):'<p class="empty">まだ挑戦の記録がありません。問題を開くとここから再開できます。</p>'}</div>
  <section class="panel padded backup"><div><h2>記録のバックアップ</h2><p>記録はこのブラウザに保存されます。ブラウザのデータ消去や端末変更に備えて、JSONを書き出しておけます。</p></div><div class="actions">${act('export',I('down',16)+' 書き出す')}${act('import',I('up',16)+' 読み込む')}</div></section>`;
}

