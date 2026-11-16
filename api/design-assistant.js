const SYSTEM_PROMPT = `أنت مهندس تصميم ومساعد تنفيذ لشركة محمد أسعد للتنجيد والتصميم الهندسي. تحدث بالعربية الأردنية الطبيعية، وكن مبادراً وحاسماً ولا تكرر الأسئلة.

قاعدة العمل الأساسية:
- هدفك تحويل طلب المستخدم إلى مسودة تصميم منظمة قابلة للتطوير، وليس إبقاءه في محادثة لا تنتهي.
- ابدأ فوراً بمسودة عند معرفة نوع القطعة، حتى لو كانت بعض التفاصيل ناقصة. ضع القيم الناقصة null واذكرها في openQuestions.
- اسأل سؤالاً واحداً فقط عندما تكون الإجابة ضرورية فعلاً للخطوة التالية. لا تسأل عن تفضيلات شكلية إذا قال المستخدم "اختار أنت" أو "حط الافتراضي".
- إذا طلب المستخدم اختياراً افتراضياً أو قال "اختار أنت"، اختر اقتراحاً عملياً مناسباً لنوع القطعة، وضع مصدره proposal بوضوح، وبيّن أنه قابل للتعديل. لا تقدمه على أنه قياس مستخدم أو مواصفة نهائية.
- إذا وافق المستخدم على اقتراح، ثبّت ذلك في سياق المسودة ولا تعد السؤال عنه. كلمات مثل "تمام"، "نعم"، "اعتمد"، "ابدأ"، "باشر" تعني الموافقة على آخر اقتراح واضح والانتقال للخطوة التالية، لا إعادة تلخيصه وطلب موافقة جديدة.
- بعد اكتمال معلومات كافية لمسودة تصورية، توقف عن الاستجواب وقدم النتيجة والخطوة العملية التالية. لا تطلب اعتماداً إضافياً بعد كلمة "اعتمد".
- لا تعلن تسجيل طلب أو بدء تصنيع أو حجز مواد أو إرسال أمر للورشة إلا إذا نفذت أداة فعلية تؤكد ذلك. أنت لا تملك هذه العمليات تلقائياً.

التعامل مع الافتراضات:
- يجوز وضع أبعاد قياسية مقترحة فقط إذا طلب المستخدم صراحة الافتراضي أو فوّضك بالاختيار. ضعها في designDraft مع source="proposal" وفي الرد سمّها "اقتراحاً افتراضياً قابلاً للتعديل".
- إذا لم يفوضك المستخدم، لا تخترع أبعاداً أو خامات أو سماكات أو كثافات.
- لا تخلط بين موافقة المستخدم على مسودة وبين اعتماد تصنيع نهائي. التصنيع يبقى غير معتمد إلى حين مراجعة هندسية فعلية.
- حافظ على القيم التي وافق عليها المستخدم في الرسائل السابقة ولا تتراجع عنها أو تعيد السؤال عنها.

سير العمل:
1) فهم القطعة والتكوين.
2) إعداد مسودة أولية فوراً، وتضمين أجزائها الرئيسية وأبعادها المعروفة أو المقترحة بمصدر واضح.
3) سد النواقص بسؤال واحد عند الضرورة فقط.
4) عند قول المستخدم "أريني الشكل" أو "اعرض التصميم"، لا ترد باعتذار عام ولا تدّع إنشاء CAD. أخرج المسودة المنظمة بأكبر قدر تسمح به البيانات، وقل بوضوح ما إذا كان المتاح معاينة تصورية أم ملف CAD فعلي.
5) عند قول "ابدأ" بعد الموافقة، نفّذ الخطوة المتاحة فعلياً. إذا لا توجد أداة إنشاء هندسة في الطلب الحالي، جهّز البيانات المنظمة واذكر بدقة ما الذي لم يُنشأ بعد.

قواعد الهندسة:
- ميّز الطول والعرض والعمق والارتفاع والوحدات. لا تضع قيمة سالبة أو صفراً كبعد.
- لا تستخرج أبعاداً دقيقة من صورة بلا مرجع قياس. إذا طلب المستخدم صراحةً أن تقترح له أبعاداً من الصورة ولا يملك أي قياس مرجعي، يمكنك اقتراح أبعاد معيارية تقريبية مناسبة لنوع الأثاث، لكن ضع dimensionSource="proposal" بوضوح، واشرح أنها تقديرات قابلة للتعديل وليست قياسات مستخرجة أو مضمونة. لا تجعلها اعتماد تصنيع. عند وجود صورة، ميّز ما تراه عن المقترح، ولا تملأ الأبعاد إلا عندما يكون اقتراحها مطلوباً أو مفوضاً.
- لا تخترع تفاصيل وصلات أو سماكات أو إكسسوارات أو قصّات غير محسومة.
- للكنب المنجّد: ميّز الأبعاد الخارجية عن أبعاد المقعد والظهر والذراعين. لا تعتبر صندوقاً خارجياً واحداً رسماً تصنيعياً كاملاً.
- عند إنشاء components، اجعل كل عنصر مستقلاً باسم ودور وأبعاد عرض/عمق/ارتفاع؛ إن لم تعرف الأبعاد اتركها null ولا تخترعها.
- لا تجعل readyForManufacturing=true أبداً في هذه المرحلة. ولا تجعل readyForGeometry=true إلا إذا كانت أبعاد كل عنصر هندسي مطلوبة مكتملة وصالحة.

شكل الرد:
- مختصر وعملي، يبدأ بما تم إنجازه الآن.
- اذكر الاقتراحات بوضوح ومصدرها، ثم اذكر النواقص الحقيقية فقط.
- لا تكرر عبارة "هل ترغب..." في نهاية كل رد. لا تضع سؤالاً إذا لم تكن هناك معلومة ضرورية ناقصة.

`;

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
    const responseSchema = {
      type:"OBJECT",
      properties:{
        reply:{type:"STRING"},
        designDraft:{
          type:"OBJECT",nullable:true,
          properties:{
            kind:{type:"STRING"},name:{type:"STRING"},description:{type:"STRING"},
            dimensions:{type:"OBJECT",properties:{width:{type:"NUMBER",nullable:true},depth:{type:"NUMBER",nullable:true},height:{type:"NUMBER",nullable:true}},required:["width","depth","height"]},dimensionSource:{type:"STRING",enum:["user","proposal","unknown"]},
            materials:{type:"ARRAY",items:{type:"OBJECT",properties:{name:{type:"STRING"},thicknessMm:{type:"NUMBER",nullable:true},source:{type:"STRING"}},required:["name","thicknessMm","source"]}},
            components:{type:"ARRAY",items:{type:"OBJECT",properties:{id:{type:"STRING"},name:{type:"STRING"},role:{type:"STRING"},dimensions:{type:"OBJECT",properties:{width:{type:"NUMBER",nullable:true},depth:{type:"NUMBER",nullable:true},height:{type:"NUMBER",nullable:true}},required:["width","depth","height"]}},required:["id","name","role","dimensions"]}},
            openQuestions:{type:"ARRAY",items:{type:"STRING"}}
          },
          required:["kind","name","description","dimensions","dimensionSource","materials","components","openQuestions"]
        }
      },
      required:["reply","designDraft"]
    };
    const requestBody = JSON.stringify({
      systemInstruction:{parts:[{text:SYSTEM_PROMPT+"\\n\\nأخرج JSON فقط وفق المخطط. إذا كانت الرسالة ليست طلب تصميم أو متابعة تصميم فأعد designDraft=null. إذا كانت طلب تصميم، أنشئ مسودة أولية الآن. لا تضع أرقاماً لم يذكرها المستخدم: كل بُعد مجهول null. لا تضف مكونات بقياسات مخترعة. استخدم معرفات نصية ثابتة داخل المسودة مثل part-1. materials وcomponents وopenQuestions مصفوفات حتى لو فارغة."}]},
      contents,
      generationConfig:{maxOutputTokens:1800,temperature:0.25,responseMimeType:"application/json",responseSchema}
    });
    const primaryModel = 'gemini-3.1-flash-lite';
    const fallbackModel = 'gemini-3.8-flash';
    async function callGemini(model) {
      const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(apiKey);
      const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:requestBody});
      const data = await response.json().catch(()=>({}));
      return {response,data,model};
    }
    let attempt = await callGemini(primaryModel);
    if (!attempt.response.ok && attempt.response.status === 503 && fallbackModel && fallbackModel !== primaryModel) {
      console.warn('Primary Gemini model unavailable; trying fallback model',primaryModel,fallbackModel);
      attempt = await callGemini(fallbackModel);
    }
    const {response:ai,data:result,model:usedModel} = attempt;
    if (!ai.ok) {
      const detail = result?.error?.message || 'unknown';
      console.error('Gemini API error',usedModel,ai.status,detail);
      if (ai.status === 429) return res.status(429).json({error:'وصل المساعد إلى حد الطلبات المتاح حالياً. انتظر قليلاً ثم حاول مرة أخرى.'});
      if (ai.status === 401 || ai.status === 403) return res.status(503).json({error:'مفتاح Gemini غير صالح أو لا يملك صلاحية استخدام النموذج. راجع إعداد GEMINI_API_KEY في Vercel.'});
      if (ai.status === 503) return res.status(503).json({error:'خدمة Gemini مشغولة حالياً، وحتى النموذج الاحتياطي لم يتمكن من الرد. انتظر قليلاً ثم أعد المحاولة.'});
      return res.status(502).json({error:'تعذر على Gemini إكمال الرد حالياً. حاول مرة أخرى بعد قليل.'});
    }
    const raw = (result.candidates?.[0]?.content?.parts || []).map(part=>part.text || '').join('').trim();
    if (!raw) return res.status(502).json({error:'وصل رد فارغ من Gemini. حاول صياغة الطلب بطريقة أخرى.'});
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return res.status(502).json({error:'تعذر قراءة المسودة المنظمة من المساعد. أعد المحاولة.'}); }
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
    if (!reply) return res.status(502).json({error:'وصل رد غير مكتمل من Gemini.'});
    let designDraft = null;
    if (parsed.designDraft && typeof parsed.designDraft === 'object') {
      const cleanDimension = value => {
        const number = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
        return number;
      };
      const dimensions = value => ({
        width:cleanDimension(value?.width),
        depth:cleanDimension(value?.depth),
        height:cleanDimension(value?.height)
      });
      const source = value => ["user","measured-file","proposal","unknown"].includes(value) ? value : "unknown";
      const materials = Array.isArray(parsed.designDraft.materials) ? parsed.designDraft.materials.slice(0,40).map((item,index)=>({
        name:String(item?.name || "مادة غير محددة").slice(0,120),
        thicknessMm:cleanDimension(item?.thicknessMm),
        source:source(item?.source)
      })) : [];
      const components = Array.isArray(parsed.designDraft.components) ? parsed.designDraft.components.slice(0,100).map((item,index)=>({
        id:String(item?.id || "component-"+(index+1)).slice(0,80),
        name:String(item?.name || "عنصر").slice(0,120),
        role:String(item?.role || "unspecified").slice(0,120),
        dimensions:dimensions(item?.dimensions)
      })) : [];
      const topDimensions = dimensions(parsed.designDraft.dimensions);\n      const dimensionSource = ["user","proposal","unknown"].includes(parsed.designDraft.dimensionSource) ? parsed.designDraft.dimensionSource : "unknown";
      const allGeometryDimensionsKnown = components.length > 0 && components.every(item => Object.values(item.dimensions).every(value => value !== null));
      const issues = [];
      if (!components.length) issues.push("لا توجد عناصر محددة بأبعاد هندسية.");
      if (components.some(item => Object.values(item.dimensions).some(value => value === null))) issues.push("بعض العناصر ينقصها بُعد واحد أو أكثر؛ لم تُنشأ لها هندسة.");
      designDraft = {
        protocol:"mo-asaad.cad-bridge",version:1,
        draftId:globalThis.crypto?.randomUUID?.() || "draft-"+Date.now()+"-"+Math.random().toString(16).slice(2),
        createdAt:new Date().toISOString(),status:"draft",
        source:{kind:"ai-assistant",projectId:null},
        units:{length:"mm",angle:"degree"},
        design:{
          kind:String(parsed.designDraft.kind || "custom-furniture").slice(0,80),
          name:String(parsed.designDraft.name || "مسودة تصميم").slice(0,160),
          description:String(parsed.designDraft.description || "").slice(0,3000),
          dimensions:topDimensions,dimensionSource,materials,components,
          openQuestions:Array.isArray(parsed.designDraft.openQuestions) ? parsed.designDraft.openQuestions.slice(0,30).map(q=>String(q).slice(0,500)) : []
        },
        targets:["autocad","sketchup"],
        validation:{
          readyForGeometry:allGeometryDimensionsKnown,
          readyForManufacturing:false,
          issues
        }
      };
    }
    return res.status(200).json({reply,designDraft});
  } catch (error) {
    console.error('Design assistant error',error);
    return res.status(400).json({error:error?.message||'تعذر معالجة الطلب.'});
  }
}