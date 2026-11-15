import { nestPanels } from './panel-nesting.js';
import './panel-planner.css';

export function mountPanelPlanner(root) {
  if (!root) return () => {};
  root.innerHTML=`
    <section class="panel-planner" dir="rtl">
      <header class="pp-head"><div><span>PRODUCTION / PANEL CUTTING</span><h2>مخطط قص ألواح الخشب</h2><p>أدخل القطع ومقاسات اللوح لتحصل على توزيع أولي وعدد الألواح والبقايا.</p></div><strong>الوحدات: مم</strong></header>
      <div class="pp-grid">
        <section class="pp-card">
          <h3>1. بيانات اللوح</h3>
          <div class="pp-fields">
            <label>عرض اللوح (مم)<input id="ppStockW" type="number" min="1" value="1220"></label>
            <label>طول اللوح (مم)<input id="ppStockH" type="number" min="1" value="2440"></label>
            <label>السماكة (مم)<input id="ppThickness" type="number" min="1" value="18"></label>
            <label>عرض شفرة المنشار (مم)<input id="ppKerf" type="number" min="0" step=".1" value="3"></label>
            <label>هامش حواف اللوح (مم)<input id="ppMargin" type="number" min="0" step=".1" value="10"></label>
            <label>أقل بقايا تحفظ (مم)<input id="ppOffcut" type="number" min="0" value="100"></label>
          </div>
        </section>
        <section class="pp-card">
          <h3>2. قائمة القطع</h3>
          <p class="pp-help">كل سطر قطعة واحدة أو كمية متكررة: الاسم، العرض، الطول، العدد، السماكة، اتجاه العروق.</p>
          <textarea id="ppParts" rows="8" spellcheck="false">جنب خزانة,400,700,2,18,طولي
رف خزانة,500,400,4,18,none
قاعدة درج,350,450,3,18,طولي</textarea>
          <small>استخدم none للسماح بالتدوير. استخدم طولي أو عرضي لمنع تدوير القطعة حفاظاً على اتجاه العروق.</small>
          <div class="pp-actions"><button type="button" id="ppCalculate">احسب توزيع القص</button><button type="button" class="secondary" id="ppPrint" disabled>طباعة ورقة القص</button></div>
          <p id="ppFeedback" role="status" aria-live="polite">هذه خطة تقديرية؛ راجع العروق والعيوب الفعلية قبل القص.</p>
        </section>
      </div>
      <div id="ppReport" class="pp-report" aria-live="polite"><div class="pp-empty">أدخل بيانات القطع ثم اضغط «احسب توزيع القص».</div></div>
    </section>`;
  const $=id=>root.querySelector('#'+id);
  let lastPlan=null;
  const calculate=()=>{
    try{
      const parts=$('ppParts').value.split(/\\r?\\n/).map((line,i)=>line.trim()).filter(Boolean).map((line,i)=>{
        const cells=line.split(',').map(x=>normalizeDigits(x.trim()));
        if(cells.length<4) throw new Error('السطر '+(i+1)+': أدخل الاسم والعرض والطول والعدد.');
        const [label,widthMm,lengthMm,qty,thicknessMm,grain='طولي']=cells;
        return {id:'p'+i,label,widthMm:Number(widthMm),lengthMm:Number(lengthMm),qty:Number(qty),thicknessMm:Number(thicknessMm||$('ppThickness').value),grainDirection:grain==='none'?'none':grain};
      });
      if(!parts.length) throw new Error('أدخل قطعة واحدة على الأقل قبل الحساب.');\n      lastPlan=nestPanels(parts,{widthMm:Number($('ppStockW').value),heightMm:Number($('ppStockH').value),thicknessMm:Number($('ppThickness').value)},{kerfMm:Number($('ppKerf').value),marginMm:Number($('ppMargin').value),minOffcutMm:Number($('ppOffcut').value)});
      const plan=lastPlan;
      $('ppReport').innerHTML=`
        <section class="pp-summary">
          <article><span>عدد الألواح المطلوبة</span><b>${plan.sheetCount}</b></article>
          <article><span>القطع الموزعة</span><b>${plan.placedParts} / ${plan.totalParts}</b></article>
          <article><span>قطع لم تلائم الألواح</span><b>${plan.unplaced.length}</b></article>
          <article><span>مساحة البقايا المحسوبة</span><b>${(plan.totalOffcutAreaMm2/1e6).toFixed(3)} م²</b></article>
        </section>
        <div class="pp-warning">${plan.quality}. البقايا مستطيلات نظرية؛ لا تشمل عيوب اللوح أو اتجاه العروق إلا وفق الإعدادات المدخلة.</div>
        ${plan.sheets.map(sheet=>`<section class="pp-sheet"><h3>اللوح رقم ${sheet.number} — استغلال ${sheet.utilizationPercent}%</h3>
          <svg viewBox="0 0 ${plan.stock.widthMm} ${plan.stock.heightMm}" role="img" aria-label="خريطة قص اللوح ${sheet.number}">
            <rect x="0" y="0" width="${plan.stock.widthMm}" height="${plan.stock.heightMm}" class="stock-outline"/>
            <rect x="${plan.settings.marginMm}" y="${plan.settings.marginMm}" width="${plan.stock.widthMm-2*plan.settings.marginMm}" height="${plan.stock.heightMm-2*plan.settings.marginMm}" class="usable-outline"/>
            ${sheet.placements.map((p,i)=>`<g><rect x="${p.xMm}" y="${p.yMm}" width="${p.widthMm}" height="${p.lengthMm}" class="cut-piece"/><text x="${p.xMm+p.widthMm/2}" y="${p.yMm+p.lengthMm/2}" text-anchor="middle" dominant-baseline="middle">${i+1}. ${escapeXml(p.label)}</text><text x="${p.xMm+p.widthMm/2}" y="${p.yMm+p.lengthMm/2+24}" text-anchor="middle" class="pp-dim">${p.widthMm} × ${p.lengthMm}</text></g>`).join('')}
          </svg>
          <p>البقايا القابلة للفحص بعد القص:</p>
          ${sheet.offcuts.length?'<ul>'+sheet.offcuts.map(o=>`<li>${o.widthMm} × ${o.lengthMm} مم</li>`).join('')+'</ul>':'<small>لا توجد بقايا مستطيلة تتجاوز الحد المحدد.</small>'}
        </section>`).join('')}
        ${plan.unplaced.length?'<section class="pp-unplaced"><h3>قطع لم توزع</h3><ul>'+plan.unplaced.map(p=>`<li>${escapeXml(p.label)} — ${p.widthMm} × ${p.lengthMm} مم: ${p.reason}</li>`).join('')+'</ul></section>':''}
        <p class="pp-footnote">تقرير تخطيط أولي فقط. لا يُخصم أي مخزون من المستودع عند حساب هذه الخطة. يلزم اعتماد المقاسات وفحص اللوح وتسجيل الصرف الفعلي قبل التصنيع.</p>`;
      $('ppPrint').disabled=false;
      $('ppFeedback').textContent='تم حساب خطة أولية. لم يتم إجراء أي حركة صرف للمخزون.';
    }catch(error){lastPlan=null;$('ppPrint').disabled=true;$('ppFeedback').textContent=error.message||'تعذر حساب الخطة.';}
  };
  $('ppCalculate').addEventListener('click',calculate);
  $('ppPrint').addEventListener('click',()=>{if(!lastPlan)return;document.body.classList.add('printing-panels');window.print();});
  const afterPrint=()=>document.body.classList.remove('printing-panels');
  window.addEventListener('afterprint',afterPrint);
  return ()=>{window.removeEventListener('afterprint',afterPrint);afterPrint();};
}
function normalizeDigits(value){return String(value).replace(/[٠-٩۰-۹]/g,d=>String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(d)%10));}
function escapeXml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
