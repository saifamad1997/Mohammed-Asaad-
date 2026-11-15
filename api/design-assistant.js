const SYSTEM_PROMPT = `أنت مساعد التصميم الهندسي والتصنيع لشركة محمد أسعد للتنجيد والتصميم الهندسي. تحدث بالعربية الطبيعية واللهجة الأردنية عند ملاءمتها، وكن ودوداً ودقيقاً وعملياً.

تخصصك يشمل جميع الأثاث والتصاميم حسب الطلب: خزائن، مطابخ، أبواب وضرفات، أبواب سحاب ومفصلية، أدراج وسكك ومفصلات، مكاتب دراسة وعمل وقيمنق ومكاتب شركات، طاولات، كنب وكراسي وتنجيد، أسرّة، هياكل خشبية ومعدنية، وأي تصميم خاص يصفه العميل.

قواعد العمل:
1) افهم الفكرة أولاً، ولا تحصر المستخدم في قوالب جاهزة. اسأله سؤالاً واحداً واضحاً في كل مرة عندما تنقص معلومة أساسية.
2) فرّق بين المقاس الخارجي والداخلي، واطلب الوحدة إن لم تكن واضحة. لا تخترع أبعاداً أو سماكات أو خامات أو إكسسوارات.
3) ناقش الوظيفة والتقسيمات والخامات والسماكات والتشطيب والميزانية إن كانت مهمة.
4) عند تحليل صورة، صف ما تراه بوضوح، وميّز الملاحظات المؤكدة عن الافتراضات، ولا تدّع معرفة أبعاد الصورة دون مرجع قياس.
5) لا تقل إنك أنشأت ملف CAD أو نموذجاً ثلاثي الأبعاد أو مخطط قص أو ملف SKP ما لم تكن أداة فعلية قد أنشأته وأكدت نجاحه.
6) عندما تصبح المواصفات كافية، لخّصها في جدول/قائمة منظمة واقترح الخطوة التالية: معاينة، مخطط 2D، نموذج 3D، أو قائمة قصّات. لا تعتمد التصنيع النهائي دون مراجعة فنية.
7) ضع السلامة الإنشائية والتجميع والخلوصات واتجاه عروق الخشب وحركة السكك والمفصلات في الاعتبار، واطلب مواصفات المصنع عند الحاجة.
8) لا تطلب من المستخدم إرسال مفاتيح API أو كلمات مرور في المحادثة.`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'الطريقة غير مدعومة.'});
  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!apiKey) return res.status(503).json({error:'مساعد التصميم غير مفعّل. أضف GEMINI_API_KEY كمتغير سري في إعدادات Vercel.'});
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({error:'إعدادات التحقق من حساب الشركة غير مكتملة.'});
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({error:'سجّل الدخول أولاً.'});
  try {
    const verify = await fetch((supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl) + '/auth/v1/user', {headers:{apikey:supabaseKey,Authorization:'Bearer '+token}});
    if (!verify.ok) return res.status(401).json({error:'جلسة الدخول غير صالحة. سجّل الدخول من جديد.'});
    const body = req.body || {};
    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 18) return res.status(400).json({error:'سجل المحادثة غير صالح.'});
    const messages = body.messages.map(m => {
      if (!m || !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 6000) throw new Error('رسالة غير صالحة.');
      return m;
    });
    const contents = messages.map((m, index) => {
      const parts = [{text:m.content}];
      if (index === messages.length - 1 && m.role === 'user' && typeof body.image === 'string') {
        const match = body.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
        if (!match || body.image.length > 7_000_000) throw new Error('الصورة غير مدعومة أو حجمها كبير.');
        parts.push({inlineData:{mimeType:'image/'+match[1],data:match[2]}});
      }
      return {role:m.role === 'assistant' ? 'model' : 'user',parts};
    });
    if (messages[messages.length - 1].role !== 'user' || !messages[messages.length - 1].content.trim() && !body.image) {
      return res.status(400).json({error:'اكتب رسالتك أو أرفق صورة أولاً.'});
    }
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(apiKey);
    const ai = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},
      contents,
      generationConfig:{maxOutputTokens:1400,temperature:0.7}
    })});
    const result = await ai.json().catch(()=>({}));
    if (!ai.ok) {
      const detail = result?.error?.message || 'unknown';
      console.error('Gemini API error',ai.status,detail);
      if (ai.status === 429) return res.status(429).json({error:'وصل المساعد إلى الحد المجاني للطلبات حالياً. انتظر قليلاً ثم حاول مرة أخرى.'});
      if (ai.status === 401 || ai.status === 403) return res.status(503).json({error:'مفتاح Gemini غير صالح أو لا يملك صلاحية استخدام هذا النموذج. راجع إعداد GEMINI_API_KEY في Vercel.'});
      return res.status(502).json({error:'تعذر على Gemini إكمال الرد حالياً. حاول مرة أخرى بعد قليل.'});
    }
    const reply = (result.candidates?.[0]?.content?.parts || []).map(part=>part.text || '').join('\\n').trim();
    if (!reply) return res.status(502).json({error:'وصل رد فارغ من Gemini. حاول صياغة الطلب بطريقة أخرى.'});
    return res.status(200).json({reply});
  } catch (error) {
    console.error('Design assistant error',error);
    return res.status(400).json({error:error?.message||'تعذر معالجة الطلب.'});
  }
}