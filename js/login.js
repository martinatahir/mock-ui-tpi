/* =========================================================================
   LOGIN / REGISTRO (mock) — js/login.js
   · Mascota: pupilas y cabeza siguen el mouse; al tipear mira el campo;
     se tapa los ojos con la contraseña; festeja al crear la cuenta.
   · Ingresar: legajo/mail + contraseña.
   · Crear cuenta: mail o legajo → código 2FA de 6 dígitos → datos → inicio.
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

  const st = { mode: 'login', step: 'login', id: '', kind: '', timer: 0, resendAt: 0, leaving: 0 };

  /* ---------------- copy por paso ---------------- */
  const COPY = {
    login: ['Entrá a TPI 2026', 'Seguí con tu <b>legajo</b> o tu mail institucional.'],
    id: ['Creá tu cuenta', 'Empezá con tu <b>legajo</b> o tu <b>mail institucional</b>. Un solo dato.'],
    otp: ['Confirmá tu mail', () => `Te mandamos un código de 6 dígitos a <b>${maskMail(mailFor(st.id))}</b>.`],
    data: ['Completá tus datos', 'Último paso: así te armamos el perfil y te sumamos a tu cursada.'],
    done: ['', ''],
  };
  const maskMail = m => { const [u, d] = m.split('@'); return `${u[0]}${'•'.repeat(Math.max(3, u.length - 1))}@${d}`; };
  const isLegajo = v => /^\d{4,6}$/.test(v);
  const isMail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  const mailFor = v => (isLegajo(v) ? `${v}@frc.utn.edu.ar` : v);
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
    const inFlow = ['id', 'otp', 'data'].includes(step);
    $('#lg-tabs', root).hidden = step === 'done' || step === 'otp' || step === 'data';
    $('#lg-steps', root).hidden = !inFlow;
    $$('[data-lg-dot]', root).forEach(li => {
      const order = ['id', 'otp', 'data'];
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
    $$('[data-lg-mode]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lgMode === st.mode)));
    if (step !== 'done') requestAnimationFrame(() => {
      const first = $(step === 'otp' ? '.otp-d' : 'input:not([readonly])', stepEl(step));
      first?.focus({ preventScroll: true });
    });
  }
  function setMode(m) {
    st.mode = m;
    clearInterval(st.timer);
    $$('[data-lg-msg]', root).forEach(x => { x.textContent = ''; });
    setMood('idle');
    show(m === 'login' ? 'login' : 'id');
  }
  $$('[data-lg-mode]', root).forEach(b => b.addEventListener('click', () => setMode(b.dataset.lgMode)));

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
    finish('¡Hola de nuevo!', 'Entrando a tu inicio.');
  });
  stepEl('login').addEventListener('input', e => e.target.removeAttribute?.('aria-invalid'));
  $('[data-lg-forgot]', root).addEventListener('click', () => {
    setMode('register');
    msg('', true);
    showToast('Para recuperar el acceso, creá la cuenta de nuevo con tu mail: lo verificamos con un código.', 'info', 'i-key');
  });
  $('[data-lg-github]', root).addEventListener('click', () => finish('¡Conectado con GitHub!', 'Entrando a tu inicio.'));

  /* ---------------- registro 1: identificador ---------------- */
  stepEl('id').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, v = f.id.value.trim().toLowerCase();
    if (!v) return (f.id.setAttribute('aria-invalid', 'true'), msg('Escribí tu legajo o tu mail institucional.'));
    if (!isLegajo(v) && !isMail(v)) return (f.id.setAttribute('aria-invalid', 'true'), msg('Usá un legajo (4 a 6 números) o un mail completo, con @.'));
    f.id.removeAttribute('aria-invalid');
    st.id = v; st.kind = isLegajo(v) ? 'legajo' : 'mail';
    msg('');
    show('otp');
    clearOtp();
    startResend();
  });

  /* ---------------- registro 2: código de 6 dígitos ---------------- */
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
    setTimeout(() => {
      const f = stepEl('data');
      f.mail.value = mailFor(st.id);
      if (st.kind === 'legajo') { f.leg.value = st.id; f.leg.readOnly = true; } else { f.leg.value = ''; f.leg.readOnly = false; }
      show('data');
    }, 650);
  }
  stepEl('otp').addEventListener('submit', e => { e.preventDefault(); verify(); });
  $('[data-lg-change]', root).addEventListener('click', () => { clearInterval(st.timer); show('id'); });

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

  /* ---------------- registro 3: datos ---------------- */
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
    finish(`¡Bienvenido, ${f.fn.value.trim().split(/\s+/)[0]}!`, 'Cuenta creada. Te llevamos al inicio.');
  });
  stepEl('data').addEventListener('input', e => { e.target.removeAttribute?.('aria-invalid'); });

  /* ---------------- final: festejo y redirección al inicio ---------------- */
  function finish(title, text) {
    $('#lg-done-title', root).textContent = title;
    $('p', stepEl('done')).textContent = text;
    show('done');
    setMood('happy');
    clearTimeout(st.leaving);
    st.leaving = setTimeout(() => {
      if (typeof setRole === 'function' && currentRole !== 'alumno') setRole('alumno');
      location.hash = 'dashboard';
      reset();
    }, 2000);
  }
  function reset() {
    $$('form', root).forEach(f => f.reset());
    $$('.pw-toggle[aria-pressed="true"]', root).forEach(b => {
      b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Mostrar contraseña');
      b.innerHTML = '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-eye"/></svg>';
    });
    $$('.pw-wrap input', root).forEach(i => { i.type = 'password'; });
    clearOtp();
    setMode('login');
    setMood('idle');
  }

  /* al volver a la pantalla desde el sidebar siempre arranca limpia */
  addEventListener('hashchange', () => {
    if (location.hash.slice(1).split(/[/?]/)[0] === 'login') {
      clearTimeout(st.leaving);
      reset();
    }
  });
  new MutationObserver(() => { if (root.hidden) clearInterval(st.timer); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });

  setMode('login');
})();
