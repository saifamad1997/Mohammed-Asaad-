const STORAGE_KEY = 'ma-design-assistant-chat-v1';
const MAX_HISTORY = 18;

export function renderDesignAssistant() {
  const root = document.querySelector('#pageContent');
  root.innerHTML = `
    <section class="assistant-hero">
      <div class="assistant-orb">✧</div>
      <div><span class="eyebrow">مساعد الشركة الذكي</span><h2>احكي فكرتك… ونصممها مع بعض</h2>
      <p>مساعد متخصص بالأثاث والنجارة والتنجيد والمعادن. اكتب باللهجة اللي تريحك، أو أرفق صورة أو رسمة.</p></div>
    </section>
    <section class="assistant-shell">
      <div class="assistant-chat-head"><div><strong>مساعد التصميم الهندسي</strong><small><span class="assistant-live-dot"></span> جاهز لمناقشة فكرتك</small></div><button type="button" class="btn btn-quiet" id="assistantClear">محادثة جديدة</button></div>
      <div class="assistant-messages" id="assistantMessages" aria-live="polite"></div>
      <div class="assistant-attachment" id="assistantAttachment" hidden></div>
      <form class="assistant-composer" id="assistantForm">
        <label class="assistant-upload" title="إرفاق صورة أو رسمة"><input id="assistantImage" type="file" accept="image/png,image/jpeg,image/webp" hidden><span>＋</span></label>
        <textarea id="assistantInput" rows="1" maxlength="6000" placeholder="مثلاً: بدي مكتب قيمنق على شكل L، عرضه 200 سم..." required></textarea>
        <button class="btn btn-primary assistant-send" id="assistantSend" type="submit">إرسال ↑</button>
      </form>
      <div class="assistant-hints"><button type="button" data-prompt="صمم لي خزانة ملابس حسب المقاسات التي سأعطيك إياها">خزانة ملابس</button><button type="button" data-prompt="بدي أصمم مكتب قيمنق من الصفر">مكتب قيمنق</button><button type="button" data-prompt="حلل الصورة المرفقة واقترح طريقة تصنيعها">حلّل صورة</button><button type="button" data-prompt="ساعدني بتصميم كنب زاوية حسب مساحة الغرفة">كنب زاوية</button></div>
    </section>
    <div class="notice-card assistant-notice"><strong>ملاحظة مهمة</strong><p>المساعد يناقشك ويجمع المواصفات ويقترح حلولاً. ربطه بأدوات إنشاء المجسمات والمخططات وقوائم القصّات يجري على مراحل؛ لن نعرض تصميماً على أنه جاهز للتصنيع قبل فحص أبعاده وتفاصيله.</p></div>
  `;

  const messagesEl = root.querySelector('#assistantMessages');
  const form = root.querySelector('#assistantForm');
  const input = root.querySelector('#assistantInput');
  const imageInput = root.querySelector('#assistantImage');
  const attachment = root.querySelector('#assistantAttachment');
  const sendButton = root.querySelector('#assistantSend');
  let history = loadHistory();
  let pendingImage = null;

  function loadHistory() {
    try { const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value.slice(-MAX_HISTORY) : []; }
    catch { return []; }
  }
  function saveHistory() {
    const safe = history.slice(-MAX_HISTORY).map(({role,content}) => ({role,content}));
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe)); } catch {}
  }
  function addMessage(role, content, imageUrl) {
    const item = document.createElement('article');
    item.className = 'assistant-message ' + (role === 'user' ? 'assistant-user' : 'assistant-bot');
    const who = document.createElement('span');
    who.className = 'assistant-message-who';
    who.textContent = role === 'user' ? 'أنت' : 'مساعد التصميم';
    const body = document.createElement('p');
    body.textContent = content;
    item.append(who, body);
    if (imageUrl) { const img=document.createElement('img'); img.src=imageUrl; img.alt='الصورة المرفقة'; img.className='assistant-message-image'; item.append(img); }
    messagesEl.append(item);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function paint() {
    messagesEl.innerHTML = '';
    if (!history.length) {
      const welcome=document.createElement('div');
      welcome.className='assistant-welcome';
      welcome.innerHTML='<span>✧</span><h3>أهلاً! شو حاب نصمم اليوم؟</h3><p>احكيلي الفكرة والمقاسات، وأنا بسألك عن التفاصيل اللي ناقصة خطوة بخطوة.</p>';
      messagesEl.append(welcome);
    } else history.forEach(m=>addMessage(m.role,m.content,m.preview));
  }
  paint();
  root.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.prompt;input.focus();}));
  root.querySelector('#assistantClear').addEventListener('click',()=>{history=[];pendingImage=null;attachment.hidden=true;attachment.textContent='';saveHistory();paint();});
  imageInput.addEventListener('change',()=>{
    const file=imageInput.files?.[0]; if(!file) return;
    if(file.size>5*1024*1024){alert('حجم الصورة أكبر من 5 ميغابايت. اختر صورة أصغر.');imageInput.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{pendingImage={name:file.name,dataUrl:String(reader.result)};attachment.hidden=false;attachment.textContent='الصورة جاهزة للإرفاق: '+file.name+'  ×';attachment.onclick=()=>{pendingImage=null;imageInput.value='';attachment.hidden=true;};};
    reader.readAsDataURL(file);
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const text=input.value.trim(); if(!text&&!pendingImage)return;
    const userMessage={role:'user',content:text || 'حلل الصورة المرفقة واقترح تصميمها.',preview:pendingImage?.dataUrl||null};
    history.push(userMessage); addMessage('user',userMessage.content,userMessage.preview);
    const imageData=pendingImage?.dataUrl||null;
    input.value='';input.disabled=true;sendButton.disabled=true;sendButton.textContent='يفكر…';
    pendingImage=null;imageInput.value='';attachment.hidden=true;
    const waiting=document.createElement('article');waiting.className='assistant-message assistant-bot assistant-thinking';waiting.textContent='مساعد التصميم يراجع فكرتك…';messagesEl.append(waiting);messagesEl.scrollTop=messagesEl.scrollHeight;
    try {
      const {data,error}=await window.__maSupabase.auth.getSession();
      if(error)throw error;
      const token=data?.session?.access_token;
      if(!token)throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.');
      const response=await fetch('/api/design-assistant',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({messages:history.slice(-MAX_HISTORY).map(({role,content})=>({role,content})),image:imageData})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'تعذر الاتصال بمساعد التصميم.');
      waiting.remove();
      const answer=String(result.reply||'لم يصل رد واضح. حاول مرة أخرى.');
      history.push({role:'assistant',content:answer});history=history.slice(-MAX_HISTORY);saveHistory();addMessage('assistant',answer);
    } catch(error) {
      waiting.remove();
      const message=error?.message||'حدث خطأ غير متوقع.';
      addMessage('assistant','صار في مشكلة: '+message+'\nلم يتم حذف رسالتك؛ أعد الإرسال بعد معالجة المشكلة.');
      history.pop();
    } finally {input.disabled=false;sendButton.disabled=false;sendButton.textContent='إرسال ↑';input.focus();}
  });
}
