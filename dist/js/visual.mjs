const paths={
 home:'M3 10.5 12 3l9 7.5 M5.5 9v11h5v-6h3v6h5V9',
 grid:'M3.5 3.5h7v7h-7z M13.5 3.5h7v7h-7z M3.5 13.5h7v7h-7z M13.5 13.5h7v7h-7z',
 route:'M5 18v-9h12v6 M3 16h4v4H3z M15 4h4v4h-4z M15 15h4v4h-4z',
 shapes:'M4 8.5 8 2l4 6.5z M13 12h7v7h-7z M3.5 16a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0',
 focus:'M8 4H4v4 M16 4h4v4 M20 16v4h-4 M4 16v4h4 M8.5 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0',
 chart:'M4 3v17h17 M8 16v-4 M13 16V7 M18 16v-6',
 sun:'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.7 4.7l1.5 1.5 M17.8 17.8l1.5 1.5 M4.7 19.3l1.5-1.5 M17.8 6.2l1.5-1.5 M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
 moon:'M20.5 14a8.5 8.5 0 0 1-10-10 8.7 8.7 0 1 0 10 10z',
 play:'M8 4.5 19 12 8 19.5z',
 book:'M3 5.5c4-1.5 6-.5 9 1 3-1.5 5-2.5 9-1v14c-4-1.5-6-.5-9 1-3-1.5-5-2.5-9-1z M12 6.5v14',
 layers:'M3 8l9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5',
 pin:'M8 3h8l-1 5 3 3v2H6v-2l3-3z M12 13v8',
 undo:'M4 10h10a6 6 0 0 1 0 12 M4 10l5-5 M4 10l5 5',
 redo:'M20 10H10a6 6 0 0 0 0 12 M20 10l-5-5 M20 10l-5 5',
 bulb:'M9 16c0-2.5-3-3.5-3-7a6 6 0 0 1 12 0c0 3.5-3 4.5-3 7z M9 19h6 M10 22h4',
 branch:'M7 5v15 M7 15c7 0 10-3 10-9 M5 5a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M15 5a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
 flag:'M5 21V4c4-3 7 3 13 0v9c-5 3-9-3-13 0',
 check:'m4 12 5 5L20 6', chevron:'m7 10 5 5 5-5',clock:'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M12 6v6l4 2',
 zap:'m13 2-9 12h7l-1 8 10-13h-8z',edit:'m4 16 11-11 4 4L8 20l-5 1z M13 7l4 4',
 list:'M8 6h12 M8 12h12 M8 18h12 M3 6h1 M3 12h1 M3 18h1',
 compass:'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M9 15l2-6 5-1-2 6z',
 save:'M4 4h13l3 3v13H4z M8 4v6h7V4 M8 20v-6h8v6',
 circle:'M5 12a7 7 0 1 0 14 0 7 7 0 1 0-14 0', trophy:'M7 3h10v6a5 5 0 0 1-10 0z M7 5H3v2c0 3 2 4 5 4 M17 5h4v2c0 3-2 4-5 4 M12 14v5 M7 20h10',
 history:'M3 11a9 9 0 1 1 2 7 M3 5v6h6 M12 7v5l4 2', note:'M5 3h14v13l-5 5H5z M14 21v-5h5 M8 7h8 M8 11h7',
 link:'m9 15 6-6 M7 13l-2 2a3 3 0 0 0 4 4l4-4 M11 9l4-4a3 3 0 0 1 4 4l-2 2', settings:'M3 7h18 M3 17h18 M8 4v6 M16 14v6',
 box:'M3 7l9-4 9 4-9 4z M3 7v10l9 4 9-4V7 M12 11v10', down:'M12 3v12 M7 10l5 5 5-5 M4 16v4h16v-4',up:'M12 15V3 M7 8l5-5 5 5 M4 16v4h16v-4',
 dots:'M4 12h.1 M12 12h.1 M20 12h.1',x:'M6 6l12 12 M18 6 6 18', repeat:'M4 11a8 8 0 1 1 2 7 M4 5v6h6'
};
export function icon(name,size=20){return `<svg aria-hidden="true" class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.grid}"/></svg>`;}
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const stamp = (date)=>new Intl.DateTimeFormat('ja-JP',{month:'short',day:'numeric'}).format(new Date(date));
function art(canvas){
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  const scale=Math.min(window.devicePixelRatio||1,2);canvas.width=w*scale;canvas.height=h*scale;
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(scale,scale);
  const type=canvas.dataset.art,hero=type.startsWith('hero'),kind=hero?type.slice(5):type;
  const compact=hero&&canvas.parentElement.clientWidth<200;
  const refW=compact?136:hero?440:300,refH=compact?150:hero?212:115;
  const k=Math.min(w/refW,h/refH);
  ctx.translate(w/2,h/2);ctx.scale(k,k);ctx.translate(-refW/2,-refH/2);
  const line=(pts,col,l=2,d=[])=>{ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=l;ctx.setLineDash(d);ctx.lineJoin='round';ctx.lineCap='round';pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.setLineDash([]);};
  const rect=(x,y,ww,hh,fill,stroke,rad=0,l=1)=>{ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,ww,hh,rad);else ctx.rect(x,y,ww,hh);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=l;ctx.stroke();}};
  const circ=(x,y,r,fill,stroke,l=1)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=l;ctx.stroke();}};
  const words=(v,x,y,size,col,weight=600)=>{ctx.fillStyle=col;ctx.font=weight+' '+size+'px ui-monospace, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(v,x,y);};
  if(hero){
    const mint='#8af4ce',lineC='#436572',soft='#adcbd0',bg='#193440',amber='#f7c276';
    if(compact){
      if(kind!=='route'){ctx.translate(-30,32);ctx.scale(.65,.7);drawSmall(kind,true);return;}
      const st=23,ox=9,oy=13,mid=(i,j)=>[ox+(i+.5)*st,oy+(j+.5)*st];
      for(let i=0;i<=5;i++){line([[ox+i*st,oy],[ox+i*st,oy+5*st]],lineC,.8);line([[ox,oy+i*st],[ox+5*st,oy+i*st]],lineC,.8);}
      [[0,0],[3,2],[0,3],[4,4]].forEach(([x,y])=>rect(ox+x*st+1,oy+y*st+1,st-2,st-2,'#2c4b55'));
      const path=[[0,2],[1,2],[1,1],[3,1],[3,0]].map(v=>mid(...v));
      line(path,mint,3);const [ax,ay]=path[0];rect(ax-6,ay-6,12,12,mint,null,2);words('S',ax,ay,9,bg);
      const fork=[[3,0],[4,0],[4,3],[3,3]].map(v=>mid(...v));line(fork,amber,2.5,[3,4]);
      const [fx,fy]=path.at(-1),[bx,by]=fork.at(-1);circ(fx,fy,4,bg,mint,2);circ(bx,by,7,bg,amber,1.5);words('?',bx,by,10,amber);return;
    }
    for(let x=4;x<445;x+=24)for(let y=10;y<215;y+=24)circ(x,y,1.05,'#47636c');
    if(kind==='route'){
      const sx=52,sy=35,st=34;const pt=(x,y)=>[sx+x*st,sy+y*st];
      for(let x=0;x<=9;x++)line([pt(x,0),pt(x,4)],lineC,0.85);
      for(let y=0;y<=4;y++)line([pt(0,y),pt(9,y)],lineC,0.85);
      [[2,0],[4,2],[6,0],[1,3],[7,3],[8,1]].forEach(([x,y])=>{const [px,py]=pt(x,y);rect(px+2,py+2,30,30,'#294751');for(let j=4;j<28;j+=6)line([[px+j,py+4],[px+4,py+j]],'#41606a',.8);});
      const mid=(x,y)=>[sx+(x+.5)*st,sy+(y+.5)*st];
      const route=[[0,2],[2,2],[2,1],[4,1],[4,0],[5,0],[5,2],[6,2]].map(v=>mid(...v));
      line(route,'#0d232c',10);line(route,mint,5);
      for(const i of [1,3,5]){const [x,y]=route[i];circ(x,y,3.1,mint);}
      const [a,b]=route[0];rect(a-11,b-11,22,22,mint,null,5);words('S',a,b+1,14,bg,800);
      const fork=[mid(6,2),mid(6,1),mid(7,1),mid(7,0),mid(8,0)];line(fork,amber,3.4,[5,6]);
      const [mx,my]=mid(6,2);circ(mx,my,7,bg,mint,3);
      const [tx,ty]=mid(8,0);circ(tx,ty,10,bg,amber,2);words('?',tx,ty+1,14,amber);
      const [q,z]=mid(8,3);rect(q-9,z-9,18,18,bg,soft,4,1.5);words('G',q,z+1,12,soft);
    }else{
      ctx.save();ctx.translate(62,15);ctx.scale(1.05,1.45);drawSmall(kind,true);ctx.restore();
    }
    return;
  }
  drawSmall(kind,false);
  function drawSmall(g,dark){
    const ink=dark?'#a5e9dd':({route:'#285c4e',logic:'#355c83',symbol:'#865231'}[g]);
    const fine=dark?'#50727a':({route:'#92bba7',logic:'#9eb9d7',symbol:'#d1ad8d'}[g]);
    const base=dark?'#193440':({route:'#dceedf',logic:'#deebf7',symbol:'#f5e7d7'}[g]);
    const hi=dark?'#84e1c4':({route:'#55ad84',logic:'#719ac5',symbol:'#c17b4c'}[g]);
    for(let x=12;x<295;x+=10)for(let y=9;y<115;y+=10)circ(x,y,.75,fine);
    if(g==='route'){
      const x=71,y=16,s=21;
      rect(x,y,147,84,base,fine,3);
      for(let i=1;i<7;i++)line([[x+i*s,y],[x+i*s,y+84]],fine,.9);
      for(let i=1;i<4;i++)line([[x,y+i*s],[x+147,y+i*s]],fine,.9);
      [[0,1],[2,1],[4,2],[5,0],[6,3]].forEach(([i,j])=>rect(x+i*s+1.5,y+j*s+1.5,18,18,ink,null,1.5));
      const path=[[0,3],[1,3],[1,2],[3,2],[3,1],[5,1],[5,2],[6,2]].map(([i,j])=>[x+(i+.5)*s,y+(j+.5)*s]);
      line(path,hi,4);for(const [a,b] of [path[0],path.at(-1)])circ(a,b,4.5,base,ink,2.5);
    }else if(g==='logic'){
      const x=95,y=13,s=23;rect(x-16,y,108,89,base,fine,3);
      for(let i=0;i<5;i++)line([[x+i*s,y],[x+i*s,y+89]],fine,.85);
      for(let i=0;i<4;i++)line([[x-16,y+17+i*s],[x+92,y+17+i*s]],fine,.85);
      for(let i=0;i<4;i++)circ(x+11+i*s,y+8,2.5,hi);
      for(let i=0;i<3;i++)line([[x-13,y+28+i*s],[x-5,y+28+i*s]],hi,2);
      [[0,0],[2,1],[1,2]].forEach(([i,j])=>circ(x+11+i*s,y+28+j*s,6,null,ink,2.4));
      [[1,0],[2,0],[0,1],[3,2]].forEach(([i,j])=>{const a=x+11+i*s,b=y+28+j*s;line([[a-4,b-4],[a+4,b+4]],hi,1.8);line([[a+4,b-4],[a-4,b+4]],hi,1.8);});
    }else{
      rect(92,11,112,93,base,fine,4);for(let i=1;i<4;i++)line([[94+i*26,15],[94+i*26,99]],fine,.7,[2,3]);
      const square=(x,y)=>rect(x-5.5,y-5.5,11,11,null,ink,1,2);
      const diamond=(x,y)=>line([[x,y-7],[x+7,y],[x,y+7],[x-7,y],[x,y-7]],ink,2);
      const tri=(x,y)=>line([[x,y-6],[x+7,y+5],[x-7,y+5],[x,y-6]],ink,2);
      circ(160,29,6,null,ink,2);diamond(186,29);words('+',108,53,20,ink);square(160,53);circ(186,53,6,null,ink,2);
      line([[103,68],[195,68]],hi,2);tri(134,85);diamond(160,85);square(186,85);
    }
  }
}
let observer;
export function paintArt(){
  observer?.disconnect();
  if(window.ResizeObserver){observer=new ResizeObserver(entries=>entries.forEach(e=>art(e.target)));document.querySelectorAll('canvas[data-art]').forEach(c=>{observer.observe(c);art(c);});}
  else document.querySelectorAll('canvas[data-art]').forEach(art);
}

