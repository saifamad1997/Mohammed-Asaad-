const STORAGE_KEY = 'ma-design-assistant-conversations-v2';
const LEGACY_KEY = 'ma-design-assistant-chat-v1';
const MAX_HISTORY = 40;

export function renderDesignAssistant() {
  const root = document.querySelector('#pageContent');
  root.innerHTML = `
    <section class="assistant-hero">
      <div class="assistant-orb">✧</div>
      <div><span class="eyebrow">مساعد الشركة الذكي</span><h2>اكتب طلبك… ونبدأ المسودة فوراً</h2>
      <p>مساعد متخصص بالأثاث والنجارة والتنجيد والمعادن. اكتب باللهجة اللي تريحك، أو أرفق صورة أو رسمة.</p></div>
    </section>
    <section class="assistant-shell">
      <div class="assistant-chat-head"><div><strong>مساعد التصميم الهندسي</strong><small><span class="assistant-live-dot"></span> يبدأ مسودة ثم يستكمل التفاصيل</small></div><select id="assistantChats" class="assistant-chat-select" aria-label="المحادثات السابقة"></select><button type="button" class="btn btn-primary" id="assistantClear">＋ محادثة جديدة</button></div>
      <div class="assistant-messages" id="assistantMessages" aria-live="polite"></div>
      <div class="assistant-voice-status" id="assistantVoiceStatus" hidden aria-live="polite">المحادثة الصوتية متوقفة</div>\n      <div class="assistant-attachment" id="assistantAttachment" hidden></div>
      <form class="assistant-composer" id="assistantForm">
        <label class="assistant-upload" title="إرفاق صورة أو رسمة"><input id="assistantImage" type="file" accept="image/png,image/jpeg,image/webp" hidden><span>＋</span></label>
        <textarea id="assistantInput" rows="1" maxlength="6000" placeholder="مثلاً: بدي مكتب قيمنق على شكل L، عرضه 200 سم..." required></textarea>
        <button class="btn btn-quiet assistant-voice" id="assistantVoice" type="button" aria-pressed="false">🎙️ محادثة صوتية</button><button class="btn btn-primary assistant-send" id="assistantSend" type="submit">إرسال ↑</button>
      </form>
      <div class="assistant-hints"><button type="button" data-prompt="صمم لي خزانة ملابس حسب المقاسات التي سأعطيك إياها">خزانة ملابس</button><button type="button" data-prompt="بدي أصمم مكتب قيمنق من الصفر">مكتب قيمنق</button><button type="button" data-prompt="حلل الصورة المرفقة، واقترح أبعاداً معيارية تقديرية عند عدم وجود قياس مرجعي، وميّزها بوضوح عن القياسات المؤكدة.">حلّل صورة واقترح مقاسات</button><button type="button" data-prompt="ساعدني بتصميم كنب زاوية حسب مساحة الغرفة">كنب زاوية</button></div>
    </section>
    <div class="notice-card assistant-notice"><strong>طريقة العمل</strong><p>المهندس يبدأ بمسودة تصورية فور كتابة طلبك، ثم يسألك عن أهم معلومة ناقصة. الربط المباشر الحي مع AutoCAD وSketchUp يحتاج إضافة سطح مكتب محلية للبرنامجين؛ هذه المرحلة تجهّز المواصفات ولا تدّعي أنها رسمت داخل البرنامجين.</p></div>
  `;

  const messagesEl = root.querySelector('#assistantMessages');
  const form = root.querySelector('#assistantForm');
  const input = root.querySelector('#assistantInput');
  const imageInput = root.querySelector('#assistantImage');
  const attachment = root.querySelector('#assistantAttachment');
  const sendButton = root.querySelector('#assistantSend');
  let conversations = loadConversations();
  let activeChatId = conversations[0]?.id || createChat().id;
  let history = activeChat().messages;
  let sendQueue = [];
  let processingQueue = false;
  let pendingImage = null;
  let voiceSocket = null;
  let voiceStream = null;
  let voiceContext = null;
  let voiceSource = null;
  let voiceProcessor = null;
  let voiceMute = null;
  let voicePlaybackAt = 0;
  let voiceSources = [];
  let voiceStarting = false;
  const voiceButton = root.querySelector('#assistantVoice');
  const voiceStatus = root.querySelector('#assistantVoiceStatus');

  function createChat() {
    const chat = { id: (globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random()), title: 'محادثة جديدة', updatedAt: Date.now(), messages: [] };
    conversations.unshift(chat);
    return chat;
  }
  function activeChat() { return conversations.find(chat => chat.id === activeChatId) || conversations[0]; }
  function loadConversations() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
      const legacy = JSON.parse(sessionStorage.getItem(LEGACY_KEY) || '[]');
      return [{id:String(Date.now()),title:legacy.find(m=>m.role==='user')?.content?.slice(0,32)||'محادثتي السابقة',updatedAt:Date.now(),messages:Array.isArray(legacy)?legacy:[]}];
    } catch { return []; }
  }
  function saveHistory() {
    const chat = activeChat();
    if (!chat) return;
    chat.messages = history.slice(-MAX_HISTORY);
    const firstUser = history.find(m=>m.role==='user');
    if (firstUser && chat.title === 'محادثة جديدة') chat.title = firstUser.content.slice(0,32) || 'محادثة جديدة';
    chat.updatedAt = Date.now();
    conversations.sort((a,b)=>b.updatedAt-a.updatedAt);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0,50))); } catch {}
    renderChatChoices();
  }
  function renderChatChoices() {
    const select = root.querySelector('#assistantChats');
    if (!select) return;
    select.innerHTML = conversations.map(chat => '<option value="'+chat.id.replace(/"/g,'')+'" '+(chat.id===activeChatId?'selected':'')+'>'+String(chat.title||'محادثة').replace(/[&<>]/g,'')+'</option>').join('');
  }
  function switchChat(id) {
    const chat = conversations.find(item=>item.id===id);
    if (!chat || processingQueue) return;
    activeChatId=id; history=chat.messages; paint(); renderChatChoices();
  }
  function addMessage(role, content, imageUrl, designDraft) {
    const item = document.createElement('article');
    item.className = 'assistant-message ' + (role === 'user' ? 'assistant-user' : 'assistant-bot');
    const who = document.createElement('span');
    who.className = 'assistant-message-who';
    who.textContent = role === 'user' ? 'أنت' : 'مساعد التصميم';
    const body = document.createElement('p');
    body.textContent = content;
    item.append(who, body);
    if (imageUrl) { const img=document.createElement('img'); img.src=imageUrl; img.alt='الصورة المرفقة'; img.className='assistant-message-image'; item.append(img); }
    if (designDraft && designDraft.protocol === 'mo-asaad.cad-bridge' && designDraft.version === 1) {
      const panel=document.createElement('section');
      panel.className='assistant-draft-card';
      const heading=document.createElement('strong');
      heading.textContent='مسودة هندسية أولية · '+(designDraft.design?.name || 'تصميم جديد');
      const summary=document.createElement('p');
      const parts=designDraft.design?.components || [];
      const missing=parts.filter(part=>Object.values(part.dimensions || {}).some(value=>value === null)).length;
      const dimensionSource=designDraft.design?.dimensionSource==='proposal'?'الأبعاد مقترحة تقديرياً وتحتاج مراجعة':designDraft.design?.dimensionSource==='user'?'الأبعاد من إدخال المستخدم':'مصدر الأبعاد غير محدد';\n      summary.textContent='العناصر: '+parts.length+' · عناصر تنتظر قياسات: '+missing+' · '+(designDraft.validation?.readyForGeometry?'الأبعاد الأساسية مكتملة مبدئياً':'تحتاج استكمال أبعاد')+' · '+dimensionSource;
      const exportButton=document.createElement('button');
      exportButton.type='button'; exportButton.className='btn btn-quiet'; exportButton.textContent='تنزيل ملف المسودة JSON';
      exportButton.addEventListener('click',()=>{
        const blob=new Blob([JSON.stringify(designDraft,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob);
        const link=document.createElement('a');
        link.href=url; link.download='design-draft-'+designDraft.draftId+'.json';
        document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      });
      const previewButton=document.createElement('button');
      previewButton.type='button'; previewButton.className='btn btn-primary'; previewButton.textContent='إظهار الشكل المبدئي';
      const preview=document.createElement('div');
      preview.className='assistant-design-preview';
      preview.hidden=true;
      preview.setAttribute('aria-label','معاينة تصورية أولية للتصميم');
      previewButton.addEventListener('click',()=>{
        preview.hidden=!preview.hidden;
        previewButton.textContent=preview.hidden?'إظهار الشكل المبدئي':'إخفاء المعاينة';
        if (!preview.dataset.drawn) {
          const kind=String(designDraft.design?.kind||'').toLowerCase();
          const name=String(designDraft.design?.name||'');
          const draftParts=designDraft.design?.components || [];
          const detectionText=[kind,name,String(designDraft.design?.description||''),...draftParts.flatMap(part=>[part.name,part.type,part.category])].filter(Boolean).join(' ').toLowerCase();
          const isSofa=/sofa|couch|كنب|كنبة|كنباي/.test(detectionText);
          const isDesk=/desk|table|مكتب|طاولة|سطح المكتب|أرجل المكتب|desktop|workstation/.test(detectionText);
          if (isDesk) {
            const dims=designDraft.design?.dimensions || {};
            const width=Number(dims.width)||1400, depth=Number(dims.depth)||700, height=Number(dims.height)||750;
            const top=36, leg=50;
            const topScale=Math.max(.45,Math.min(1.15,520/width));
            const topW=Math.round(width*topScale), topD=Math.round(depth*topScale);
            preview.innerHTML='<div class="ma-real-desk-stage" role="img" aria-label="مجسم ثلاثي الأبعاد لمكتب مودرن"><div class="ma-real-desk" style="--desk-w:'+topW+'px;--desk-d:'+topD+'px;--desk-h:190px;--desk-top:14px"><div class="ma-desk-top"></div><div class="ma-desk-apron ma-desk-apron-front"></div><div class="ma-desk-apron ma-desk-apron-back"></div><div class="ma-desk-apron ma-desk-apron-left"></div><div class="ma-desk-apron ma-desk-apron-right"></div><div class="ma-desk-leg ma-desk-leg-a"></div><div class="ma-desk-leg ma-desk-leg-b"></div><div class="ma-desk-leg ma-desk-leg-c"></div><div class="ma-desk-leg ma-desk-leg-d"></div></div></div><div class="ma-desk-controls"><label>زاوية العرض <input class="ma-desk-rotate" type="range" min="-45" max="45" value="-22"></label><span class="ma-desk-angle">-22°</span></div><p class="ma-sofa-dimensions">الأبعاد المقترحة: '+width+' × '+depth+' × '+height+' مم · سطح '+top+' مم · أرجل '+leg+' × '+leg+' مم</p><p class="ma-desk-note">مجسم 3D تصوري للمكتب، وليس مجرد رسم مسقط. حرّك زاوية العرض لمعاينته قبل تحويله لتفاصيل التصنيع.</p>';
            const model=preview.querySelector('.ma-real-desk');
            const rotate=preview.querySelector('.ma-desk-rotate');
            const angle=preview.querySelector('.ma-desk-angle');
            const update=()=>{model.style.setProperty('--desk-y',rotate.value+'deg');angle.textContent=rotate.value+'°';};
            rotate.addEventListener('input',update);
            update();
          } else if (isSofa) {
            const dims=designDraft.design?.dimensions || {};
            const width=Number(dims.width)||2200, depth=Number(dims.depth)||900, height=Number(dims.height)||850;
            const scale=Math.max(0.55,Math.min(1.15,2200/Math.max(width,depth,height)));
            preview.innerHTML='<div class="ma-sofa-stage"><div class="ma-sofa-camera"><div class="ma-sofa-model" style="--sofa-scale:'+scale+'"><div class="ma-sofa-back"></div><div class="ma-sofa-seat"></div><div class="ma-sofa-arm ma-sofa-arm-left"></div><div class="ma-sofa-arm ma-sofa-arm-right"></div><div class="ma-sofa-leg ma-sofa-leg-a"></div><div class="ma-sofa-leg ma-sofa-leg-b"></div><div class="ma-sofa-leg ma-sofa-leg-c"></div><div class="ma-sofa-leg ma-sofa-leg-d"></div></div></div></div><div class="ma-sofa-controls"><label>زاوية العرض <input class="ma-sofa-rotate" type="range" min="-55" max="55" value="-22"></label><span class="ma-sofa-angle">-22°</span></div><p class="ma-sofa-dimensions">الأبعاد المقترحة: '+width+' × '+depth+' × '+height+' مم</p>';
            const model=preview.querySelector('.ma-sofa-model');
            const rotate=preview.querySelector('.ma-sofa-rotate');
            const angle=preview.querySelector('.ma-sofa-angle');
            rotate.addEventListener('input',()=>{model.style.setProperty('--sofa-rotation',rotate.value+'deg');angle.textContent=rotate.value+'°';});
            model.style.setProperty('--sofa-rotation','-22deg');
          } else {
            preview.textContent='المعاينة التصورية التلقائية لهذا النوع من القطع لم تُجهّز بعد. ملف المسودة المنظم متاح للتنزيل.';
          }
          preview.dataset.drawn='1';
        }
      });
      const note=document.createElement('small');
      note.textContent='المعاينة تصورية وليست مجسماً CAD أو اعتماد تصنيع. التصنيع غير معتمد.';
      panel.append(heading,summary,previewButton,preview,exportButton,note);
      item.append(panel);
    }
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
    } else history.forEach(m=>addMessage(m.role,m.content,m.preview,m.designDraft));
  }
  renderChatChoices();
  paint();
  root.querySelector("#assistantChats").addEventListener("change",e=>switchChat(e.target.value));

  function setVoiceStatus(message, active = false) {
    voiceStatus.hidden = false;
    voiceStatus.textContent = message;
    voiceButton.setAttribute('aria-pressed', String(active));
    voiceButton.textContent = active ? '⏹ إيقاف الصوت' : '🎙️ محادثة صوتية';
  }
  function pcm16Base64(floatSamples, sourceRate) {
    const ratio = sourceRate / 16000;
    const length = Math.floor(floatSamples.length / ratio);
    const pcm = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      const sample = floatSamples[Math.min(floatSamples.length - 1, Math.floor(i * ratio))] || 0;
      const clipped = Math.max(-1, Math.min(1, sample));
      pcm[i] = clipped < 0 ? clipped * 32768 : clipped * 32767;
    }
    const bytes = new Uint8Array(pcm.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
    return btoa(binary);
  }
  function playVoiceChunk(base64) {
    if (!voiceContext) return;
    const binary = atob(base64);
    const pcm = new Int16Array(binary.length / 2);
    for (let i = 0; i < pcm.length; i++) pcm[i] = (binary.charCodeAt(i * 2) & 255) | (binary.charCodeAt(i * 2 + 1) << 8);
    const samples = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) samples[i] = pcm[i] / 32768;
    const buffer = voiceContext.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const source = voiceContext.createBufferSource();
    source.buffer = buffer;
    source.connect(voiceContext.destination);
    const startAt = Math.max(voiceContext.currentTime + 0.03, voicePlaybackAt);
    source.start(startAt);
    voicePlaybackAt = startAt + buffer.duration;
    voiceSources.push(source);
    source.onended = () => { voiceSources = voiceSources.filter(item => item !== source); };
  }
  function stopVoicePlayback() {
    voiceSources.forEach(source => { try { source.stop(); } catch {} });
    voiceSources = [];
    voicePlaybackAt = voiceContext?.currentTime || 0;
  }
  function stopVoice() {
    if (voiceSocket && voiceSocket.readyState === WebSocket.OPEN) {
      try { voiceSocket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); } catch {}
    }
    try { voiceProcessor?.disconnect(); } catch {}
    try { voiceSource?.disconnect(); } catch {}
    try { voiceMute?.disconnect(); } catch {}
    voiceProcessor = voiceSource = voiceMute = null;
    if (voiceStream) voiceStream.getTracks().forEach(track => track.stop());
    voiceStream = null;
    if (voiceSocket) {
      voiceSocket.onclose = null;
      try { voiceSocket.close(); } catch {}
    }
    voiceSocket = null;
    stopVoicePlayback();
    if (voiceContext) { try { voiceContext.close(); } catch {} }
    voiceContext = null;
    voiceStarting = false;
    setVoiceStatus('المحادثة الصوتية متوقفة', false);
  }
  async function startVoice() {
    if (voiceStarting) return;
    voiceStarting = true;
    setVoiceStatus('نطلب إذن الميكروفون ونجهّز الاتصال…');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.WebSocket) throw new Error('المتصفح لا يدعم المحادثة الصوتية. افتح الموقع بمتصفح حديث وعلى اتصال آمن.');
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      voiceContext = new (window.AudioContext || window.webkitAudioContext)();
      await voiceContext.resume();
      const { data: sessionData, error: sessionError } = await window.__maSupabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('انتهت جلسة الدخول. سجّل الدخول من جديد.');
      const tokenResponse = await fetch('/api/design-assistant-live-token', { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken } });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenData.token) throw new Error(tokenData.error || 'تعذر بدء المحادثة الصوتية.');
      const wsUrl = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=' + encodeURIComponent(tokenData.token);
      voiceSocket = new WebSocket(wsUrl);
      voiceSocket.onopen = () => {
        voiceSocket.send(JSON.stringify({
          setup: {
            model: 'models/' + tokenData.model,
            generationConfig: { responseModalities: ['AUDIO'], temperature: 0.45 },
            systemInstruction: { parts: [{ text: 'تحدث بالعربية باللهجة الأردنية الخفيفة. أنت مساعد التصميم الهندسي لشركة محمد أسعد. كن مختصراً وطبيعياً، واسأل سؤالاً واحداً عند الحاجة. لا تخترع قياسات أو مواصفات.' }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: { automaticActivityDetection: { disabled: false } }
          }
        }));
        setVoiceStatus('تم الاتصال؛ ننتظر تجهيز الصوت…', true);
      };
      voiceSocket.onmessage = event => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.setupComplete) {
          const source = voiceContext.createMediaStreamSource(voiceStream);
          const processor = voiceContext.createScriptProcessor(4096, 1, 1);
          const mute = voiceContext.createGain();
          mute.gain.value = 0;
          processor.onaudioprocess = audioEvent => {
            if (!voiceSocket || voiceSocket.readyState !== WebSocket.OPEN) return;
            const data = pcm16Base64(audioEvent.inputBuffer.getChannelData(0), voiceContext.sampleRate);
            voiceSocket.send(JSON.stringify({ realtimeInput: { audio: { data, mimeType: 'audio/pcm;rate=16000' } } }));
          };
          source.connect(processor);
          processor.connect(mute);
          mute.connect(voiceContext.destination);
          voiceSource = source;
          voiceProcessor = processor;
          voiceMute = mute;
          setVoiceStatus('أنا بسمعك… احكي براحتك', true);
        }
        const server = message.serverContent;
        if (server?.interrupted) stopVoicePlayback();
        if (server?.inputTranscription?.text) addMessage('user', server.inputTranscription.text);
        if (server?.outputTranscription?.text) addMessage('assistant', server.outputTranscription.text);
        for (const part of (server?.modelTurn?.parts || [])) {
          if (part.inlineData?.data && String(part.inlineData.mimeType || '').startsWith('audio/pcm')) playVoiceChunk(part.inlineData.data);
        }
        if (server?.turnComplete) setVoiceStatus('تفضل، أنا بسمعك…', true);
        if (message.goAway) setVoiceStatus('الاتصال الصوتي يقترب من نهايته؛ أوقفه وابدأ جلسة جديدة عند الحاجة.', true);
      };
      voiceSocket.onerror = () => {
        setVoiceStatus('تعذر الاتصال الصوتي. تأكد من إعداد Gemini Live وحاول لاحقاً.');
        stopVoice();
      };
      voiceSocket.onclose = () => {
        if (voiceSocket) {
          setVoiceStatus('انتهى الاتصال الصوتي. يمكنك بدء محادثة جديدة.');
          stopVoice();
        }
      };
    } catch (error) {
      stopVoice();
      setVoiceStatus(error?.message || 'تعذر تشغيل الميكروفون.');
    } finally {
      voiceStarting = false;
    }
  }
  voiceButton.addEventListener('click', () => {
    if (voiceStarting || voiceSocket || voiceStream) stopVoice();
    else startVoice();
  });

  root.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.prompt;input.focus();}));
  root.querySelector('#assistantClear').addEventListener('click',()=>{if(processingQueue){alert('انتظر انتهاء الرد الحالي قبل فتح محادثة جديدة.');return;}stopVoice();const chat=createChat();activeChatId=chat.id;history=chat.messages;pendingImage=null;imageInput.value='';attachment.hidden=true;attachment.textContent='';saveHistory();paint();});
  imageInput.addEventListener('change',()=>{
    const file=imageInput.files?.[0]; if(!file) return;
    if(file.size>5*1024*1024){alert('حجم الصورة أكبر من 5 ميغابايت. اختر صورة أصغر.');imageInput.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{pendingImage={name:file.name,dataUrl:String(reader.result)};attachment.hidden=false;attachment.textContent='الصورة جاهزة للإرفاق: '+file.name+'  ×';attachment.onclick=()=>{pendingImage=null;imageInput.value='';attachment.hidden=true;};};
    reader.readAsDataURL(file);
  });
  async function processQueue() {
    if (processingQueue || !sendQueue.length) return;
    processingQueue = true;
    while (sendQueue.length) {
      const queued = sendQueue.shift();
      history.push(queued.message);saveHistory();
      const waiting=document.createElement('article');
      waiting.className='assistant-message assistant-bot assistant-thinking';
      waiting.textContent='مساعد التصميم يراجع فكرتك…';
      messagesEl.append(waiting);messagesEl.scrollTop=messagesEl.scrollHeight;
      sendButton.disabled=true;sendButton.textContent='يرد…';
      try {
        const {data,error}=await window.__maSupabase.auth.getSession();
        if(error)throw error;
        const token=data?.session?.access_token;
        if(!token)throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.');
        const snapshot=history.slice();
        const response=await fetch('/api/design-assistant',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({messages:snapshot.slice(-18).map(({role,content})=>({role,content})),image:queued.image})});
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(result.error||'تعذر الاتصال بمساعد التصميم.');
        const answer=String(result.reply||'لم يصل رد واضح. حاول مرة أخرى.');
        history.push({role:'assistant',content:answer,designDraft:result.designDraft || null});saveHistory();waiting.remove();addMessage('assistant',answer,null,result.designDraft || null);
      } catch(error) {
        waiting.remove();
        addMessage('assistant','صار في مشكلة: '+(error?.message||'حدث خطأ غير متوقع.')+'\nلم يتم حذف رسالتك؛ أعد الإرسال بعد معالجة المشكلة.');
      }
    }
    processingQueue=false;sendButton.disabled=false;sendButton.textContent='إرسال ↑';input.focus();
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const text=input.value.trim(); if(!text&&!pendingImage)return;
    const userMessage={role:'user',content:text || 'حلل الصورة المرفقة واقترح تصميمها.',preview:pendingImage?.dataUrl||null};
    addMessage('user',userMessage.content,userMessage.preview);
    sendQueue.push({message:userMessage,image:pendingImage?.dataUrl||null});
    input.value='';pendingImage=null;imageInput.value='';attachment.hidden=true;
    processQueue();
  });;
}
