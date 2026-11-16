export function initAuthGate(supabase) {
  if (!supabase) return;

  const gate = document.createElement('section');
  gate.className = 'auth-gate';
  gate.setAttribute('aria-label', 'تسجيل الدخول');
  gate.innerHTML = `
    <div class="auth-layout" dir="rtl">
      <aside class="auth-showcase" aria-label="معلومات النظام">
        <div class="auth-showcase-top"><span class="auth-brand-mark">MA</span><span class="auth-brand-name">MOHAMMED ASaad<small>UPHOLSTERY & ENGINEERING</small></span></div>
        <div class="auth-showcase-copy">
          <span class="auth-overline">WORKSPACE / 01</span>
          <h2>من الفكرة،<br>إلى أدقّ تفصيلة.</h2>
          <p>مساحة عمل واحدة لتصميم الأثاث، تنظيم المشاريع، وتجهيز بيانات التصنيع.</p>
        </div>
        <div class="auth-blueprint" aria-hidden="true">
          <div class="blueprint-frame"><span class="bp-dim bp-top">2400 mm</span><span class="bp-dim bp-side">900 mm</span><div class="bp-cabinet"><i></i><i></i><i></i><b></b></div><span class="bp-caption">CUSTOM FURNITURE / TECHNICAL STUDY</span></div>
        </div>
        <div class="auth-showcase-foot"><span class="auth-status-dot"></span> بيئة عمل خاصة وآمنة <span class="auth-foot-sep">•</span> MOHAMMED ASAAD</div>
      </aside>
      <div class="auth-form-side">
        <form class="auth-card" id="authForm" novalidate>
          <div class="auth-mobile-brand"><span class="auth-brand-mark">MA</span><span>محمد أسعد <small>للتنجيد والتصميم الهندسي</small></span></div>
          <p class="auth-eyebrow">مساحة العمل الخاصة</p>
          <h1 id="authTitle">مرحباً بعودتك</h1>
          <p class="auth-copy" id="authCopy">سجّل الدخول للمتابعة إلى مشاريعك ومساحة التصميم.</p>
          <div class="auth-field">
            <label for="authEmail">البريد الإلكتروني</label>
            <input id="authEmail" name="email" type="email" autocomplete="username" required placeholder="name@example.com" />
          </div>
          <div class="auth-field">
            <div class="auth-label-row"><label for="authPassword">كلمة المرور</label><button class="auth-forgot" id="authForgot" type="button">نسيت كلمة المرور؟</button></div>
            <div class="auth-password-wrap"><input id="authPassword" name="password" type="password" autocomplete="current-password" minlength="6" required placeholder="أدخل كلمة المرور" /><button class="auth-eye" id="authEye" type="button" aria-label="إظهار كلمة المرور" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg></button></div>
          </div>
          <button class="auth-submit" id="authSubmit" type="submit"><span>تسجيل الدخول</span><b aria-hidden="true">←</b></button>
          <div class="auth-divider"><span>دخول آمن إلى النظام</span></div>
          <button class="auth-switch" id="authSwitch" type="button">إنشاء حساب جديد لأول مرة</button>
          <p class="auth-feedback" id="authFeedback" role="status" aria-live="polite"></p>
          <p class="auth-legal">باستخدامك النظام، تبقى بيانات المشاريع ضمن مساحة الشركة المصرّح بها.</p>
        </form>
        <div class="auth-form-footer">© محمد أسعد للتنجيد <span>•</span> نظام التصميم والتصنيع</div>
      </div>
    </div>`;
  document.body.appendChild(gate);

  const form = gate.querySelector('#authForm');
  const title = gate.querySelector('#authTitle');
  const copy = gate.querySelector('#authCopy');
  const submit = gate.querySelector('#authSubmit');
  const toggle = gate.querySelector('#authSwitch');
  const feedback = gate.querySelector('#authFeedback');
  const password = gate.querySelector('#authPassword');
  const email = gate.querySelector('#authEmail');
  const forgot = gate.querySelector('#authForgot');
  const eye = gate.querySelector('#authEye');
  let mode = 'signin';

  window.addEventListener('open-auth-gate', () => {
    gate.hidden = false;
    gate.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => email.focus());
  });

  function setMode(next) {
    mode = next;
    const signup = mode === 'signup';
    title.textContent = signup ? 'إنشاء حساب الشركة' : 'مرحباً بعودتك';
    copy.textContent = signup
      ? 'أنشئ حسابك للوصول إلى مساحة العمل الخاصة بك.'
      : 'سجّل الدخول للمتابعة إلى مشاريعك ومساحة التصميم.';
    submit.querySelector('span').textContent = signup ? 'إنشاء الحساب' : 'تسجيل الدخول';
    toggle.textContent = signup ? 'لديك حساب بالفعل؟ سجّل الدخول' : 'إنشاء حساب جديد لأول مرة';
    forgot.hidden = signup;
    password.autocomplete = signup ? 'new-password' : 'current-password';
    feedback.textContent = '';
  }

  toggle.addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));
  eye.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(visible));
    eye.setAttribute('aria-label', visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
  });

  forgot.addEventListener('click', async () => {
    const emailValue = email.value.trim();
    if (!emailValue) {
      feedback.textContent = 'اكتب بريدك الإلكتروني أولاً، ثم اطلب رابط إعادة التعيين.';
      email.focus();
      return;
    }
    forgot.disabled = true;
    feedback.textContent = 'جارٍ إرسال رابط إعادة تعيين كلمة المرور…';
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailValue, {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      feedback.textContent = 'إذا كان البريد مسجلاً، سيصلك رابط إعادة التعيين. افحص صندوق الوارد والرسائل غير المرغوبة.';
    } catch (error) {
      feedback.textContent = /network|failed to fetch|load failed/i.test(String(error?.message || ''))
        ? 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.'
        : (error?.message || 'تعذر إرسال رابط إعادة التعيين. حاول لاحقاً.');
    } finally {
      forgot.disabled = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    feedback.textContent = 'جارٍ التحقق من بيانات الدخول…';
    submit.disabled = true;
    submit.querySelector('span').textContent = 'جارٍ التحقق…';
    const emailValue = email.value.trim();
    const passwordValue = password.value;
    try {
      const result = mode === 'signup'
        ? await supabase.auth.signUp({ email: emailValue, password: passwordValue })
        : await supabase.auth.signInWithPassword({ email: emailValue, password: passwordValue });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) {
        feedback.textContent = 'تم إنشاء الحساب. افحص بريدك الإلكتروني لتأكيده، ثم ارجع وسجّل الدخول.';
      } else {
        feedback.textContent = 'تم الدخول بنجاح.';
        gate.hidden = true;
        gate.setAttribute('aria-hidden', 'true');
        window.dispatchEvent(new Event('supabase-auth-change'));
      }
    } catch (error) {
      const message = String(error?.message || '');
      if (/invalid login credentials/i.test(message)) feedback.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      else if (/email not confirmed/i.test(message)) feedback.textContent = 'أكد بريدك الإلكتروني أولاً ثم حاول تسجيل الدخول.';
      else if (/password.*(6|short|length)/i.test(message)) feedback.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
      else if (/over_email_send_rate_limit|only request this after/i.test(message)) {
        const seconds = message.match(/after\s+(\d+)\s+seconds/i)?.[1];
        feedback.textContent = seconds ? `تم إرسال طلبات كثيرة. انتظر ${seconds} ثانية ثم حاول مجددًا.` : 'تم إرسال طلبات كثيرة. انتظر قليلاً ثم حاول مجددًا.';
      } else if (/email link is invalid|one-time token not found/i.test(message)) feedback.textContent = 'رابط التأكيد منتهي أو استُخدم سابقاً. اطلب رابطاً جديداً.';
      else if (/network|failed to fetch|load failed/i.test(message)) feedback.textContent = 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.';
      else feedback.textContent = message || 'تعذر إكمال العملية. حاول مرة أخرى.';
    } finally {
      submit.disabled = false;
      submit.querySelector('span').textContent = mode === 'signup' ? 'إنشاء الحساب' : 'تسجيل الدخول';
    }
  });

  supabase.auth.getSession().then(({ data, error }) => {
    gate.hidden = Boolean(data?.session);
    gate.setAttribute('aria-hidden', String(Boolean(data?.session)));
    if (error) feedback.textContent = 'تعذر التحقق من جلسة الدخول. حاول تسجيل الدخول.';
  }).catch(() => {
    gate.hidden = false;
    gate.setAttribute('aria-hidden', 'false');
    feedback.textContent = 'تعذر الاتصال للتحقق من جلسة الدخول. تحقق من الإنترنت ثم أعد المحاولة.';
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    gate.hidden = Boolean(session);
    gate.setAttribute('aria-hidden', String(Boolean(session)));
    window.dispatchEvent(new Event('supabase-auth-change'));
  });
}
