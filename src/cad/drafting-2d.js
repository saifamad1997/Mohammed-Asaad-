const GRID_MM = 50;

export function mountDrafting2D(root) {
  if (!root) return () => {};
  root.innerHTML = `
    <section class="cad2d" dir="rtl">
      <header class="cad2d-head">
        <div><span class="cad2d-kicker">ENGINEERING / 2D</span><h2>لوحة الرسم الهندسي ثنائي الأبعاد</h2><p>الرسم بوحدة الملليمتر مع شبكة والتقاط ومحاور وإمكانية تصدير SVG وDXF مبسط.</p></div>
        <div class="cad2d-readout" id="cadReadout">X: 0 · Y: 0 · المقياس 1:1</div>
      </header>
      <div class="cad2d-toolbar" role="toolbar" aria-label="أدوات الرسم">
        <button data-tool="select" class="active">تحديد</button><button data-tool="line">خط</button><button data-tool="rect">مستطيل</button><button data-tool="circle">دائرة</button><button data-tool="dimension">قياس</button><button data-tool="pan">تحريك اللوحة</button>
        <span class="cad2d-separator"></span><button data-action="undo">تراجع</button><button data-action="delete">حذف المحدد</button><button data-action="fit">ملاءمة الرسم</button><button data-action="grid">إظهار/إخفاء الشبكة</button>
        <span class="cad2d-separator"></span><button data-action="json">حفظ JSON</button><button data-action="svg">تصدير SVG</button><button data-action="dxf">تصدير DXF</button>
      </div>
      <div class="cad2d-workarea"><canvas id="cadCanvas" aria-label="مساحة الرسم الهندسي"></canvas>
        <aside class="cad2d-inspector"><h3>خصائص العنصر</h3><p id="cadSelectionHint">اختر عنصراً لعرض خصائصه.</p><div id="cadInspectorFields"></div><div class="cad2d-help"><b>اختصارات</b><span>Delete: حذف المحدد</span><span>Ctrl + Z: تراجع</span><span>عجلة الفأرة: تكبير وتصغير</span><span>اسحب بالزر الأيسر لتحريك اللوحة في وضع التحريك</span></div></aside>
      </div>
      <footer class="cad2d-status"><span id="cadStatus">جاهز — الوحدات: mm</span><span>شبكة 50 مم · التقاط تلقائي · حفظ وتصدير</span></footer>
    </section>`;
  const canvas = root.querySelector('#cadCanvas'), ctx = canvas.getContext('2d');
  const readout = root.querySelector('#cadReadout'), status = root.querySelector('#cadStatus');
  const inspector = root.querySelector('#cadInspectorFields');
  let tool = 'select', gridVisible = true, scale = .22, offset = {x:0,y:0}, items = [], selected = null, draft = null, pointer = null, history = [];
  const uid = () => 'e' + Math.random().toString(36).slice(2,10);
  const snapshot = () => history.push(JSON.stringify(items));
  const saveBlob = (name, content, type) => { const a=document.createElement('a'); const u=URL.createObjectURL(new Blob([content],{type})); a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000); };
  const resize = () => { const r=canvas.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,2); canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);draw(); };
  const world = (x,y) => ({x:(x-offset.x)/scale,y:(offset.y-y)/scale});
  const screen = (x,y) => ({x:offset.x+x*scale,y:offset.y-y*scale});
  const snap = v => Math.round(v/GRID_MM)*GRID_MM;
  const norm = (a,b) => ({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)});
  const draw = () => {
    const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle='#fbfcfa';ctx.fillRect(0,0,w,h);
    if(gridVisible){const step=GRID_MM*scale;if(step>5){ctx.beginPath();for(let x=((offset.x%step)+step)%step;x<w;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,h);}for(let y=((offset.y%step)+step)%step;y<h;y+=step){ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.strokeStyle='#e8ece8';ctx.lineWidth=1;ctx.stroke();}}
    const axisX=offset.x,axisY=offset.y;ctx.beginPath();ctx.moveTo(0,axisY);ctx.lineTo(w,axisY);ctx.moveTo(axisX,0);ctx.lineTo(axisX,h);ctx.strokeStyle='#b9c6bf';ctx.lineWidth=1.2;ctx.stroke();
    [...items,...(draft?[draft]:[])].forEach(item=>paint(item,item.id===selected?.id));
    const p=pointer?world(pointer.x,pointer.y):null;if(p){readout.textContent='X: '+Math.round(p.x)+' · Y: '+Math.round(p.y)+' · المقياس '+scale.toFixed(2)+' px/mm';}
  };
  const paint = (it, active) => {
    ctx.save();ctx.strokeStyle=active?'#078b82':'#344c46';ctx.fillStyle='rgba(8,139,130,.08)';ctx.lineWidth=active?2.6:1.8;
    if(it.type==='line'||it.type==='dimension'){const a=screen(it.x1,it.y1),b=screen(it.x2,it.y2);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();if(it.type==='dimension'){const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};ctx.fillStyle='#40574f';ctx.font='12px Tahoma';ctx.fillText(Math.round(Math.hypot(it.x2-it.x1,it.y2-it.y1))+' mm',mid.x+6,mid.y-7);}}
    if(it.type==='rect'){const a=screen(it.x,it.y),b=screen(it.x+it.w,it.y-it.h);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.fill();}
    if(it.type==='circle'){const c=screen(it.x,it.y);ctx.beginPath();ctx.arc(c.x,c.y,Math.abs(it.r*scale),0,Math.PI*2);ctx.stroke();}
    if(active){ctx.setLineDash([5,4]);ctx.strokeStyle='#0a948b';ctx.strokeRect(3,3,canvas.clientWidth-6,canvas.clientHeight-6);}
    ctx.restore();
  };
  const boundsHit = (it,p) => {if(it.type==='line'||it.type==='dimension'){const dx=it.x2-it.x1,dy=it.y2-it.y1,l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p.x-it.x1)*dx+(p.y-it.y1)*dy)/l));return Math.hypot(p.x-(it.x1+t*dx),p.y-(it.y1+t*dy))<22/scale;}if(it.type==='circle')return Math.abs(Math.hypot(p.x-it.x,p.y-it.y)-it.r)<24/scale;if(it.type==='rect')return p.x>=it.x-20/scale&&p.x<=it.x+it.w+20/scale&&p.y<=it.y+20/scale&&p.y>=it.y-it.h-20/scale;return false;};
  const refreshInspector = () => {const it=selected;if(!it){root.querySelector('#cadSelectionHint').textContent='اختر عنصراً لعرض خصائصه.';inspector.innerHTML='';return;}root.querySelector('#cadSelectionHint').textContent='نوع العنصر: '+it.type;inspector.innerHTML=Object.entries(it).filter(([k])=>!['id','type'].includes(k)).map(([k,v])=>'<label>'+({x:'X',y:'Y',w:'العرض',h:'الارتفاع',r:'نصف القطر',x1:'X1',y1:'Y1',x2:'X2',y2:'Y2'}[k]||k)+' <input type="number" data-prop="'+k+'" value="'+Math.round(v)+'"></label>').join('');inspector.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{snapshot();it[input.dataset.prop]=Number(input.value)||0;draw();}));};
  const chooseTool = name => {tool=name;root.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));status.textContent='الأداة الحالية: '+({select:'تحديد',line:'خط',rect:'مستطيل',circle:'دائرة',dimension:'قياس',pan:'تحريك اللوحة'}[tool]);};
  root.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>chooseTool(b.dataset.tool)));
  root.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{
    const a=b.dataset.action;
    if(a==='undo'&&history.length){items=JSON.parse(history.pop());selected=null;refreshInspector();draw();}
    if(a==='delete'&&selected){snapshot();items=items.filter(i=>i.id!==selected.id);selected=null;refreshInspector();draw();}
    if(a==='fit'){offset={x:canvas.clientWidth/2,y:canvas.clientHeight/2};scale=.22;draw();}
    if(a==='grid'){gridVisible=!gridVisible;draw();}
    if(a==='json')saveBlob('mohammad-asad-drawing.json',JSON.stringify({version:1,units:'mm',gridMm:GRID_MM,entities:items},null,2),'application/json');
    if(a==='svg'){const body=items.map(i=>{if(i.type==='line'||i.type==='dimension')return '<line x1="'+i.x1+'" y1="'+(-i.y1)+'" x2="'+i.x2+'" y2="'+(-i.y2)+'" stroke="#243b35" stroke-width="3"/>';if(i.type==='rect')return '<rect x="'+i.x+'" y="'+(-i.y+i.h)+'" width="'+i.w+'" height="'+i.h+'" fill="none" stroke="#243b35" stroke-width="3"/>';return '<circle cx="'+i.x+'" cy="'+(-i.y)+'" r="'+i.r+'" fill="none" stroke="#243b35" stroke-width="3"/>';}).join('');saveBlob('mohammad-asad-drawing.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3000 -2000 6000 4000">'+body+'</svg>','image/svg+xml');}
    if(a==='dxf'){const out=['0','SECTION','2','ENTITIES'];items.forEach(i=>{if(i.type==='line'||i.type==='dimension')out.push('0','LINE','8','0','10',i.x1,'20',-i.y1,'30','0','11',i.x2,'21',-i.y2,'31','0');else if(i.type==='rect'){const pts=[[i.x,-i.y],[i.x+i.w,-i.y],[i.x+i.w,-i.y+i.h],[i.x,-i.y+i.h]];pts.forEach((p,n)=>{const q=pts[(n+1)%4];out.push('0','LINE','8','0','10',p[0],'20',p[1],'30','0','11',q[0],'21',q[1],'31','0');});}else out.push('0','CIRCLE','8','0','10',i.x,'20',-i.y,'30','0','40',i.r);});out.push('0','ENDSEC','0','EOF');saveBlob('mohammad-asad-drawing.dxf',out.join('\\n'),'application/dxf');}
  }));
  const down = e => {const r=canvas.getBoundingClientRect(),p={x:e.clientX-r.left,y:e.clientY-r.top};pointer=p;const q=world(p.x,p.y);if(tool==='pan'){draft={type:'pan',sx:p.x,sy:p.y,ox:offset.x,oy:offset.y};}else if(tool==='select'){selected=[...items].reverse().find(i=>boundsHit(i,q))||null;if(selected){snapshot();draft={type:'move',item:selected,start:q,orig:JSON.parse(JSON.stringify(selected))};}refreshInspector();}else{const start={x:snap(q.x),y:snap(q.y)};draft={type, start, end:start};}canvas.setPointerCapture(e.pointerId);draw();};
  const move = e => {const r=canvas.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top};if(draft){if(draft.type==='pan'){offset.x=draft.ox+(pointer.x-draft.sx);offset.y=draft.oy+(pointer.y-draft.sy);}else if(draft.type==='move'){const q=world(pointer.x,pointer.y),dx=snap(q.x-draft.start.x),dy=snap(q.y-draft.start.y);Object.assign(draft.item,draft.orig);if(draft.item.type==='line'||draft.item.type==='dimension'){draft.item.x1+=dx;draft.item.x2+=dx;draft.item.y1+=dy;draft.item.y2+=dy;}else{draft.item.x+=dx;draft.item.y+=dy;}}else{const q=world(pointer.x,pointer.y);draft.end={x:snap(q.x),y:snap(q.y)};}}draw();};
  const up = () => {if(!draft)return;if(draft.type==='pan'){draft=null;return;}if(draft.type==='move'){draft=null;return;}const {start,end}=draft;let item=null;if(draft.type==='line'||draft.type==='dimension')item={id:uid(),type:draft.type,x1:start.x,y1:start.y,x2:end.x,y2:end.y};if(draft.type==='rect'){const n=norm(start,end);item={id:uid(),type:'rect',x:n.x,y:n.y,w:n.w,h:n.h};}if(draft.type==='circle')item={id:uid(),type:'circle',x:start.x,y:start.y,r:Math.round(Math.hypot(end.x-start.x,end.y-start.y))};if(item&&(item.type==='circle'?item.r>0:item.type==='rect'?item.w>0&&item.h>0:Math.hypot(item.x2-item.x1,item.y2-item.y1)>0)){snapshot();items.push(item);}draft=null;draw();};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),p={x:e.clientX-r.left,y:e.clientY-r.top},before=world(p.x,p.y);scale=Math.max(.025,Math.min(2,scale*(e.deltaY<0?1.12:.89)));offset={x:p.x-before.x*scale,y:p.y+before.y*scale};draw();},{passive:false});
  const keydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();root.querySelector('[data-action="undo"]').click();}if(e.key==='Delete'&&selected)root.querySelector('[data-action="delete"]').click();};
  window.addEventListener('keydown',keydown);const observer=new ResizeObserver(resize);observer.observe(canvas);offset={x:canvas.clientWidth/2,y:canvas.clientHeight/2};resize();
  return ()=>{observer.disconnect();window.removeEventListener('keydown',keydown);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);};
}
