/* =========================================================================
   LOGIN / REGISTRO (mock) — js/login.js
   · Mascota: pupilas y cabeza siguen el mouse; al tipear mira el campo;
     se tapa los ojos con la contraseña; festeja al crear la cuenta.
   · Ingresar: legajo/mail + contraseña → 2FA de 6 dígitos (o directo con Google).
   · Registro: no hay "crear cuenta". El alumno llega por un magic link (#login/registro)
     directo al formulario con sus datos → código 2FA de 6 dígitos → vuelve a iniciar sesión.
   · Hacia el 2FA: la card gira, al robot le aparece el cuerpo, se da vuelta y la card
     vuelve girando con el código (turnTo).
   Depende de $, $$, setRole y showToast del script principal.
   ========================================================================= */
(() => {
  const root = $('#screen-login');
  if (!root) return;

  const mascot = $('#lg-mascot', root);
  const head = $('#lg-head', root);
  const look = $('#lg-look', root);
  const pupils = $('#lg-pupils', root);
  const card = $('#lg-card', root);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const st = { step: 'login', flow: 'login', mail: '', timer: 0, resendAt: 0, leaving: 0, busy: false, anim: [] };
  const MAGIC_MAIL = 'alumno.nuevo@frc.utn.edu.ar'; // mail al que "llegó" la invitación

  /* ---------------- copy por paso ---------------- */
  const COPY = {
    login: ['Entrá a TPI 2026', 'Seguí con tu <b>legajo</b> o tu mail institucional.'],
    data: ['Completá tu registro', 'Entraste con el enlace de tu invitación. Cargá tus datos para armarte el perfil.'],
    otp: ['Verificá tu identidad', () => `Te mandamos un código de 6 dígitos a <b>${maskMail(st.mail)}</b>.`],
    done: ['', ''],
  };
  const maskMail = m => { const [u, d] = m.split('@'); return `${u[0]}${'•'.repeat(Math.max(3, u.length - 1))}@${d}`; };
  const isLegajo = v => /^\d{4,6}$/.test(v);
  const mailFor = v => (isLegajo(v) ? `${v}@frc.utn.edu.ar` : v);
  const isMail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  const stepEl = s => $(`[data-lg-step="${s}"]`, root);

  /* ---------------- mascota ---------------- */
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, mood = 'idle', moodTimer = 0;
  let aim = null; // {x,y} en pantalla cuando mira un campo mientras se tipea

  function setMood(m, ms = 0) {
    clearTimeout(moodTimer);
    mood = m; mascot.dataset.mood = m;
    if (ms) moodTimer = setTimeout(() => setMood(passwordFocused() ? 'shy' : 'idle'), ms);
  }
  const passwordFocused = () => document.activeElement?.matches?.('[data-lg-pw]') && document.activeElement.type === 'password';

  function aimAt(x, y) {
    const r = $('.m-body', mascot).getBoundingClientRect();
    const ox = r.left + r.width / 2, oy = r.top + r.height * 0.5;
    const dx = x - ox, dy = y - oy;
    const dist = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, dist / 260);
    tx = (dx / dist) * k; ty = (dy / dist) * k;
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
    pupils.style.transform = `translate(${(cx * 7).toFixed(2)}px, ${(cy * 5.5).toFixed(2)}px)`;
    look.style.transform = `translate(${(cx * 5).toFixed(2)}px, ${(cy * 3).toFixed(2)}px)`;
    head.style.transform = `rotate(${(cx * 5).toFixed(2)}deg)`;
    raf = (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002) ? requestAnimationFrame(tick) : 0;
  }
  function onMouse(e) {
    if (root.hidden || reduceMotion.matches) return;
    aim = null;
    aimAt(e.clientX, e.clientY);
  }
  addEventListener('pointermove', onMouse, { passive: true });

  /* al tipear mira hacia el punto del campo donde está el texto */
  function lookAtField(input) {
    if (reduceMotion.matches || !input) return;
    const r = input.getBoundingClientRect();
    const ratio = Math.min(1, (input.value.length || 0) / 22);
    aim = { x: r.left + 24 + (r.width - 48) * ratio, y: r.top + r.height / 2 };
    aimAt(aim.x, aim.y);
  }

  root.addEventListener('focusin', e => {
    const t = e.target;
    if (!t.matches?.('input')) return;
    if (t.matches('[data-lg-pw]') && t.type === 'password') setMood('shy');
    else { if (mood === 'shy') setMood('idle'); lookAtField(t); }
  });
  root.addEventListener('focusout', e => {
    if (e.target.matches?.('[data-lg-pw]') && mood === 'shy') setMood('idle');
  });
  root.addEventListener('input', e => {
    if (e.target.matches?.('input.control:not([data-lg-pw]):not(.otp-d)')) lookAtField(e.target);
  });

  /* mostrar/ocultar contraseña: con la contraseña visible la mascota espía */
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-lg-toggle]');
    if (!b) return;
    const input = $('input', b.parentElement);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(show));
    b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    b.innerHTML = `<svg class="icon icon-sm" aria-hidden="true"><use href="#${show ? 'i-x' : 'i-eye'}"/></svg>`;
    input.focus();
    if (show) { setMood('idle'); lookAtField(input); } else setMood('shy');
  });

  /* ---------------- navegación entre pasos ---------------- */
  function msg(text, info = false) {
    const el = $('[data-lg-msg]', stepEl(st.step));
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('info', info);
    if (text && !info) setMood('oops', 700);
  }
  function show(step) {
    st.step = step;
    $$('[data-lg-step]', root).forEach(s => { s.hidden = s.dataset.lgStep !== step; });
    const order = ['data', 'otp'];
    $('#lg-steps', root).hidden = !(st.flow === 'register' && order.includes(step));
    $('[data-lg-change]', root).textContent = st.flow === 'login' ? 'Volver a ingresar' : 'Volver a mis datos';
    $$('[data-lg-dot]', root).forEach(li => {
      const i = order.indexOf(li.dataset.lgDot), cur = order.indexOf(step);
      li.classList.toggle('done', i < cur);
      li.toggleAttribute('aria-current', i === cur);
      if (i === cur) li.setAttribute('aria-current', 'step');
      $('.n', li).innerHTML = i < cur ? '<svg class="icon" aria-hidden="true"><use href="#i-tick"/></svg>' : String(i + 1);
    });
    const [t, s] = COPY[step];
    const head1 = $('.login-head', root);
    head1.hidden = step === 'done';
    $('#lg-title', root).textContent = t;
    $('#lg-sub', root).innerHTML = typeof s === 'function' ? s() : s;
    if (step !== 'done' && !st.busy) requestAnimationFrame(() => focusStep(step));
  }
  function focusStep(step) {
    const first = $(step === 'otp' ? '.otp-d' : 'input:not([readonly])', stepEl(step));
    first?.focus({ preventScroll: true });
  }

  /* ---------------- transición al 2FA: la card gira 360° con el robot colgado ---------------- */
  const rig = $('#lg-rig', root);
  const SPIN_MS = 1150;
  const later = (fn, ms) => { st.anim.push(setTimeout(fn, ms)); };
  function cancelTurn() {
    st.anim.forEach(clearTimeout); st.anim = [];
    st.busy = false;
    rig.classList.remove('spin');
    delete mascot.dataset.pose;
  }
  function turnTo(step, prepare) {
    if (st.busy) return;
    if (reduceMotion.matches) { prepare?.(); show(step); return; }
    st.busy = true;
    if (document.activeElement?.blur) document.activeElement.blur();
    setMood('idle');
    mascot.dataset.pose = 'hang';
    rig.classList.add('spin');
    later(() => { prepare?.(); show(step); }, SPIN_MS * 0.27);   // cambia el contenido con la card de canto
    later(() => {
      rig.classList.remove('spin');
      delete mascot.dataset.pose;
      st.busy = false;
      focusStep(step);
    }, SPIN_MS + 40);
  }

  function goLogin() {
    st.flow = 'login';
    clearInterval(st.timer);
    $$('[data-lg-msg]', root).forEach(x => { x.textContent = ''; });
    setMood('idle');
    show('login');
  }
  /* magic link: el mail llega confirmado y se abre directo el formulario de registro */
  function goRegister() {
    clearInterval(st.timer);
    $$('[data-lg-msg]', root).forEach(x => { x.textContent = ''; });
    st.flow = 'register';
    st.mail = MAGIC_MAIL;
    stepEl('data').mail.value = st.mail;
    setMood('idle');
    show('data');
  }

  /* ---------------- ingresar ---------------- */
  stepEl('login').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const id = f.id.value.trim();
    if (!id) return (f.id.setAttribute('aria-invalid', 'true'), f.id.focus(), msg('Escribí tu legajo o tu mail.'));
    if (!isLegajo(id) && !isMail(id)) return (f.id.setAttribute('aria-invalid', 'true'), f.id.focus(), msg('Ese dato no parece un legajo ni un mail. Revisalo.'));
    f.id.removeAttribute('aria-invalid');
    if (!f.pw.value) return (f.pw.focus(), msg('Falta la contraseña.'));
    msg('');
    st.flow = 'login'; st.mail = mailFor(id.toLowerCase());
    turnTo('otp', () => { clearOtp(); startResend(); });
  });
  stepEl('login').addEventListener('input', e => e.target.removeAttribute?.('aria-invalid'));
  $('[data-lg-forgot]', root).addEventListener('click', () => {
    showToast('Te mandamos un enlace a tu mail institucional para que armes una contraseña nueva.', 'info', 'i-key');
  });
  $('[data-lg-google]', root).addEventListener('click', () => finish('¡Conectado con Google!', 'Entrando a tu inicio.'));
  $('[data-lg-magic]', root).addEventListener('click', () => { location.hash = 'login/registro'; goRegister(); });

  /* ---------------- registro 2: 2FA de 6 dígitos ---------------- */
  const otpBox = $('#lg-otp', root);
  otpBox.innerHTML = Array.from({ length: 6 }, (_, i) =>
    `<input class="control otp-d" inputmode="numeric" autocomplete="${i ? 'off' : 'one-time-code'}" maxlength="1" aria-label="Dígito ${i + 1} de 6" />`).join('');
  const digits = $$('.otp-d', otpBox);
  const code = () => digits.map(d => d.value).join('');
  function clearOtp() { digits.forEach(d => { d.value = ''; d.classList.remove('filled'); }); otpBox.dataset.state = ''; }
  function fill(str) {
    const s = str.replace(/\D/g, '').slice(0, 6);
    digits.forEach((d, i) => { d.value = s[i] || ''; d.classList.toggle('filled', !!d.value); });
    digits[Math.min(s.length, 5)].focus();
    if (s.length === 6) setTimeout(verify, 180);
  }
  digits.forEach((d, i) => {
    d.addEventListener('input', () => {
      const v = d.value.replace(/\D/g, '');
      if (v.length > 1) return fill(v);
      d.value = v; d.classList.toggle('filled', !!v);
      otpBox.dataset.state = '';
      if (v && i < 5) digits[i + 1].focus();
      if (code().length === 6) setTimeout(verify, 180);
    });
    d.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !d.value && i > 0) { digits[i - 1].value = ''; digits[i - 1].classList.remove('filled'); digits[i - 1].focus(); }
      if (e.key === 'ArrowLeft' && i > 0) digits[i - 1].focus();
      if (e.key === 'ArrowRight' && i < 5) digits[i + 1].focus();
    });
    d.addEventListener('paste', e => { e.preventDefault(); fill(e.clipboardData.getData('text')); });
    d.addEventListener('focus', () => d.select());
  });
  function verify() {
    if (st.step !== 'otp') return;
    const c = code();
    if (c.length < 6) return msg('Faltan dígitos. Son 6.');
    if (c === '000000') {
      otpBox.dataset.state = 'error';
      msg('Ese código no es el que te mandamos. Probá de nuevo o pedí uno nuevo.');
      setTimeout(() => { clearOtp(); digits[0].focus(); }, 650);
      return;
    }
    otpBox.dataset.state = 'ok';
    msg('');
    setMood('happy', 900);
    setTimeout(() => (st.flow === 'login'
      ? finish('¡Hola de nuevo!', 'Entrando a tu inicio.')
      : finish('¡Cuenta creada!', 'Ahora iniciá sesión con tu usuario y contraseña.', 'login')), 650);
  }
  stepEl('otp').addEventListener('submit', e => { e.preventDefault(); verify(); });
  $('[data-lg-change]', root).addEventListener('click', () => { clearInterval(st.timer); if (st.flow === 'login') goLogin(); else show('data'); });

  const resendBtn = $('[data-lg-resend]', root);
  function startResend() {
    clearInterval(st.timer);
    st.resendAt = Date.now() + 30000;
    const upd = () => {
      const left = Math.max(0, Math.ceil((st.resendAt - Date.now()) / 1000));
      resendBtn.disabled = left > 0;
      resendBtn.textContent = left > 0 ? `Reenviar código en 0:${String(left).padStart(2, '0')}` : 'Reenviar código';
      if (!left) clearInterval(st.timer);
    };
    upd(); st.timer = setInterval(upd, 500);
  }
  resendBtn.addEventListener('click', () => {
    clearOtp(); digits[0].focus(); startResend();
    msg('Listo, te mandamos un código nuevo.', true);
  });

  /* ---------------- registro 1: datos del alumno ---------------- */
  stepEl('data').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const bad = (el, text) => { el.setAttribute('aria-invalid', 'true'); el.focus(); msg(text); };
    $$('.control', f).forEach(c => c.removeAttribute('aria-invalid'));
    if (!f.fn.value.trim()) return bad(f.fn, 'Falta tu nombre.');
    if (!f.ln.value.trim()) return bad(f.ln, 'Falta tu apellido.');
    if (!/^\d{7,8}$/.test(f.dni.value.trim())) return bad(f.dni, 'El DNI tiene 7 u 8 números, sin puntos.');
    if (!isLegajo(f.leg.value.trim())) return bad(f.leg, 'El legajo tiene entre 4 y 6 números.');
    if (f.p1.value.length < 8) return bad(f.p1, 'La contraseña necesita al menos 8 caracteres.');
    if (f.p1.value !== f.p2.value) return bad(f.p2, 'Las contraseñas no coinciden.');
    if (!f.terms.checked) return (f.terms.focus(), msg('Aceptá las condiciones para crear la cuenta.'));
    msg('');
    st.flow = 'register';
    turnTo('otp', () => { clearOtp(); startResend(); });
  });
  stepEl('data').addEventListener('input', e => { e.target.removeAttribute?.('aria-invalid'); });

  /* ---------------- final: festejo y redirección al inicio ---------------- */
  function finish(title, text, to = 'inicio') {
    $('#lg-done-title', root).textContent = title;
    $('p', stepEl('done')).textContent = text;
    show('done');
    setMood('happy');
    clearTimeout(st.leaving);
    st.leaving = setTimeout(() => {
      if (to === 'login') { location.hash = 'login'; reset(); return; }
      if (typeof setRole === 'function' && currentRole !== 'alumno') setRole('alumno');
      location.hash = 'dashboard';
      reset();
    }, 2000);
  }
  function reset() {
    cancelTurn();
    $$('form', root).forEach(f => f.reset());
    $$('.pw-toggle[aria-pressed="true"]', root).forEach(b => {
      b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Mostrar contraseña');
      b.innerHTML = '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-eye"/></svg>';
    });
    $$('.pw-wrap input', root).forEach(i => { i.type = 'password'; });
    clearOtp();
    goLogin();
  }

  /* al volver a la pantalla desde el sidebar siempre arranca limpia */
  addEventListener('hashchange', () => {
    const [screen, sub] = location.hash.slice(1).split(/[/?]/);
    if (screen !== 'login') return;
    clearTimeout(st.leaving);
    reset();
    if (sub === 'registro') goRegister();
  });
  new MutationObserver(() => { if (root.hidden) clearInterval(st.timer); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });

  goLogin();
  if (location.hash.slice(1).split(/[/?]/)[1] === 'registro') goRegister();
})();
