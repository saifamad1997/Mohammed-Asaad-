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
      <div class="assistant-voice-status" id="assistantVoiceStatus" hidden aria-live="polite">المحادثة الصوتية متوقفة</div>\n      <div class="assistant-attachment" id="assistantAttachment" hidden></div>
      <form class="assistant-composer" id="assistantForm">
        <label class="assistant-upload" title="إرفاق صورة أو رسمة"><input id="assistantImage" type="file" accept="image/png,image/jpeg,image/webp" hidden><span>＋</span></label>
        <textarea id="assistantInput" rows="1" maxlength="6000" placeholder="مثلاً: بدي مكتب قيمنق على شكل L، عرضه 200 سم..." required></textarea>
        <button class="btn btn-quiet assistant-voice" id="assistantVoice" type="button" aria-pressed="false">🎙️ محادثة صوتية</button><button class="btn btn-primary assistant-send" id="assistantSend" type="submit">إرسال ↑</button>
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
  root.querySelector('#assistantClear').addEventListener('click',()=>{stopVoice();history=[];pendingImage=null;attachment.hidden=true;attachment.textContent='';saveHistory();paint();});
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
