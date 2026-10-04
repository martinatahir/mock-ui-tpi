/* Cuestionarios docentes del mock. Persistencia local, sin contratos de servidor. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const KEY = 'tpi-teacher-quiz-draft-v1';
  const TYPES = { multiple: 'Opción múltiple', boolean: 'Verdadero / falso', open: 'Respuesta abierta' };
  const COHORTS = ['', 'ProgIV', 'InglesII', 'BDII', 'MSI'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const uid = () => crypto.randomUUID();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = name => `<svg class="icon icon-sm" aria-hidden="true"><use href="#${name}"/></svg>`;
  const toast = text => showToast(text, 'info', 'i-check');
  const blankQuestion = (type = 'multiple') => ({ id: uid(), type, text: '', multiple: false, options: type === 'multiple' ? ['', ''] : type === 'boolean' ? ['Verdadero', 'Falso'] : [], correct: [], penalty: false, points: null });
  const blankDraft = () => ({ version: 1, id: uid(), title: '', cohort: '', questions: [], editor: null });
  let draft = blankDraft();
  let storageMessage = '';
  let storageBlocked = false;
  let storageFailed = false;
  let editorSubmitted = false;
  const expanded = new Set();
  const addedFromBank = new Set();

  // Son los dos ejemplos que ya ofrecía el selector. El segundo no tenía respuestas reales.
  const bank = [
    { id: 'bank-binary', type: 'multiple', text: '¿Cuál es la complejidad de la búsqueda binaria?', multiple: false, options: ['O(log n)', 'O(n)', 'O(n log n)'], correct: [0], penalty: false, points: null },
    { id: 'bank-loop', type: 'multiple', text: '¿Qué imprime un for que recorre de 0 a n−1 sin break?', multiple: false, options: ['', ''], correct: [], penalty: false, points: null }
  ];

  function validQuestion(q) {
    return q && typeof q.id === 'string' && Object.hasOwn(TYPES, q.type) && typeof q.text === 'string'
      && typeof q.multiple === 'boolean' && typeof q.penalty === 'boolean'
      && Array.isArray(q.options) && q.options.every(o => typeof o === 'string')
      && Array.isArray(q.correct) && q.correct.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length)
      && (q.points === null || (Number.isInteger(q.points) && q.points >= 0 && q.points <= 100));
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || typeof saved.id !== 'string' || !saved.id || typeof saved.title !== 'string'
          || !COHORTS.includes(saved.cohort) || !Array.isArray(saved.questions) || !saved.questions.every(validQuestion)
          || new Set(saved.questions.map(q => q.id)).size !== saved.questions.length
          || (saved.editor !== null && (!saved.editor || !validQuestion(saved.editor.question)
            || (saved.editor.targetId !== null && !saved.questions.some(q => q.id === saved.editor.targetId))))) {
        throw new Error('invalid-draft');
      }
      draft = saved;
    }
  } catch {
    storageBlocked = true;
    storageFailed = true;
    storageMessage = 'No pudimos recuperar el borrador local. No se sobrescribió. Podés empezar otro para reemplazarlo.';
  }

  function status() {
    $$('[data-quiz-storage]').forEach(element => {
      element.textContent = storageMessage;
      element.classList.toggle('is-error', storageFailed);
    });
  }
  function persist() {
    if (storageBlocked) { status(); return false; }
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
      storageFailed = false;
      storageMessage = '';
      status();
      return true;
    } catch {
      storageFailed = true;
      storageMessage = 'No se pudo guardar en este navegador. Conservamos los cambios mientras esta página siga abierta; evitá recargarla.';
      status();
      return false;
    }
  }
  const hasWork = () => Boolean(draft.title || draft.questions.length || draft.editor);
  const quizURL = () => `#cuestionario-nuevo?tipo=teorico&cuestionario=${encodeURIComponent(draft.id)}`;
  const editorURL = target => `#cuestionario-pregunta?cuestionario=${encodeURIComponent(draft.id)}&pregunta=${encodeURIComponent(target || 'nueva')}`;
  function go(url) {
    if (location.hash === url) route(location.hash.slice(1).split('?')[0]);
    else location.hash = url;
  }

  function questionIssues(q) {
    const issues = [];
    if (!q.text.trim()) issues.push('Escribí el enunciado.');
    if (q.type === 'multiple') {
      if (q.options.length < 2 || q.options.some(option => !option.trim())) issues.push('Completá al menos dos opciones de respuesta.');
      if (!q.correct.length || (!q.multiple && q.correct.length !== 1)) issues.push(q.multiple ? 'Marcá al menos una respuesta correcta.' : 'Marcá una respuesta correcta.');
    }
    if (q.type === 'boolean' && (q.correct.length !== 1 || ![0, 1].includes(q.correct[0]))) issues.push('Elegí si la respuesta correcta es verdadero o falso.');
    return issues;
  }
  function preview(q) {
    const answers = q.type === 'boolean' ? ['Verdadero', 'Falso'] : q.options;
    return `<div class="quiz-preview"><p class="quiz-preview-caption">Vista previa · Solo lectura</p><p class="quiz-preview-prompt">${escape(q.text)}</p>${q.type === 'open'
      ? '<div class="quiz-preview-open">El alumno escribe su respuesta aquí.</div>'
      : `<p class="hint">${q.multiple ? 'Seleccioná las respuestas correctas.' : 'Seleccioná una respuesta.'}</p><ul class="quiz-preview-options">${answers.map(option => `<li><span class="quiz-answer-marker ${q.multiple ? 'is-square' : ''}" aria-hidden="true"></span><span>${escape(option || 'Opción pendiente de completar')}</span></li>`).join('')}</ul>`}</div>`;
  }
  function renderSummary() {
    const total = draft.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    const incomplete = draft.questions.filter(q => questionIssues(q).length).length;
    const noPoints = draft.questions.filter(q => !q.points).length;
    const notes = [];
    if (!draft.title.trim()) notes.push('Falta el título.');
    if (!draft.questions.length) notes.push('Agregá al menos una pregunta.');
    if (incomplete) notes.push(`${incomplete} ${incomplete === 1 ? 'pregunta necesita' : 'preguntas necesitan'} completar su contenido.`);
    if (noPoints) notes.push(`${noPoints} ${noPoints === 1 ? 'pregunta sin puntaje' : 'preguntas sin puntaje'}.`);
    if (draft.questions.length && total !== 100) notes.push(`El total debe sumar 100: ${total > 100 ? 'sobran' : 'faltan'} ${Math.abs(100 - total)} puntos.`);
    $('#sum-bar').innerHTML = `<div class="meter ${total === 100 ? 'ok' : total > 100 ? 'over' : ''}"><div class="sum-label"><span>Puntaje total</span><span class="num">${total} / 100</span></div><div class="bar" role="progressbar" aria-label="Puntaje asignado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(total, 100)}" aria-valuetext="${total} de 100 puntos"><span style="width:${Math.min(total, 100)}%"></span></div></div><div class="quiz-summary-actions"><button class="btn btn-ghost" type="button" data-quiz-even ${draft.questions.length ? '' : 'disabled'}>Repartir en partes iguales</button><button class="btn btn-primary" type="button" data-quiz-save>Guardar borrador</button></div><p class="sum-msg ${notes.length ? '' : 'ok'}" role="status">${notes.length ? `${notes.join(' ')} Podés guardar el borrador y continuar después.` : 'El cuestionario está completo. Podés conservarlo como borrador local.'}</p>`;
  }
  function renderList() {
    $('#quiz-title').value = draft.title;
    $('#quiz-question-count').textContent = `(${draft.questions.length})`;
    $('#quiz-pending-question').hidden = !draft.editor;
    $('#quiz-pending-question').innerHTML = draft.editor ? `<div class="quiz-pending-context"><span class="quiz-pending-symbol">${icon('i-file')}</span><div><strong>Tenés una pregunta en edición</strong><p>Su contenido todavía no se incorporó al cuestionario.</p></div></div><button class="btn btn-ghost" type="button" data-quiz-resume-editor>Continuar editando${icon('i-right')}</button>` : '';
    $('#q-list').innerHTML = draft.questions.map((q, index) => `<article class="quiz-question" data-question-id="${escape(q.id)}">
      <div class="quiz-question-row">
        <span class="quiz-question-number">${String(index + 1).padStart(2, '0')}</span>
        <div class="quiz-question-info"><h3>${escape(q.text || 'Pregunta sin enunciado')}</h3><p>${escape(TYPES[q.type])}${q.type === 'open' ? ' · Corrección manual' : q.type === 'multiple' ? ` · ${q.multiple ? 'Varias correctas' : 'Una correcta'}` : ''}${questionIssues(q).length ? ' · Contenido pendiente' : ''}</p>
          <details class="quiz-question-preview" ${expanded.has(q.id) ? 'open' : ''}><summary>Vista previa</summary>${preview(q)}</details>
        </div>
        <div class="quiz-question-controls">
          <label class="quiz-question-points">Puntaje<input class="control num" type="number" min="0" max="100" step="1" value="${q.points ?? ''}" placeholder="0" data-quiz-points aria-label="Puntaje de la pregunta ${index + 1}" /></label>
          <div class="quiz-question-actions"><button class="icon-btn sm" type="button" data-quiz-edit title="Editar pregunta" aria-label="Editar pregunta ${index + 1}">${icon('i-pencil')}</button><button class="icon-btn sm" type="button" data-quiz-remove title="Quitar pregunta" aria-label="Quitar pregunta ${index + 1}">${icon('i-trash')}</button></div>
        </div>
      </div></article>`).join('') || `<div class="quiz-empty">
        <svg class="quiz-empty-landscape" viewBox="0 0 160 96" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M0 88h8v-8h8v-8h8v-8h8v-8h8v8h8v8h8v8h8V64h8V48h8V32h8v16h8v16h8v16h8v-8h8V56h8v16h8v8h8v8h8v8H0Z" fill="currentColor"/><path d="M16 20h8v-8h8V4h8v8h8v8h8v4H16Z" fill="currentColor"/></svg>
        <svg class="quiz-empty-landscape is-right" viewBox="0 0 160 96" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M0 88h8v-8h8v-8h8V56h8v16h8v8h8V64h8V48h8V24h8v16h8v16h8v16h8v8h8v-8h8V56h8V40h8v16h8v16h8v8h8v8h8v8H0Z" fill="currentColor"/><path d="M104 16h8V8h8V0h8v8h8v8h8v4h-40Z" fill="currentColor"/></svg>
        <svg class="quiz-empty-art" viewBox="0 0 192 112" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
          <g fill="var(--accent-secondary)" opacity=".55"><path d="M42 28h4v4h-4zM144 8h4v4h-4zM160 56h4v4h-4zM32 72h4v4h-4z"/><path d="M152 28h4v-4h4v4h4v4h-4v4h-4v-4h-4z"/></g>
          <path d="M28 48h4v-4h4v4h4v4h-4v4h-4v-4h-4zM160 76h4v-4h4v4h4v4h-4v4h-4v-4h-4z" fill="var(--accent-gold)" opacity=".8"/>
          <path d="M48 56V28h44v4H52v24h20v4H48Z" fill="var(--accent-primary)" opacity=".6"/>
          <path d="M56 36h28v16H56z" fill="var(--accent-primary)" opacity=".08"/>
          <path d="M60 72h72v32H60z" fill="var(--accent-primary)" opacity=".08"/>
          <path d="M56 68h80v40H56V68h4v36h72V72H60v-4Z" fill="var(--accent-primary)" opacity=".75"/>
          <path d="M60 72h16v32H60z" fill="var(--accent-secondary)" opacity=".22"/>
          <path d="M76 72h4v32h-4zM60 80h72v4H60z" fill="var(--accent-primary)" opacity=".4"/>
          <path d="M100 72h12v12h-12z" fill="var(--accent-gold)"/><path d="M104 72h4v8h-4z" fill="var(--bg-surface)"/>
          <path d="M96 0h28v4h8v8h4v16h-4v8h-8v8h-8v12h-16V40h8v-8h12V16H96v8H80V12h4V4h12Z" fill="var(--accent-secondary)" opacity=".16"/>
          <path d="M96 4h28v4h4v4h4v16h-4v4h-8v8h-8v8h-8V36h8v-8h12V16h-4v-4H96v4h-4v8h-8V12h4V8h8Z" fill="var(--accent-secondary)"/>
          <path d="M96 8h24v4H96zM88 12h4v8h-4z" fill="var(--text-primary)" opacity=".75"/>
          <path d="M104 56h8v8h-8z" fill="var(--accent-secondary)"/>
        </svg>
        <h3>Tu cuestionario está vacío</h3>
        <p>Comenzá agregando preguntas desde tu banco o creá preguntas nuevas.<br />Podés combinarlas y asignar hasta 100 puntos en total.</p>
      </div>`;
    $$('.quiz-question-preview').forEach(details => details.addEventListener('toggle', () => {
      const id = details.closest('[data-question-id]').dataset.questionId;
      if (details.open) expanded.add(id); else expanded.delete(id);
    }));
    renderSummary();
    status();
  }

  function beginQuestion(targetId = null) {
    if (draft.editor && draft.editor.targetId === targetId) { go(editorURL(targetId)); return; }
    if (draft.editor && !confirm('Hay otra pregunta en edición. ¿Descartar esa edición para abrir esta pregunta?')) return;
    const original = targetId ? draft.questions.find(q => q.id === targetId) : null;
    if (targetId && !original) return;
    draft.editor = { targetId, question: original ? copy(original) : blankQuestion() };
    editorSubmitted = false;
    persist();
    go(editorURL(targetId));
  }
  function editorErrors() {
    const issues = editorSubmitted ? questionIssues(draft.editor.question) : [];
    $('#quiz-editor-errors').hidden = !issues.length;
    $('#quiz-editor-errors').innerHTML = issues.length ? `<p>Revisá la pregunta antes de agregarla:</p><ul>${issues.map(issue => `<li>${escape(issue)}</li>`).join('')}</ul>` : '';
    $('#quiz-question-text').setAttribute('aria-invalid', String(editorSubmitted && !draft.editor.question.text.trim()));
    return issues;
  }
  function renderSpecific() {
    const q = draft.editor.question;
    $('#quiz-question-specific').innerHTML = q.type === 'open'
      ? '<div class="quiz-manual-note"><h2>Respuesta abierta</h2><p>El alumno responderá con texto. La corrección será manual por parte del docente.</p></div>'
      : q.type === 'boolean'
        ? `<fieldset class="quiz-correct-options"><legend>Respuesta correcta</legend><p class="hint">Elegí cuál de las dos respuestas es correcta.</p><div class="quiz-boolean-options">${['Verdadero', 'Falso'].map((text, index) => `<label><input type="radio" name="quiz-boolean" value="${index}" ${q.correct.includes(index) ? 'checked' : ''} />${text}</label>`).join('')}</div></fieldset>`
        : `<div class="quiz-multiple-settings"><label class="field">Respuestas correctas<select class="control" id="quiz-multiple-mode"><option value="single" ${!q.multiple ? 'selected' : ''}>Una correcta</option><option value="multiple" ${q.multiple ? 'selected' : ''}>Varias correctas</option></select></label><label class="switch-label quiz-penalty-switch"><span class="switch-toggle"><input type="checkbox" role="switch" id="quiz-penalty" ${q.penalty ? 'checked' : ''}/><span class="switch-track" aria-hidden="true"></span></span><span>Resta si elige una incorrecta</span></label></div>
          <fieldset class="quiz-correct-options"><legend>Opciones de respuesta</legend><p class="hint">Completá las opciones y marcá ${q.multiple ? 'las respuestas correctas' : 'la respuesta correcta'}. Se requieren al menos dos opciones.</p><div class="quiz-option-list">${q.options.map((option, index) => `<div class="quiz-option-row"><label class="quiz-correct-pick"><input type="${q.multiple ? 'checkbox' : 'radio'}" name="quiz-correct" value="${index}" ${q.correct.includes(index) ? 'checked' : ''} aria-label="Marcar opción ${index + 1} como correcta"/><span>Correcta</span></label><label class="field"><span class="sr-only">Opción ${index + 1}</span><input class="control" data-quiz-option="${index}" maxlength="1000" value="${escape(option)}" placeholder="Opción ${index + 1}" /></label><button class="icon-btn sm" type="button" data-quiz-delete-option="${index}" aria-label="Quitar opción ${index + 1}" title="Quitar opción" ${q.options.length <= 2 ? 'disabled' : ''}>${icon('i-x')}</button></div>`).join('')}</div><button class="btn btn-ghost" type="button" data-quiz-add-option>${icon('i-plus')}Agregar opción</button></fieldset>`;
    editorErrors();
  }
  function renderEditor() {
    const editor = draft.editor;
    const title = editor.targetId ? 'Editar pregunta' : 'Crear pregunta';
    $('#quiz-editor-title').textContent = title;
    $('#quiz-editor-crumb').textContent = title;
    $('#quiz-editor-context').textContent = `Para: ${draft.title.trim() || 'Cuestionario sin título'}`;
    $$('[data-quiz-return]').forEach(a => a.href = quizURL());
    $('#quiz-question-type').value = editor.question.type;
    $('#quiz-question-text').value = editor.question.text;
    $('#quiz-add-another').hidden = Boolean(editor.targetId);
    $('#quiz-add-return').textContent = editor.targetId ? 'Guardar cambios' : 'Agregar y volver';
    renderSpecific();
    status();
  }
  function route(screen) {
    if (!['cuestionario-nuevo', 'cuestionario-pregunta'].includes(screen)) {
      if ($('#quiz-bank-dialog').open) $('#quiz-bank-dialog').close();
      return;
    }
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const requestedDraft = params.get('cuestionario');
    if (screen === 'cuestionario-nuevo') {
      const resume = storageBlocked || (!requestedDraft && hasWork()) || (requestedDraft && requestedDraft !== draft.id);
      $('#quiz-resume').hidden = !resume;
      $('#quiz-workspace').hidden = Boolean(resume);
      $('#quiz-resume-title').textContent = storageBlocked ? 'No pudimos recuperar tu borrador' : requestedDraft && requestedDraft !== draft.id ? 'Este enlace corresponde a otro borrador' : 'Tenés un cuestionario en curso';
      $('#quiz-resume-description').textContent = storageBlocked ? 'El contenido guardado no fue reemplazado. Podés empezar otro cuestionario.' : `${draft.title.trim() || 'Cuestionario sin título'} · ${draft.questions.length} preguntas${draft.editor ? ' · Una pregunta en edición' : ''}`;
      $('[data-quiz-resume]').hidden = storageBlocked;
      if (!resume) {
        history.replaceState(history.state, '', quizURL());
        renderList();
        requestAnimationFrame(() => $('#h-build').focus({ preventScroll: true }));
      }
      status();
      return;
    }
    const questionId = params.get('pregunta');
    const targetId = questionId === 'nueva' ? null : questionId;
    const unavailable = storageBlocked || requestedDraft !== draft.id || !questionId || (targetId && !draft.questions.some(q => q.id === targetId));
    $$('[data-quiz-return]').forEach(a => a.href = quizURL());
    $('#quiz-editor-unavailable').hidden = !unavailable;
    $('#quiz-question-form').hidden = Boolean(unavailable);
    if (unavailable) { status(); return; }
    if (draft.editor && draft.editor.targetId !== targetId) {
      // Una navegación directa no debe pisar silenciosamente una edición pendiente.
      history.replaceState(history.state, '', editorURL(draft.editor.targetId));
      toast('Retomamos la pregunta que tenías en edición.');
    } else if (!draft.editor) {
      draft.editor = { targetId, question: targetId ? copy(draft.questions.find(q => q.id === targetId)) : blankQuestion() };
      persist();
    }
    editorSubmitted = false;
    renderEditor();
    requestAnimationFrame(() => $('#quiz-editor-title').focus({ preventScroll: true }));
  }

  function openBank() {
    addedFromBank.clear();
    $('#quiz-bank-search').value = '';
    renderBank();
    $('#quiz-bank-dialog').showModal();
    $('#quiz-bank-search').focus();
  }
  function renderBank() {
    const search = $('#quiz-bank-search').value.trim().toLocaleLowerCase('es');
    const found = bank.filter(q => q.text.toLocaleLowerCase('es').includes(search));
    $('#quiz-bank-results').innerHTML = found.map(q => `<article class="quiz-bank-item"><h3>${escape(q.text)}</h3><p class="hint">${TYPES[q.type]} · Ejemplo del mock</p>${questionIssues(q).length ? '<p class="quiz-bank-warning">Este ejemplo no tiene opciones y respuesta correcta completas. Deberás completarlas después de incorporarlo.</p>' : ''}<details><summary>Vista previa</summary>${preview(q)}</details><button class="btn btn-ghost" type="button" data-quiz-bank-add="${q.id}" ${addedFromBank.has(q.id) ? 'disabled' : ''}>${addedFromBank.has(q.id) ? 'Agregada al cuestionario' : 'Agregar al cuestionario'}</button></article>`).join('') || '<p class="quiz-bank-empty">No hay preguntas que coincidan con la búsqueda.</p>';
  }
  $('#quiz-bank-search').addEventListener('input', renderBank);
  $('#quiz-bank-dialog').addEventListener('click', event => {
    if (event.target.closest('[data-quiz-bank-close]')) $('#quiz-bank-dialog').close();
    const button = event.target.closest('[data-quiz-bank-add]');
    if (!button) return;
    const source = bank.find(q => q.id === button.dataset.quizBankAdd);
    if (!source || addedFromBank.has(source.id)) return;
    draft.questions.push({ ...copy(source), id: uid() });
    addedFromBank.add(source.id);
    persist(); renderList(); renderBank();
    toast('Pregunta incorporada al cuestionario.');
  });
  $('#screen-cuestionario-nuevo-profesor').addEventListener('click', event => {
    if (event.target.closest('[data-quiz-resume]')) { go(quizURL()); return; }
    if (event.target.closest('[data-quiz-new]')) {
      if (!confirm('¿Empezar otro cuestionario? Se reemplazará el borrador local y su pregunta en edición.')) return;
      draft = blankDraft(); storageBlocked = false; expanded.clear(); persist(); go(quizURL()); return;
    }
    if (event.target.closest('[data-quiz-create]')) { beginQuestion(); return; }
    if (event.target.closest('[data-quiz-resume-editor]')) { go(editorURL(draft.editor.targetId)); return; }
    if (event.target.closest('[data-quiz-bank]')) { openBank(); return; }
    if (event.target.closest('[data-quiz-save]')) {
      const invalid = document.querySelector('[data-quiz-points]:invalid');
      if (invalid) { invalid.focus(); invalid.reportValidity(); return; }
      if (persist()) toast('Borrador guardado localmente.');
      return;
    }
    if (event.target.closest('[data-quiz-even]') && draft.questions.length) {
      const base = Math.floor(100 / draft.questions.length);
      draft.questions.forEach((q, i) => q.points = base + (i < 100 % draft.questions.length ? 1 : 0));
      persist(); renderList(); return;
    }
    const row = event.target.closest('[data-question-id]');
    if (!row) return;
    const id = row.dataset.questionId;
    if (event.target.closest('[data-quiz-edit]')) beginQuestion(id);
    if (event.target.closest('[data-quiz-remove]') && confirm('¿Quitar esta pregunta del cuestionario?')) {
      draft.questions = draft.questions.filter(q => q.id !== id);
      if (draft.editor?.targetId === id) draft.editor = null;
      expanded.delete(id); persist(); renderList();
    }
  });
  $('#screen-cuestionario-nuevo-profesor').addEventListener('input', event => {
    if (event.target.id === 'quiz-title') draft.title = event.target.value;
    else if (event.target.matches('[data-quiz-points]')) {
      event.target.setAttribute('aria-invalid', String(!event.target.validity.valid));
      return;
    } else return;
    persist(); renderSummary();
  });
  $('#q-list').addEventListener('change', event => {
    if (!event.target.matches('[data-quiz-points]')) return;
    const input = event.target;
    const q = draft.questions.find(q => q.id === input.closest('[data-question-id]').dataset.questionId);
    if (!input.validity.valid) {
      input.value = q.points ?? '';
      input.removeAttribute('aria-invalid');
      toast('Ingresá un puntaje entero entre 0 y 100. Se conservó el valor anterior.');
      return;
    }
    q.points = input.value === '' ? null : Number(input.value);
    input.removeAttribute('aria-invalid');
    persist(); renderSummary();
  });
  $('#quiz-question-form').addEventListener('input', event => {
    if (!draft.editor) return;
    const q = draft.editor.question;
    if (event.target.id === 'quiz-question-text') q.text = event.target.value;
    else if (event.target.hasAttribute('data-quiz-option')) q.options[Number(event.target.dataset.quizOption)] = event.target.value;
    else return;
    persist(); editorErrors();
  });
  $('#quiz-question-form').addEventListener('change', event => {
    if (!draft.editor) return;
    const q = draft.editor.question;
    if (event.target.id === 'quiz-question-type') {
      const nextType = event.target.value;
      const hasAnswers = q.options.some(option => option.trim()) || q.correct.length || q.penalty;
      if (hasAnswers && !confirm('Al cambiar el tipo se descartan las opciones y respuestas configuradas. El enunciado se conserva. ¿Continuar?')) {
        event.target.value = q.type; return;
      }
      draft.editor.question = { ...blankQuestion(nextType), id: q.id, text: q.text, points: q.points };
      renderSpecific();
    } else if (event.target.id === 'quiz-multiple-mode') {
      q.multiple = event.target.value === 'multiple';
      if (!q.multiple) q.correct = q.correct.slice(0, 1);
      renderSpecific();
      $('#quiz-multiple-mode').focus();
    } else if (event.target.id === 'quiz-penalty') q.penalty = event.target.checked;
    else if (['quiz-correct', 'quiz-boolean'].includes(event.target.name)) {
      const index = Number(event.target.value);
      q.correct = q.multiple ? (event.target.checked ? [...new Set([...q.correct, index])] : q.correct.filter(i => i !== index)) : [index];
    } else return;
    persist(); editorErrors();
  });
  $('#quiz-question-form').addEventListener('click', event => {
    if (!draft.editor) return;
    const q = draft.editor.question;
    if (event.target.closest('[data-quiz-cancel]')) {
      if (!confirm('¿Descartar esta edición y volver al cuestionario?')) return;
      draft.editor = null; persist(); go(quizURL()); return;
    }
    if (event.target.closest('[data-quiz-add-option]')) {
      q.options.push(''); persist(); renderSpecific();
      $(`[data-quiz-option="${q.options.length - 1}"]`).focus();
    }
    const remove = event.target.closest('[data-quiz-delete-option]');
    if (remove && q.options.length > 2) {
      const index = Number(remove.dataset.quizDeleteOption);
      q.options.splice(index, 1);
      q.correct = q.correct.filter(i => i !== index).map(i => i > index ? i - 1 : i);
      persist(); renderSpecific();
      $(`[data-quiz-option="${Math.min(index, q.options.length - 1)}"]`).focus();
    }
  });
  $('#quiz-question-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!draft.editor) return;
    editorSubmitted = true;
    if (editorErrors().length) {
      const target = !draft.editor.question.text.trim() ? $('#quiz-question-text')
        : [...document.querySelectorAll('[data-quiz-option]')].find(input => !input.value.trim())
          || document.querySelector('[name="quiz-correct"], [name="quiz-boolean"]');
      target?.focus();
      return;
    }
    const editor = draft.editor;
    const q = copy(editor.question);
    if (editor.targetId) {
      const index = draft.questions.findIndex(item => item.id === editor.targetId);
      if (index < 0) return;
      // El puntaje pertenece al cuestionario, no a la copia temporal del editor.
      q.points = draft.questions[index].points;
      draft.questions[index] = q;
    } else draft.questions.push(q);
    const another = !editor.targetId && event.submitter?.value === 'another';
    draft.editor = another ? { targetId: null, question: blankQuestion(q.type) } : null;
    persist(); editorSubmitted = false;
    if (another) {
      renderEditor(); $('#quiz-question-text').focus(); toast('Pregunta agregada. Podés crear la siguiente.');
    } else { go(quizURL()); toast(editor.targetId ? 'Cambios incorporados al cuestionario.' : 'Pregunta agregada al cuestionario.'); }
  });
  window.TeacherQuiz = { route };
  route(location.hash.slice(1).split('?')[0]);
})();
