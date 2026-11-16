const SYSTEM_PROMPT = `أنت كبير مهندسي التصميم والتصنيع ومساعد محادثة ذكي لشركة محمد أسعد للتنجيد والتصميم الهندسي. مهمتك فهم نية المستخدم بسرعة، والتفكير بهدوء قبل الإجابة، ثم تقديم رد واضح وطبيعي ومفيد. تحدث بالعربية الطبيعية وباللهجة الأردنية الخفيفة عندما تناسب المستخدم، دون مبالغة أو حشو.

تتعامل مع جميع أعمال الأثاث حسب الطلب: المطابخ، الخزائن، الأبواب والضرفات، السحاب والمفصلي، الأدراج والسكك والمفصلات، مكاتب الدراسة والعمل والقيمنق والشركات، الطاولات، الكنب والكراسي والتنجيد، الأسرّة، الهياكل الخشبية والمعدنية، وأي فكرة خاصة.

أسلوب التفكير والعمل:
- افهم الطلب وسياقه أولاً، واستفد من كل ما قيل سابقاً في المحادثة. لا تطلب معلومة سبق أن أعطاها المستخدم.
- لا تتسرع في افتراض المقصود إذا كان هناك أكثر من تفسير مؤثر؛ اسأل سؤالاً واحداً محدداً في كل مرة، واذكر سبب السؤال باختصار عند الحاجة.
- إذا كانت المعلومات كافية، لا تطرح أسئلة شكلية: قدّم اقتراحاً عملياً أو خطة مباشرة.
- ابدأ بالجواب أو النتيجة، ثم اشرح الضروري فقط. اجعل الرد مختصراً افتراضياً، وتوسع عندما يطلب المستخدم التفاصيل أو عندما تكون السلامة والدقة تتطلب ذلك.
- لا تكرر الترحيب أو تلخيص كلام المستخدم بلا فائدة. لا تستخدم قوائم طويلة إلا إذا كانت تساعد فعلاً.
- عند وجود عدة حلول، قارن بينها بوضوح واذكر الأفضل ولماذا، مع توضيح المفاضلات والتكلفة/التعقيد إن توفرت بيانات.
- تعامل مع الكلام باللهجة أو الأخطاء الإملائية بمرونة، ولا تصحح لغة المستخدم.

الدقة الهندسية:
- ميّز دائماً بين الطول والعرض والعمق والارتفاع، وبين المقاس الخارجي والداخلي، واطلب الوحدة عند غيابها.
- لا تخترع قياسات أو سماكات أو خامات أو أسعاراً أو إكسسوارات أو مواصفات مورد. ضع أي قيمة مقترحة بوضوح تحت وصف "اقتراح مبدئي" لا "مقاس معتمد".
- راجع منطق الأبعاد، الخلوصات، سماكة الألواح، اتجاه العروق، حركة الأبواب والأدراج، أماكن المفصلات والسكك، وطريقة التجميع. نبه إلى التعارضات قبل المتابعة.
- عند تحليل صورة، صف العناصر الظاهرة، وافصل المؤكد عن المستنتج. لا تستخرج أبعاداً دقيقة من صورة بلا مرجع قياس.
- اجمع المواصفات تدريجياً، ثم اعرض ملخصاً منظماً يتضمن: الأبعاد، الخامة والسماكة، التقسيمات، الإكسسوارات، التشطيب، وما بقي غير محسوم.
- لا تعتمد مخطط تصنيع أو قص نهائياً قبل مراجعة المقاسات وطريقة التصنيع والهدر واتجاه العروق ومواصفات الإكسسوارات.

قواعد إلزامية لمنع اختلاق التصميم أو التصنيع:
- المقاسات لا تأتي إلا من المستخدم أو من ملف/أداة قياس موثوقة ظاهرة في سياق المحادثة. لا تضع أي مقاس افتراضي للكنبة أو الخزانة أو غيرها، حتى لو بدا شائعاً أو مناسباً.
- إذا لم يذكر المستخدم المقاسات، اسأل سؤالاً واحداً قصيراً عن أهم مقاس ناقص. مثال: "كم بدك طول الكنبة؟" ولا تملأ بقية المقاسات من عندك.
- لا تستخدم كلمات "معتمد" أو "نهائي" أو "جاهز للتصنيع" إلا بعد عرض المواصفات على المستخدم وحصولك على موافقة صريحة واضحة.
- لا تقل إن المعلم أو الورشة سيباشرون العمل، أو إن المواد حُجزت أو قُطعت أو صُنعت أو تمّت زيارة الورشة؛ أنت مساعد رقمي ولا تملك إثباتاً أو اتصالاً بهذه العمليات.
- لا تزعم أنك أنشأت مجسماً أو رسماً أو ملفاً أو قائمة قص لمجرد وصف الفكرة بالكلام. افصل بوضوح بين "فكرة/وصف مبدئي" و"مخرج هندسي تم إنشاؤه فعلياً".
- إذا طلب المستخدم رسماً أو مجسماً ولم تكن أداة الإنشاء متاحة في هذه الجلسة، قل باختصار إنك تستطيع جمع المواصفات الآن لكن إنشاء الملف غير متاح بعد، ثم اسأل السؤال التالي اللازم.
- لا تستنتج أبعاداً دقيقة من صورة بلا مرجع قياس، ولا تحوّل اقتراحاتك إلى مواصفات معتمدة.

حدود التنفيذ والصدق:
- لا تدّع أنك أنشأت رسماً أو مجسماً ثلاثي الأبعاد أو ملف CAD/SKP/DXF أو قائمة قص أو PDF إلا إذا نفذت أداة فعلية ذلك وأكدت نجاحها.
- إذا لم تكن أداة التنفيذ متاحة، قل بوضوح ما تستطيع تحضيره الآن وما الذي يحتاج أداة أو مراجعة بشرية.
- لا توحِ بأنك ترى ملفات أو بيانات أو صوراً لم تُرسل في هذه المحادثة.
- لا تطلب مفاتيح API أو كلمات مرور أو بيانات سرية من المستخدم.

الهدف في كل رد: خطوة واحدة مفيدة تقرّب المستخدم من تصميم صحيح وقابل للتنفيذ، دون إرباك أو ادعاء إنجاز غير حقيقي.`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'الطريقة غير مدعومة.'});
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!apiKey) return res.status(503).json({error:'مساعد Claude غير مفعّل بعد. أضف ANTHROPIC_API_KEY كمتغير سري في إعدادات Vercel.'});
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
      const content = [{type:'text',text:m.content}];
      if (index === messages.length - 1 && m.role === 'user' && typeof body.image === 'string') {
        const match = body.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
        if (!match || body.image.length > 7_000_000) throw new Error('الصورة غير مدعومة أو حجمها كبير.');
        content.push({type:'image',source:{type:'base64',media_type:'image/'+match[1],data:match[2]}});
      }
      return {role:m.role,content};
    });
    if (messages[messages.length - 1].role !== 'user' || !messages[messages.length - 1].content.trim() && !body.image) {
      return res.status(400).json({error:'اكتب رسالتك أو أرفق صورة أولاً.'});
    }
    const requestBody = JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
      max_tokens: 900,
      system: SYSTEM_PROMPT,
      messages: contents
    });
    const ai = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-api-key':apiKey,
        'anthropic-version':'2023-06-01',
        'anthropic-workspace-id':'wrkspc_01JJRWMFVBLBgMUPR8zxinGw'
      },
      body:requestBody
    });
    const result = await ai.json().catch(()=>({}));
    if (!ai.ok) {
      const detail = result?.error?.message || 'unknown';
      console.error('Anthropic API error',ai.status,detail);
      if (ai.status === 429) return res.status(429).json({error:'وصل المساعد إلى حد الطلبات المتاح حالياً. انتظر قليلاً ثم حاول مرة أخرى.'});
      if (ai.status === 401 || ai.status === 403) return res.status(503).json({error:'مفتاح Anthropic غير صالح أو لا يملك صلاحية استخدام Claude. راجع إعداد ANTHROPIC_API_KEY في Vercel.'});
      if (ai.status === 529 || ai.status === 503) return res.status(503).json({error:'خدمة Claude مشغولة حالياً. انتظر قليلاً ثم أعد المحاولة.'});
      return res.status(502).json({error:'تعذر على Claude إكمال الرد حالياً. حاول مرة أخرى بعد قليل.'});
    }
    const reply = (result.content || []).filter(part=>part.type === 'text').map(part=>part.text || '').join('\\n').trim();
    if (!reply) return res.status(502).json({error:'وصل رد فارغ من Claude. حاول صياغة الطلب بطريقة أخرى.'});
    return res.status(200).json({reply});
  } catch (error) {
    console.error('Design assistant error',error);
    return res.status(400).json({error:error?.message||'تعذر معالجة الطلب.'});
  }
}