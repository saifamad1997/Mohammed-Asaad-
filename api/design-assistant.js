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
  const apiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!apiKey) return res.status(503).json({error:'مساعد الذكاء الاصطناعي لم يُفعّل بعد. يلزم إضافة OPENAI_API_KEY كمتغير سري في إعدادات Vercel.'});
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({error:'إعدادات التحقق من حساب الشركة غير مكتملة.'});
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({error:'سجّل الدخول أولاً.'});
  try {
    const verify = await fetch(supabaseUrl.replace(/\/$/, '') + '/auth/v1/user', {headers:{apikey:supabaseKey,Authorization:'Bearer '+token}});
    if (!verify.ok) return res.status(401).json({error:'جلسة الدخول غير صالحة. سجّل الدخول من جديد.'});
    const body = req.body || {};
    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 18) return res.status(400).json({error:'سجل المحادثة غير صالح.'});
    const messages = body.messages.map(m => {
      if (!m || !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 6000) throw new Error('رسالة غير صالحة.');
      return {role:m.role,content:m.content};
    });
    const last = messages[messages.length-1];
    if (last.role !== 'user' || !last.content.trim()) return res.status(400).json({error:'اكتب رسالتك أولاً.'});
    const input = messages.slice(0,-1);
    const image = typeof body.image === 'string' ? body.image : null;
    if (image) {
      if (image.length > 7_000_000 || !/^data:image\/(png|jpeg|webp);base64,/.test(image)) return res.status(400).json({error:'الصورة غير مدعومة أو حجمها كبير.'});
      input.push({role:'user',content:[{type:'input_text',text:last.content},{type:'input_image',image_url:image,detail:'high'}]});
    } else input.push({role:'user',content:last.content});
    const ai = await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-4.1',instructions:SYSTEM_PROMPT,input,max_output_tokens:1400})});
    const result = await ai.json().catch(()=>({}));
    if (!ai.ok) {
      const detail = result?.error?.message;
      console.error('OpenAI Responses API error',ai.status,detail||'unknown');
      return res.status(ai.status===429?429:502).json({error:ai.status===429?'وصل المساعد إلى حد الطلبات مؤقتاً. حاول بعد قليل.':'تعذر على خدمة الذكاء الاصطناعي إكمال الرد. تحقق من إعداد المفتاح والرصيد.'});
    }
    const reply = (result.output||[]).flatMap(item=>item.content||[]).filter(part=>part.type==='output_text').map(part=>part.text).join('\n').trim();
    if (!reply) return res.status(502).json({error:'وصل رد فارغ من خدمة الذكاء الاصطناعي.'});
    return res.status(200).json({reply});
  } catch (error) {
    console.error('Design assistant error',error);
    return res.status(400).json({error:error?.message||'تعذر معالجة الطلب.'});
  }
}