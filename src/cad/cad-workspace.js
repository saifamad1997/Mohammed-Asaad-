const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { name:'وحدة أثاث جديدة', width:1200, height:800, depth:450, thickness:18, parts:[] };
const mm = n => Math.max(0, Number(n)||0);
const fmt = n => Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
const uid = () => 'p'+Math.random().toString(36).slice(2,9);

export function renderCadWorkspace() {
  const root=document.querySelector('#pageContent');
  root.innerHTML=`
  <section class="cad-head"><div><span class="eyebrow">CAD WORKSPACE · MILLIMETRES</span><h2>لوحة الرسم الهندسي CAD</h2><p>ارسم وعدّل وحدات الأثاث، راجع المساقط، ثم صدّر DXF وملف هندسي JSON.</p></div><div class="cad-actions"><button class="btn" id="cadReset">تصميم جديد</button><button class="btn" id="cadCsv">قائمة القص CSV</button><button class="btn" id="cadJson">تصدير JSON</button><button class="btn btn-primary" id="cadDxf">تصدير DXF</button></div></section>
  <div class="cad-layout">
    <aside class="cad-tools">
      <h3>خصائص التصميم</h3>
      <label>اسم القطعة<input id="cadName" value="${esc(state.name)}"></label>
      <div class="cad-dim-grid">
        <label>العرض W (مم)<input id="cadW" type="number" min="1" value="${state.width}"></label>
        <label>الارتفاع H (مم)<input id="cadH" type="number" min="1" value="${state.height}"></label>
        <label>العمق D (مم)<input id="cadD" type="number" min="1" value="${state.depth}"></label>
        <label>السماكة (مم)<input id="cadT" type="number" min="1" value="${state.thickness}"></label>
      </div>
      <button class="btn btn-primary cad-full" id="cadApply">تحديث المجسم والمساقط</button>
      <hr><h3>مكوّنات التصميم</h3>
      <label>اسم المكوّن<input id="cadPartName" placeholder="مثال: جانب أيمن"></label>
      <div class="cad-dim-grid">
        <label>X<input id="cadPX" type="number" value="0"></label><label>Y<input id="cadPY" type="number" value="0"></label>
        <label>Z<input id="cadPZ" type="number" value="0"></label><label>عرض<input id="cadPW" type="number" value="18"></label>
        <label>ارتفاع<input id="cadPH" type="number" value="800"></label><label>عمق<input id="cadPD" type="number" value="450"></label>
      </div>
      <button class="btn cad-full" id="cadAddPart">＋ إضافة مكوّن</button>
      <div id="cadParts" class="cad-parts"></div><section class="cad-cutlist"><h3>قائمة القص المبدئية</h3><div id="cadCutlist"></div></section>
      <p class="cad-warning">المقاسات الافتراضية للبدء فقط. راجع كل مكوّن وسماكة الخامة والوصلات قبل اعتماد التصنيع.</p>
    </aside>
    <section class="cad-drawing">
      <div class="cad-toolbar"><strong>مساحة الرسم</strong><span>الوحدة: mm · إسقاط هندسي</span><div><button data-cad-view="all" class="active">الكل</button><button data-cad-view="front">أمامي</button><button data-cad-view="side">جانبي</button><button data-cad-view="top">علوي</button><button data-cad-view="iso">3D</button></div></div>
      <div class="cad-views" id="cadViews">
        <article class="cad-view cad-view-front"><header>المسقط الأمامي</header><svg id="cadFront" viewBox="0 0 520 340"></svg></article>
        <article class="cad-view cad-view-side"><header>المسقط الجانبي</header><svg id="cadSide" viewBox="0 0 520 340"></svg></article>
        <article class="cad-view cad-view-top"><header>المسقط العلوي</header><svg id="cadTop" viewBox="0 0 520 340"></svg></article>
        <article class="cad-view cad-view-iso"><header>منظور إيزومتري</header><svg id="cadIso" viewBox="0 0 520 340"></svg></article>
      </div>
      <div class="cad-status" id="cadStatus">جاهز للرسم · كل الأبعاد بالملليمتر</div>
    </section>
  </div>`;
  const byId=id=>root.querySelector('#'+id);\n  let editingPartId=null;
  function read(){
    state.name=byId('cadName').value.trim()||'تصميم بدون اسم';
    state.width=mm(byId('cadW').value);state.height=mm(byId('cadH').value);state.depth=mm(byId('cadD').value);state.thickness=mm(byId('cadT').value);
  }
  function rect(x,y,w,h,klass='cad-object'){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${klass}"/>`;}
  function line(x1,y1,x2,y2,klass='cad-dim'){return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${klass}"/>`;}
  function text(x,y,t,klass='cad-label'){return `<text x="${x}" y="${y}" class="${klass}" text-anchor="middle">${esc(t)}</text>`;}
  function draw(id,content){byId(id).innerHTML=`<defs><pattern id="cadGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#dce5e8" stroke-width=".7"/></pattern></defs><rect width="520" height="340" fill="url(#cadGrid)"/>${content}`;}
  function render(){
    const W=state.width,H=state.height,D=state.depth,T=state.thickness;
    const scale=Math.min(300/Math.max(W,H,D,1),.45);
    const fw=W*scale,fh=H*scale,fd=D*scale;
    const x=(520-fw)/2,y=(300-fh)/2;
    draw('cadFront',rect(x,y,fw,fh)+line(x,y+fh+22,x+fw,y+fh+22)+line(x,y+fh+16,x,y+fh+28)+line(x+fw,y+fh+16,x+fw,y+fh+28)+text(260,y+fh+42,fmt(W)+' mm')+line(x-22,y,x-22,y+fh)+line(x-28,y,x-16,y)+line(x-28,y+fh,x-16,y+fh)+text(x-38,y+fh/2,fmt(H),'cad-label cad-vertical')+state.parts.map(p=>rect(x+p.x*scale,y+fh-(p.z+p.h)*scale,p.w*scale,p.h*scale,'cad-part')).join(''));
    draw('cadSide',rect((520-fd)/2,(300-fh)/2,fd,fh)+text(260,320,fmt(D)+' mm')+text(20,170,fmt(H)));
    draw('cadTop',rect((520-fw)/2,(300-fd)/2,fw,fd)+text(260,320,fmt(W)+' mm')+text(24,170,fmt(D)));
    const ox=180,oy=270,s=Math.min(230/Math.max(W+ D*.7,H+D*.45,1),.32),a=W*s,b=D*s,c=H*s;
    const p1=[ox,oy],p2=[ox+a*.82,oy-a*.48],p3=[p2[0]+b*.58,p2[1]+b*.34],p4=[ox+b*.58,oy+b*.34],top=p1.map((v,i)=>v-(i===0?0:c));
    const poly=(pts,cl)=>`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" class="${cl}"/>`;
    const iso=poly([p1,p2,p3,p4],'cad-face-top')+poly([p1,p2,[p2[0],p2[1]-c],[p1[0],p1[1]-c]],'cad-face-front')+poly([p2,p3,[p3[0],p3[1]-c],[p2[0],p2[1]-c]],'cad-face-side')+text(280,325,'W '+fmt(W)+' · H '+fmt(H)+' · D '+fmt(D));
    draw('cadIso',iso);
    renderParts();
    byId('cadStatus').textContent='تم تحديث الرسم · '+state.parts.length+' مكوّن · '+fmt(W)+' × '+fmt(H)+' × '+fmt(D)+' mm';
  }
  function renderParts(){
    byId('cadParts').innerHTML=state.parts.map(p=>`<div class="cad-part-row"><span><b>${esc(p.name)}</b><small>${p.w}×${p.h}×${p.d} مم · X ${p.x}, Y ${p.y}, Z ${p.z}</small></span><button data-del-part="${p.id}" aria-label="حذف المكوّن">×</button></div>`).join('')||'<small class="muted">لا توجد مكوّنات مضافة بعد.</small>';
    byId('cadParts').querySelectorAll('[data-del-part]').forEach(b=>b.onclick=()=>{state.parts=state.parts.filter(p=>p.id!==b.dataset.delPart);render();});
    const total=state.parts.reduce((a,p)=>a+p.w*p.h*p.d,0);
    byId('cadCutlist').innerHTML=state.parts.length?'<table class="cad-table"><thead><tr><th>القطعة</th><th>عدد</th><th>W</th><th>H</th><th>D</th></tr></thead><tbody>'+state.parts.map(p=>'<tr><td>'+esc(p.name)+'</td><td>1</td><td>'+p.w+'</td><td>'+p.h+'</td><td>'+p.d+'</td></tr>').join('')+'</tbody></table><small>الحجم الإجمالي التقريبي: '+fmt(total/1000000)+' لتر</small>':'<small>أضف مكونات لعرض جدول القص.</small>';
  }
  byId('cadApply').onclick=()=>{read();render();};
  byId('cadAddPart').onclick=()=>{read();const v=id=>mm(byId(id).value);state.parts.push({id:uid(),name:byId('cadPartName').value.trim()||'مكوّن',x:v('cadPX'),y:v('cadPY'),z:v('cadPZ'),w:v('cadPW'),h:v('cadPH'),d:v('cadPD')});render();};
  root.querySelectorAll('[data-cad-view]').forEach(b=>b.onclick=()=>{byId('cadViews').dataset.view=b.dataset.cadView;root.querySelectorAll('[data-cad-view]').forEach(x=>x.classList.toggle('active',x===b));});
  byId('cadReset').onclick=()=>{Object.assign(state,{name:'وحدة أثاث جديدة',width:1200,height:800,depth:450,thickness:18,parts:[]});byId('cadName').value=state.name;byId('cadW').value=1200;byId('cadH').value=800;byId('cadD').value=450;byId('cadT').value=18;render();};
  function download(filename,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
  byId('cadCsv').onclick=()=>{read();const rows=[['Part','Qty','Width_mm','Height_mm','Depth_mm','X_mm','Y_mm','Z_mm'],...state.parts.map(p=>[p.name,1,p.w,p.h,p.d,p.x,p.y,p.z])];const csv='\\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\\r\\n');download('ma-cad-cut-list.csv',csv,'text/csv;charset=utf-8');};
  byId('cadJson').onclick=()=>{read();download('ma-cad-design.json',JSON.stringify({schema:'mo-asaad.cad-geometry',version:1,units:'mm',design:{name:state.name,dimensions:{width:state.width,height:state.height,depth:state.depth,thickness:state.thickness},components:state.parts}},null,2),'application/json');};
  byId('cadDxf').onclick=()=>{
    read();let dxf='0\nSECTION\n2\nENTITIES\n';
    const addLine=(x1,y1,x2,y2)=>{dxf+='0\nLINE\n8\n0\n10\n'+x1+'\n20\n'+y1+'\n30\n0\n11\n'+x2+'\n21\n'+y2+'\n31\n0\n';};
    const addRect=(x,y,w,h)=>{addLine(x,y,x+w,y);addLine(x+w,y,x+w,y+h);addLine(x+w,y+h,x,y+h);addLine(x,y+h,x,y);};
    addRect(0,0,state.width,state.height);
    state.parts.forEach(p=>addRect(p.x,p.z,p.w,p.h));
    dxf+='0\nENDSEC\n0\nEOF\n';download('ma-cad-front-elevation.dxf',dxf,'application/dxf');
  };
  render();
}
