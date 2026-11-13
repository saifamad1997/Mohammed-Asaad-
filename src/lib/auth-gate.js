export function initAuthGate(supabase) {
  if (!supabase) return;

  const gate = document.createElement('section');
  gate.className = 'auth-gate';
  gate.setAttribute('aria-label', 'تسجيل الدخول');
  gate.innerHTML = `
    <form class="auth-card" id="authForm">
      <div class="auth-mark">MA</div>
      <p class="auth-eyebrow">نظام خاص بالشركة</p>
      <h1 id="authTitle">تسجيل الدخول</h1>
      <p class="auth-copy" id="authCopy">سجّل الدخول للوصول إلى مشاريع الشركة وبياناتها.</p>
      <label for="authEmail">البريد الإلكتروني</label>
      <input id="authEmail" name="email" type="email" autocomplete="email" required placeholder="name@example.com" />
      <label for="authPassword">كلمة المرور</label>
      <input id="authPassword" name="password" type="password" autocomplete="current-password" minlength="6" required placeholder="6 أحرف على الأقل" />
      <button class="auth-submit" id="authSubmit" type="submit">دخول</button>
      <button class="auth-switch" id="authSwitch" type="button">إنشاء حساب جديد لأول مرة</button>
      <p class="auth-feedback" id="authFeedback" role="status" aria-live="polite"></p>
    </form>`;
  document.body.appendChild(gate);

  const form = gate.querySelector('#authForm');
  const title = gate.querySelector('#authTitle');
  const copy = gate.querySelector('#authCopy');
  const submit = gate.querySelector('#authSubmit');
  const toggle = gate.querySelector('#authSwitch');
  const feedback = gate.querySelector('#authFeedback');
  const password = gate.querySelector('#authPassword');
  let mode = 'signin';

  function setMode(next) {
    mode = next;
    const signup = mode === 'signup';
    title.textContent = signup ? 'إنشاء حساب الشركة' : 'تسجيل الدخول';
    copy.textContent = signup
      ? 'أنشئ حسابك للوصول الآمن إلى مساحة العمل الخاصة بك.'
      : 'سجّل الدخول للوصول إلى مشاريع الشركة وبياناتها.';
    submit.textContent = signup ? 'إنشاء الحساب' : 'دخول';
    toggle.textContent = signup ? 'لديك حساب؟ سجّل الدخول' : 'إنشاء حساب جديد لأول مرة';
    password.autocomplete = signup ? 'new-password' : 'current-password';
    feedback.textContent = '';
  }

  toggle.addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.textContent = 'جارٍ التحقق…';
    submit.disabled = true;
    const email = form.elements.email.value.trim();
    const passwordValue = form.elements.password.value;
    try {
      const result = mode === 'signup'
        ? await supabase.auth.signUp({ email, password: passwordValue })
        : await supabase.auth.signInWithPassword({ email, password: passwordValue });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) {
        feedback.textContent = 'تم إنشاء الحساب. افحص بريدك الإلكتروني لتأكيده، ثم ارجع وسجّل الدخول.';
      } else {
        feedback.textContent = 'تم الدخول بنجاح.';
        gate.hidden = true;
        window.dispatchEvent(new Event('supabase-auth-change'));
      }
    } catch (error) {
      const message = String(error?.message || '');
      if (/invalid login credentials/i.test(message)) {
        feedback.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (/email not confirmed/i.test(message)) {
        feedback.textContent = 'أكد بريدك الإلكتروني أولاً ثم حاول تسجيل الدخول.';
      } else if (/password.*(6|short|length)/i.test(message)) {
        feedback.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
      } else if (/over_email_send_rate_limit|only request this after/i.test(message)) {
        const seconds = message.match(/after\\s+(\\d+)\\s+seconds/i)?.[1];
        feedback.textContent = seconds
          ? `تم إرسال طلبات كثيرة. انتظر ${seconds} ثانية ثم حاول مجددًا.`
          : 'تم إرسال طلبات كثيرة. انتظر قليلًا ثم حاول مجددًا.';
      } else if (/email link is invalid|one-time token not found/i.test(message)) {
        feedback.textContent = 'رابط تأكيد البريد منتهي أو استُخدم سابقًا. اطلب رابط تأكيد جديدًا.';
      } else if (/network|failed to fetch|load failed/i.test(message)) {
        feedback.textContent = 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.';
      } else {
        feedback.textContent = message || 'تعذر إكمال العملية. حاول مرة أخرى.';
      }
    } finally {
      submit.disabled = false;
    }
  });

  supabase.auth.getSession().then(({ data, error }) => {
    gate.hidden = Boolean(data?.session);
    if (error) feedback.textContent = 'تعذر التحقق من جلسة الدخول. حاول تسجيل الدخول.';
  }).catch(() => {
    gate.hidden = false;
    feedback.textContent = 'تعذر الاتصال للتحقق من جلسة الدخول. تحقق من الإنترنت ثم أعد المحاولة.';
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    gate.hidden = Boolean(session);
    window.dispatchEvent(new Event('supabase-auth-change'));
  });
}
