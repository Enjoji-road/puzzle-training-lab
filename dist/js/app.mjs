import * as M from './model.mjs';
import {readLocal,saveLocal,parseBackup,STORAGE_KEY} from './storage.mjs';
import {home,catalog,review,analysis,records,navigation} from './pages.mjs';
import {clueList,player,reasonTarget} from './player.mjs';
import {esc as E,paintArt} from './visual.mjs';
const main=document.getElementById('main'),dialog=document.getElementById('dialog');
const qs=s=>document.querySelector(s);
const media=matchMedia('(prefers-color-scheme: dark)');
let puzzles=[],state,where,arg,level=0,view={},attempt,puzzle,saveError='',timer,dialogDone;
function go(path){location.hash='/'+path;}
function save(replace=false){
  if(!saveLocal(state,replace))saveError='ブラウザに保存できませんでした。学習記録からJSONを書き出すと、このタブの記録を保管できます。';
}
function toast(msg){
  const box=qs('#toast');box.textContent=msg;box.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>box.classList.remove('visible'),3000);
}
function modal(title,body,confirm,callback,input=''){
  dialogDone=callback;
  dialog.innerHTML=`<form method="dialog" class="dialog-form"><h2 id="dialog-title">${E(title)}</h2><p>${E(body)}</p>${input?`<label>名前<input name="entry" type="text" maxlength="60" value="${E(input)}"></label>`:''}<div class="actions"><button value="cancel" class="btn">閉じる</button><button value="ok" class="btn primary">${E(confirm)}</button></div></form>`;
  dialog.setAttribute('aria-labelledby','dialog-title');
  dialog.returnValue='';dialog.showModal();const el=dialog.querySelector('input');if(el){el.focus();el.select();}
}
function openClues(p,board){
  dialogDone=null;
  dialog.returnValue='';
  dialog.innerHTML=`<div class="clue-dialog"><h2 id="clue-title">手がかり</h2><p class="muted">条件を選ぶと、盤面の上に表示されます。</p>${clueList(p,board,'pick-clue')}<form method="dialog"><button class="btn">閉じる</button></form></div>`;
  dialog.setAttribute('aria-labelledby','clue-title');
  dialog.showModal();
}
dialog.addEventListener('close',()=>{const cb=dialogDone;dialogDone=null;if(dialog.returnValue==='ok'&&cb)cb(dialog.querySelector('input')?.value||'');});
function theme(){
  const dark=state.theme==='dark'||(state.theme==='system'&&media.matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  qs('meta[name="theme-color"]').content=dark?'#122329':'#f6f8f7';return dark;
}
function getPage(){
  const parts=location.hash.replace(/^#\/?/,'').split('/');
  where=parts[0]||'home';arg=parts[1]||'';
  if(!['home','catalog','genre','play','records','review','analysis'].includes(where))where='home';
  attempt=where==='play'?state.attempts[arg]:null;
  puzzle=attempt?puzzles.find(p=>p.id===attempt.pid):null;
  if(where==='play'&&(!puzzle||!attempt))where='catalog';
}
function navigate(){
  level=0;getPage();
  view={key:'',opt:'',brush:puzzle?.genre==='route'?'W':'mark',zoom:1,fit:false,hintCount:0,steps:0};
  if(attempt&&state.last!==attempt.id){state.last=attempt.id;save();}
  render(false);window.scrollTo(0,0);main.focus({preventScroll:true});
}
function render(retain=true){
  const panels=retain?[...main.querySelectorAll('details[open]')].map(e=>e.dataset.panel):[];
  const scrolled=retain?[...main.querySelectorAll('[data-scroll]')].map(e=>[e.dataset.scroll,e.scrollLeft,e.scrollTop]):[];
  const prev=retain?document.activeElement:null;
  let focusTarget='';
  if(prev?.matches('[data-action]')&&main.contains(prev)){
    focusTarget='[data-action="'+CSS.escape(prev.dataset.action)+'"]';
    for(const k of ['key','opt','value','id','pid'])if(prev.dataset[k])focusTarget+='[data-'+k+'="'+CSS.escape(prev.dataset[k])+'"]';
  }
  if(where==='play'){attempt=state.attempts[arg];puzzle=puzzles.find(p=>p.id===attempt?.pid);}
  const nav=navigation(where,theme());
  qs('#header').innerHTML=nav[0];qs('#mobile-nav').innerHTML=nav[1];
  let html;
  switch(where){
    case 'catalog':case 'genre':html=catalog(state,puzzles,where==='genre'?arg:'',level);break;
    case 'play':html=player(puzzle,attempt,view);break;
    case 'review':html=review(state,puzzles,arg!==''?M.SKILLS[Number(arg)]:'');break;
    case 'records':html=records(state,puzzles);break;
    case 'analysis':html=analysis(state,puzzles);break;
    default:html=home(state,puzzles);
  }
  main.innerHTML=(saveError?' <div class="feedback bad" role="status">'+E(saveError)+'</div>':'')+html;
  for(const key of panels)main.querySelector('details[data-panel="'+key+'"]')?.setAttribute('open','');
  for(const [key,left,top] of scrolled){const el=main.querySelector('[data-scroll="'+key+'"]');if(el){el.scrollLeft=left;el.scrollTop=top;}}
  if(focusTarget)main.querySelector(focusTarget)?.focus({preventScroll:true});
  document.title=(main.querySelector('h1')?.textContent||'ホーム')+' | Puzzle Training Lab';
  paintArt();
}
function start(id,mode='practice',force=false){
  const p=puzzles.find(item=>item.id===id);if(!p)return;
  const open=!force&&M.attemptsFor(state,id).find(a=>!a.solved&&a.mode===mode),a=open||M.newAttempt(p,mode);
  state.attempts[a.id]=a;state.last=a.id;save();go('play/'+a.id);
}
function update(fn,msg='',resolve=false){
  fn();if(resolve)M.reconcile(puzzle,attempt);if(resolve)view.feedback=null;save();render();if(msg)toast(msg);
}
function notice(message,bad=false){view.feedback={text:message,bad};render();}
function openDetail(id){const el=main.querySelector('details[data-panel="'+id+'"]');if(el)el.open=true;}
function onAction(e){
  if(e.target.closest('.skip')){e.preventDefault();main.focus();main.scrollIntoView();return;}
  const btn=e.target.closest('[data-action]');if(!btn||btn.disabled||!state)return;
  const {action,id,key,opt='',value,pid}=btn.dataset;
  if(action==='theme'){state.theme=theme()?'light':'dark';save();render();qs('.theme').focus({preventScroll:true});return;}
  if(action==='start'||action==='review-start'){start(pid,action==='start'?'practice':'review');return;}
  if(action==='export'){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),el=document.createElement('a');
    el.href=url;el.download='puzzle-training-lab-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return;
  }
  if(action==='import'){qs('#backup-file').click();return;}
  if(!attempt)return;
  const a=attempt,p=puzzle,b=a.frame.board;
  switch(action){
    case 'cell':{
      view.key=key;view.opt=opt;
      if(view.fit||a.solved||view.brush==='inspect'||(p.genre==='route'&&p.board.cells.find(c=>c.key===key)?.given)){
        render();if(!view.fit&&view.brush==='inspect')openDetail('notes');return;
      }
      const erasing=view.brush==='erase',mode=erasing?'erase':view.brush==='cross'?'cross':'mark';
      update(()=>M.mark(a,key,p.genre==='route'?(erasing?'':view.brush):opt,mode),'',true);return;
    }
    case 'brush':view.brush=value;render();return;
    case 'fit':view.fit=!view.fit;render();return;
    case 'zoom-in':case 'zoom-out':view.zoom=Math.max(.75,Math.min(1.75,view.zoom+(action==='zoom-in'?.25:-.25)));render();return;
    case 'undo':case 'redo':update(()=>M.travel(a,action==='redo'),'',true);return;
    case 'focus':case 'pick-clue':
      if(dialog.open)dialog.close();
      if(a.solved)update(()=>{b.focus=b.focus===id?'':id;M.changed(a);});
      else update(()=>M.edit(a,f=>{f.board.focus=b.focus===id?'':id;}));
      if(action==='pick-clue')qs('[data-action="to-clues"]')?.focus({preventScroll:true});
      return;
    case 'to-clues':openClues(p,b);return;
    case 'begin':modal('仮定に名前を付ける','ここから置くマス・候補・メモに仮定を適用します。途中の結論もまとめて戻せます。','仮定を始める',name=>update(()=>M.beginBranch(a,name),'仮定を始めました。'),'仮定 '+(a.stats.branches+1));return;
    case 'discard':update(()=>M.discardBranch(a),'仮定を置く前に戻しました。',true);return;
    case 'point':modal('チェックポイントを保存','今の盤面と、調べている仮定を一緒に保存します。','保存する',name=>update(()=>M.checkpoint(a,name),'チェックポイントを保存しました。'),'記録点 '+(a.points.length+1));return;
    case 'restore':update(()=>M.restore(a,id),'チェックポイントに戻しました。',true);return;
    case 'inspect-check':{
      const problems=M.conflicts(p,a);
      if(problems.length){M.flag(a,'local');save();notice(problems.slice(0,3).join('　'),true);}
      else{M.reconcile(p,a);save();notice('今の印から直接わかる矛盾は見つかりません。未確定の条件は、続けて確かめられます。');}
      return;
    }
    case 'grade':{
      const res=M.checkAnswer(p,a);save();
      if(res==='incomplete')notice('残り '+(M.fields(p).length-Object.keys(b.marks).length)+' か所です。'+(p.genre==='route'?'空きマスに白か黒を置いてください。':'各行に一つずつ○を置いてください。'));
      else if(res==='wrong')notice('まだすべての条件はそろっていません。盤面を残したまま、仮定やチェックポイントから見直せます。',true);
      else {view.feedback=null;render();toast('クリアを学習記録に保存しました。');}return;
    }
    case 'hint':view.hintCount=Math.min(3,view.hintCount+1);update(()=>M.useHint(a,view.hintCount));return;
    case 'explain':modal('段階解説を開く','ここからは、解答につながる手順が一つずつ表示されます。','最初の手順を見る',()=>{view.steps=1;update(()=>M.explain(a,1));openDetail('guide');});return;
    case 'step':view.steps=Math.min(p.steps.length,view.steps+1);update(()=>M.explain(a,view.steps));return;
    case 'self':update(()=>M.report(a,value));return;
    case 'retry':start(pid,'review',true);return;
    case 'restart':modal('新しい盤面で挑戦する','現在の盤面は学習記録に残り、あとから開けます。','新しく始める',()=>{a.stats.restarts++;M.changed(a);start(a.pid,a.mode,true);});return;
  }
}
document.addEventListener('click',onAction);
main.addEventListener('submit',e=>{
  e.preventDefault();const form=e.target;
  if(!attempt||attempt.solved||!view.key)return;
  if(form.dataset.form==='note'){
    const key=view.key+(view.opt?'~'+view.opt:''),text=new FormData(form).get('note').trim().slice(0,600);
    update(()=>M.edit(attempt,f=>{if(text)f.board.notes[key]=text;else delete f.board.notes[key];}),'メモを保存しました。');
  }
  if(form.dataset.form==='link'){
    const target=reasonTarget(puzzle,attempt.frame.board,view);
    const message=M.addLink(attempt,target,new FormData(form).get('source'));
    save();render();toast(message||'根拠をつなぎました。');
  }
});
main.addEventListener('change',e=>{if(e.target.id==='level-filter'){level=Number(e.target.value);render();qs('#level-filter')?.focus();}});
qs('#backup-file').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
    if(file.size>16000000)throw Error('このファイルは大きすぎます。');
    const backup=parseBackup(await file.text(),puzzles);
    modal('バックアップを読み込む','このブラウザの記録を、ファイルにある '+Object.keys(backup.attempts).length+' 回分の挑戦で置き換えます。','この内容で復元',()=>{
      backup.epoch=M.makeId();state=backup;saveError='';save(true);navigate();toast('学習記録を復元しました。');
    });
  }catch(err){toast(err instanceof SyntaxError?'JSONを読み取れませんでした。':err.message||'読み込みに失敗しました。');}
});
window.addEventListener('hashchange',()=>{if(state)navigate();});
window.addEventListener('storage',e=>{
  if(e.key!==STORAGE_KEY||!e.newValue||!state)return;
  try{state=parseBackup(e.newValue,puzzles);getPage();render(false);}catch{/* Keep the current valid session. */}
});
media.addEventListener('change',()=>{if(state?.theme==='system')render();});
document.addEventListener('keydown',e=>{
  if(!attempt||dialog.open||e.target.matches('input,textarea,select')||!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='z')return;
  e.preventDefault();update(()=>M.travel(attempt,e.shiftKey),'',true);
});
async function json(path){const r=await fetch(path);if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
try{
  const manifest=await json('./data/catalog.json');
  puzzles=(await Promise.all(manifest.files.map(f=>json('./data/'+f)))).flat();
  const local=readLocal(puzzles);state=local.state;saveError=local.error||'';navigate();
}catch{main.innerHTML='<section class="panel padded"><h1>問題を読み込めませんでした</h1><p>通信を確認して、もう一度開いてください。</p><button class="btn" id="reload">再読み込み</button></section>';qs('#reload').onclick=()=>location.reload();}

