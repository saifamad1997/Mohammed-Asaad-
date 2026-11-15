const LIVE_SYSTEM_INSTRUCTION = `أنت مساعد التصميم الهندسي الصوتي لشركة محمد أسعد للتنجيد والتصميم الهندسي. تحدث بالعربية الطبيعية باللهجة الأردنية الخفيفة، بصوت ودود وواضح، وبجمل قصيرة مناسبة للمحادثة الصوتية.

تخصصك تصميم وتصنيع الأثاث حسب الطلب: خزائن ومطابخ وأبواب ومكاتب وطاولات وكنب وكراسي وتنجيد وأسرّة وهياكل خشبية ومعدنية.
افهم كلام المستخدم حتى لو كان عامياً أو غير مرتب، واحتفظ بتفاصيل الحديث داخل الجلسة. لا تكرر الأسئلة التي أجاب عنها.
اسأل سؤالاً واحداً فقط عندما تنقص معلومة أساسية. إذا كانت المعلومات كافية، اقترح حلاً عملياً فوراً.
ميّز بين الطول والعرض والعمق والارتفاع، وبين المقاس الخارجي والداخلي. لا تخترع قياسات أو خامات أو أسعاراً أو مواصفات.
عند مناقشة صورة، صف ما يظهر ولا تدّع معرفة أبعاد دقيقة بلا مرجع قياس.
كن مختصراً في الصوت، ولا تسرد قوائم طويلة إلا إذا طلب المستخدم ذلك. يمكن للمستخدم مقاطعتك؛ توقف عن الكلام واستمع له.
لا تدّع إنشاء رسم أو مجسم أو ملف تصنيع إلا إذا تم ذلك فعلياً بأداة متاحة. لا تطلب كلمات مرور أو مفاتيح سرية.`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'الطريقة غير مدعومة.' });
  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!apiKey) return res.status(503).json({ error: 'مفتاح Gemini غير مضبوط على الخادم.' });
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'إعدادات التحقق من الحساب غير مكتملة.' });
  const auth = req.headers.authorization || '';
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!accessToken) return res.status(401).json({ error: 'سجّل الدخول أولاً.' });
  try {
    const verify = await fetch((supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl) + '/auth/v1/user', {
      headers: { apikey: supabaseKey, Authorization: 'Bearer ' + accessToken }
    });
    if (!verify.ok) return res.status(401).json({ error: 'جلسة الدخول غير صالحة. سجّل الدخول من جديد.' });

    const model = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
    const now = Date.now();
    const payload = {
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: model,
        config: {
          responseModalities: ['AUDIO'],
          temperature: 0.45,
          systemInstruction: { parts: [{ text: LIVE_SYSTEM_INSTRUCTION }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          sessionResumption: {}
        }
      }
    };
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.name) {
      console.error('Gemini Live token error', response.status, result?.error?.message || 'No token returned');
      if (response.status === 429) return res.status(429).json({ error: 'وصلنا إلى حد طلبات الصوت المتاح حالياً. حاول لاحقاً.' });
      if (response.status === 401 || response.status === 403) return res.status(503).json({ error: 'مفتاح Gemini لا يملك صلاحية إنشاء جلسة صوتية مباشرة.' });
      return res.status(502).json({ error: 'تعذر تجهيز جلسة الصوت حالياً. حاول مرة أخرى لاحقاً.' });
    }
    return res.status(200).json({ token: result.name, model });
  } catch (error) {
    console.error('Gemini Live token route error', error);
    return res.status(502).json({ error: 'تعذر تجهيز الاتصال الصوتي.' });
  }
}
