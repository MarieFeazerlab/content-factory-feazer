/* ============================================================
   CONTENT FACTORY FEAZER — App
   ============================================================ */

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────
const PASSWORD = 'Feazercontent2026!?!?';
const SESSION_KEY = 'cf_feazer_auth';

const PILIERS = {
  P1: { label: 'Autorité' },
  P2: { label: 'Démonstration' },
  P3: { label: 'Culture / Différenciation' },
  P4: { label: 'IA for Creative' },
};

// 3 calendar slots = Lundi / Mercredi / Vendredi (fixed days)
const SLOTS = [
  { dayName: 'Lundi',    dayOffset: 0 },
  { dayName: 'Mercredi', dayOffset: 2 },
  { dayName: 'Vendredi', dayOffset: 4 },
];

// 3-week rotation — P4 fixe sur Vendredi, P1/P2/P3 tournent par paires sur Lundi+Mercredi
const WEEK_ROTATION = [
  ['P1', 'P2', 'P4'],  // semaine 1 — Lundi=P1, Mercredi=P2, Vendredi=P4
  ['P1', 'P3', 'P4'],  // semaine 2 — Lundi=P1, Mercredi=P3, Vendredi=P4
  ['P2', 'P3', 'P4'],  // semaine 3 — Lundi=P2, Mercredi=P3, Vendredi=P4
];

function getISOWeekNumber(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function getWeekPiliers(semaine) {
  return WEEK_ROTATION[(getISOWeekNumber(semaine) - 1) % 3];
}

const PILIER_LABELS_DETAIL = {
  P1: 'Autorité',
  P2: 'Démonstration',
  P3: 'Culture / Différenciation',
  P4: 'IA for Creative',
};

const STATUS_CYCLE = ['Brouillon', 'Prêt à publier', 'Publié'];

const PROFILE_LABELS = {
  feazer: 'Page Feazer',
  marie:  'Marie',
  maxime: 'Maxime',
};

const MONTHS_FR = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre'
];

// Category config for sources page
const SOURCE_CATEGORIES = [
  { slug: 'crea',        name: 'Créa / Design' },
  { slug: 'mktfr',       name: 'Marketing / Data FR' },
  { slug: 'mktglobal',   name: 'Marketing / Data Global' },
  { slug: 'feazer-src',  name: 'Feazer' },
  { slug: 'ia-creative', name: 'IA for Creative' },
];

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
const state = {
  weekStart:   getWeekStart(new Date()),
  profile:     'feazer',
  currentCard: null,
  loadingBar:  null,
  cardCache:   {},
  weekPiliers: [],  // active piliers for the displayed week [P1/P2/P3/P4]
};

// ──────────────────────────────────────────────
// UTILS — DATES
// ──────────────────────────────────────────────
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(date) {
  const d = new Date(date);
  return `Semaine du ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateFull(date) {
  const d = new Date(date);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// ──────────────────────────────────────────────
// UTILS — PILIER CODE
// Extract short code (P1 / P2 / P3) from any pilier representation
// ──────────────────────────────────────────────
function pilierCode(p) {
  const m = String(p || '').match(/^P[123]/);
  return m ? m[0] : String(p || '');
}

// ──────────────────────────────────────────────
// UTILS — MISC
// ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function getHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// ──────────────────────────────────────────────
// UTILS — LOADING BAR
// ──────────────────────────────────────────────
function startLoadingBar() {
  const bar = document.getElementById('loading-bar');
  bar.classList.remove('hidden');
  let progress = 0;
  bar.style.width = '0%';
  state.loadingBar = setInterval(() => {
    progress += (90 - progress) * 0.04 + Math.random() * 1.5;
    if (progress > 89) progress = 89;
    bar.style.width = `${progress}%`;
  }, 120);
}

function stopLoadingBar() {
  clearInterval(state.loadingBar);
  const bar = document.getElementById('loading-bar');
  bar.style.width = '100%';
  setTimeout(() => {
    bar.classList.add('hidden');
    bar.style.width = '0%';
  }, 350);
}

// ──────────────────────────────────────────────
// UTILS — TOAST
// ──────────────────────────────────────────────
function toast(message, type = '') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ──────────────────────────────────────────────
// UTILS — API CALL
// ──────────────────────────────────────────────
async function api(endpoint, body) {
  const res = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

async function airtableGet(table, filter = '') {
  return api('airtable', { action: 'list', table, filter });
}

async function airtableCreate(table, fields) {
  return api('airtable', { action: 'create', table, fields });
}

async function airtableUpdate(table, recordId, fields) {
  return api('airtable', { action: 'update', table, recordId, fields });
}

async function airtableDelete(table, recordId) {
  return api('airtable', { action: 'delete', table, recordId });
}

// ──────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────
function checkAuth() {
  return localStorage.getItem(SESSION_KEY) === 'ok';
}

function login(password) {
  if (password === PASSWORD) {
    localStorage.setItem(SESSION_KEY, 'ok');
    return true;
  }
  return false;
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('password-input').value = '';
}

// ──────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('page-active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('page-active');
  document.querySelector(`.nav-tab[data-page="${page}"]`).classList.add('active');
  if (page === 'sources') loadSourcesPage();
}

// ──────────────────────────────────────────────
// CALENDAR — WEEK NAVIGATION
// ──────────────────────────────────────────────
function renderWeekHeader() {
  document.getElementById('week-label').textContent = formatWeekLabel(state.weekStart);
  state.weekPiliers = getWeekPiliers(toISODate(state.weekStart));
  state.weekPiliers.forEach((pilier, i) => {
    const date = addDays(state.weekStart, SLOTS[i].dayOffset);
    document.getElementById(`date-col-${i}`).textContent = formatDateFull(date);
    const badge = document.getElementById(`pilier-col-${i}`);
    badge.className = `pilier-badge pilier-${pilier.toLowerCase()}`;
    badge.textContent = `${pilier} — ${PILIERS[pilier].label}`;
  });
}

// ──────────────────────────────────────────────
// CALENDAR — LOAD CARDS
// ──────────────────────────────────────────────
async function loadCalendarCards() {
  const semaine = toISODate(state.weekStart);
  const profil  = PROFILE_LABELS[state.profile];

  state.weekPiliers.forEach((p, i) => {
    document.getElementById(`cards-col-${i}`).innerHTML =
      '<div class="col-empty-state"><p>Chargement…</p></div>';
  });

  try {
    const filter = `AND({Date de publication}='${semaine}',{Mode de publication}='${profil}')`;
    const result = await airtableGet('Calendrier éditorial', filter);
    const records = result.records || [];

    const byPilier = {};
    state.weekPiliers.forEach(p => { byPilier[p] = []; });
    records.forEach(r => {
      const p = pilierCode(r.fields.Pilier);
      if (p in byPilier) byPilier[p].push(r);
    });

    state.weekPiliers.forEach((p, i) => renderPilierCards(p, i, byPilier[p]));
  } catch (err) {
    state.weekPiliers.forEach((p, i) => {
      document.getElementById(`cards-col-${i}`).innerHTML =
        `<div class="col-empty-state"><p>Erreur de chargement.<br>${err.message}</p></div>`;
    });
  }
}

function renderPilierCards(pilier, slotIndex, records) {
  const container = document.getElementById(`cards-col-${slotIndex}`);
  if (!records || records.length === 0) {
    container.innerHTML = `
      <div class="col-empty-state">
        <p>Aucune idée générée.<br>Cliquez sur "Générer la semaine".</p>
      </div>`;
    return;
  }
  records.forEach(r => { state.cardCache[r.id] = r.fields; });
  container.innerHTML = records.map(r => cardHTML(r, slotIndex)).join('');
}

function cardHTML(record, slotIndex) {
  const f = record.fields;
  const pCode = pilierCode(f.Pilier);
  const statusClass = {
    'Brouillon':      'status-brouillon',
    'Prêt à publier': 'status-pret',
    'Publié':         'status-publie',
  }[f.Statut] || 'status-brouillon';

  return `
    <div class="idea-card" data-id="${record.id}" data-pilier="${pCode}" data-slot="${slotIndex}">
      <div class="card-top-row">
        <span class="format-badge">${escHtml(f.Format || 'Texte long')}</span>
        <div class="card-actions-row">
          <button class="btn-write" onclick="openWriteModal('${record.id}')">Écrire ↗</button>
          <button class="btn-remove" title="Retirer" onclick="removeCard('${record.id}')">×</button>
        </div>
      </div>
      <div class="card-title">${escHtml(f['Titre / idée'] || '')}</div>
      ${f['Hook suggéré'] ? `<div class="card-hook">${escHtml(f['Hook suggéré'])}</div>` : ''}
      <div class="card-bottom-row">
        <span class="card-source">${escHtml(f.Source || '')}</span>
        <span class="status-badge ${statusClass}" onclick="cycleStatus('${record.id}','${escHtml(f.Statut || 'Brouillon')}','${pCode}')">${escHtml(f.Statut || 'Brouillon')}</span>
      </div>
    </div>`;
}

// ──────────────────────────────────────────────
// CALENDAR — STATUS CYCLE
// ──────────────────────────────────────────────
async function cycleStatus(recordId, currentStatus, pilier) {
  const idx = STATUS_CYCLE.indexOf(currentStatus);
  const newStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];

  try {
    await airtableUpdate('Calendrier éditorial', recordId, { Statut: newStatus });
    const card = document.querySelector(`.idea-card[data-id="${recordId}"]`);
    if (card) {
      const badge = card.querySelector('.status-badge');
      badge.className = 'status-badge ' + {
        'Brouillon':      'status-brouillon',
        'Prêt à publier': 'status-pret',
        'Publié':         'status-publie',
      }[newStatus];
      badge.textContent = newStatus;
      badge.setAttribute('onclick', `cycleStatus('${recordId}','${newStatus}','${pilier}')`);
    }
  } catch {
    toast('Erreur lors de la mise à jour du statut.', 'error');
  }
}

// ──────────────────────────────────────────────
// CALENDAR — REMOVE CARD
// ──────────────────────────────────────────────
async function removeCard(recordId) {
  if (!confirm('Retirer cette idée ?')) return;
  try {
    await airtableDelete('Calendrier éditorial', recordId);
    const card = document.querySelector(`.idea-card[data-id="${recordId}"]`);
    if (card) {
      const slotIndex = card.dataset.slot;
      card.style.transition = 'opacity 0.2s';
      card.style.opacity = '0';
      setTimeout(() => {
        card.remove();
        const container = document.getElementById(`cards-col-${slotIndex}`);
        if (container && !container.querySelector('.idea-card')) {
          container.innerHTML = `<div class="col-empty-state"><p>Aucune idée générée.<br>Cliquez sur "Générer la semaine".</p></div>`;
        }
      }, 200);
    }
  } catch {
    toast('Erreur lors de la suppression.', 'error');
  }
}

// ──────────────────────────────────────────────
// CALENDAR — GENERATE WEEK
// ──────────────────────────────────────────────
async function generateWeek() {
  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.textContent = 'Génération…';
  startLoadingBar();

  const semaine = toISODate(state.weekStart);
  const profil  = state.profile;

  try {
    for (let i = 0; i < state.weekPiliers.length; i++) {
      const pilier = state.weekPiliers[i];
      const slot   = SLOTS[i];
      document.getElementById(`cards-col-${i}`).innerHTML =
        '<div class="col-empty-state"><p>Génération en cours…</p></div>';
      try {
        const result = await api('generate', {
          pilier,
          pilierLabel: PILIERS[pilier].label,
          semaine,
          profil,
          profilLabel: PROFILE_LABELS[profil],
          jour:        slot.dayName,
        });
        if (result.idees) {
          renderPilierCards(pilier, i, result.idees.map(idee => ({
            id: idee.recordId,
            fields: {
              'Titre / idée':        idee.titre,
              'Hook suggéré':        idee.hook,
              Format:                idee.format,
              Source:                idee.source,
              Statut:                'Brouillon',
              Pilier:                pilier,
              'Mode de publication': PROFILE_LABELS[profil],
            },
          })));
        }
      } catch (err) {
        document.getElementById(`cards-col-${i}`).innerHTML =
          `<div class="col-empty-state"><p>Erreur : ${escHtml(err.message)}</p></div>`;
      }
    }
    toast('Semaine générée avec succès !', 'success');
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
  } finally {
    stopLoadingBar();
    btn.disabled = false;
    btn.textContent = 'Générer la semaine ↗';
  }
}

// ──────────────────────────────────────────────
// WRITE MODAL
// ──────────────────────────────────────────────
async function openWriteModal(recordId) {
  const cached = state.cardCache[recordId] || {};
  const domCard = document.querySelector(`.idea-card[data-id="${recordId}"]`);

  const fields = {
    'Titre / idée': cached['Titre / idée'] || domCard?.querySelector('.card-title')?.textContent  || '',
    'Hook suggéré': cached['Hook suggéré'] || domCard?.querySelector('.card-hook')?.textContent   || '',
    Format:         cached.Format          || domCard?.querySelector('.format-badge')?.textContent || '',
    Source:         cached.Source          || domCard?.querySelector('.card-source')?.textContent  || '',
    Pilier:         cached.Pilier          || domCard?.dataset.pilier || 'P1',
    recordId,
  };

  state.currentCard = fields;

  document.getElementById('write-title').value = fields['Titre / idée'];

  const pCode = pilierCode(fields.Pilier);
  document.getElementById('write-pilier-display').innerHTML =
    `<span class="pilier-badge pilier-${pCode.toLowerCase()}">${pCode} — ${PILIERS[pCode]?.label || ''}</span>`;

  document.getElementById('write-format-display').innerHTML =
    `<span class="format-badge">${escHtml(fields.Format)}</span>`;

  const hookGroup = document.getElementById('write-hook-group');
  if (fields['Hook suggéré']) {
    hookGroup.style.display = '';
    document.getElementById('write-hook-display').textContent = fields['Hook suggéré'];
  } else {
    hookGroup.style.display = 'none';
  }

  document.getElementById('post-output-group').classList.add('hidden');
  document.getElementById('post-content').value = '';
  document.getElementById('char-count').textContent = '0 / 3000 caractères';
  document.getElementById('char-count').classList.remove('over');
  const genBtn = document.getElementById('generate-post-btn');
  genBtn.textContent = 'Générer le post ↗';
  genBtn.disabled = false;
  genBtn.classList.remove('btn-loading');

  document.getElementById('write-modal').classList.remove('hidden');
}

function closeWriteModal() {
  document.getElementById('write-modal').classList.add('hidden');
  state.currentCard = null;
}

// ──────────────────────────────────────────────
// CARD DETAIL MODAL
// ──────────────────────────────────────────────
function openCardDetail(recordId) {
  const f = state.cardCache[recordId];
  if (!f) return;

  document.getElementById('card-detail-title').textContent = f['Titre / idée'] || 'Détail de l\'idée';

  const pCode = pilierCode(f.Pilier);
  const pilierClass = { P1: 'pilier-p1', P2: 'pilier-p2', P3: 'pilier-p3' }[pCode] || '';

  document.getElementById('card-detail-body').innerHTML = `
    <div class="card-detail-fields">
      <div class="card-detail-field">
        <span class="card-detail-label">Pilier</span>
        <div><span class="pilier-badge ${pilierClass}">${escHtml(pCode)} — ${escHtml(PILIER_LABELS_DETAIL[pCode] || '')}</span></div>
      </div>
      <div class="card-detail-field">
        <span class="card-detail-label">Format</span>
        <div><span class="format-badge">${escHtml(f.Format || 'Texte long')}</span></div>
      </div>
      ${f['Hook suggéré'] ? `
      <div class="card-detail-field">
        <span class="card-detail-label">Hook suggéré</span>
        <div class="hook-display">${escHtml(f['Hook suggéré'])}</div>
      </div>` : ''}
      ${f.Citation ? `
      <div class="card-detail-field">
        <span class="card-detail-label">Citation</span>
        <div class="card-detail-citation">${escHtml(f.Citation)}</div>
      </div>` : ''}
      ${f.Source ? `
      <div class="card-detail-field">
        <span class="card-detail-label">Source</span>
        <span class="card-detail-value">${escHtml(f.Source)}</span>
      </div>` : ''}
    </div>`;

  document.getElementById('card-detail-write-btn').onclick = () => {
    closeCardDetail();
    openWriteModal(recordId);
  };

  document.getElementById('card-detail-modal').classList.remove('hidden');
}

function closeCardDetail() {
  document.getElementById('card-detail-modal').classList.add('hidden');
}

// ──────────────────────────────────────────────
// GENERATE POST
// ──────────────────────────────────────────────
async function generatePost() {
  if (!state.currentCard) return;
  const btn = document.getElementById('generate-post-btn');
  btn.classList.add('btn-loading');
  btn.disabled = true;
  startLoadingBar();

  try {
    const result = await api('write', {
      titre:       state.currentCard['Titre / idée'],
      hook:        state.currentCard['Hook suggéré'],
      pilier:      pilierCode(state.currentCard.Pilier),
      pilierLabel: PILIERS[pilierCode(state.currentCard.Pilier)]?.label || '',
      format:      state.currentCard.Format,
      source:      state.currentCard.Source,
      profil:      state.profile,
      profilLabel: PROFILE_LABELS[state.profile],
    });

    const post = result.post || '';
    const textarea = document.getElementById('post-content');
    textarea.value = post;
    updateCharCount(post);
    document.getElementById('post-output-group').classList.remove('hidden');
    toast('Post généré !', 'success');
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
  } finally {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    btn.textContent = 'Regénérer le post ↗';
    stopLoadingBar();
  }
}

function updateCharCount(text) {
  const count = text.length;
  const el = document.getElementById('char-count');
  el.textContent = `${count} / 3000 caractères`;
  el.classList.toggle('over', count > 3000);
}

async function markAsReady() {
  if (!state.currentCard) return;
  const post = document.getElementById('post-content').value.trim();
  const btn  = document.getElementById('mark-ready-btn');
  btn.disabled = true;
  btn.classList.add('btn-loading');

  try {
    const fields = { Statut: 'Prêt à publier' };
    if (post) fields['Post rédigé'] = post;
    await airtableUpdate('Calendrier éditorial', state.currentCard.recordId, fields);

    const domCard = document.querySelector(`.idea-card[data-id="${state.currentCard.recordId}"]`);
    if (domCard) {
      const badge = domCard.querySelector('.status-badge');
      if (badge) {
        badge.className = 'status-badge status-pret';
        badge.textContent = 'Prêt à publier';
        const pCode = pilierCode(state.currentCard.Pilier);
        badge.setAttribute('onclick', `cycleStatus('${state.currentCard.recordId}','Prêt à publier','${pCode}')`);
      }
    }

    toast('Marqué comme prêt à publier !', 'success');
    closeWriteModal();
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
    btn.disabled = false;
    btn.classList.remove('btn-loading');
  }
}

function copyPost() {
  const text = document.getElementById('post-content').value;
  navigator.clipboard.writeText(text).then(() => toast('Copié dans le presse-papier !', 'success'));
}

// ──────────────────────────────────────────────
// SOURCES PAGE
// ──────────────────────────────────────────────
async function loadSourcesPage() {
  SOURCE_CATEGORIES.forEach(cat => {
    document.getElementById(`sources-cat-${cat.slug}`).innerHTML =
      '<li class="source-loading">Chargement…</li>';
  });

  try {
    const res = await airtableGet('Sources', '');
    const records = res.records || [];

    SOURCE_CATEGORIES.forEach(cat => {
      const catRecords = records.filter(r => r.fields['Catégorie'] === cat.name);
      renderSourceCategory(cat.slug, catRecords);
    });

    // Verbatims: one record with Catégorie = 'Terrain / RDV clients'
    const verbatimsRec = records.find(r => r.fields['Catégorie'] === 'Terrain / RDV clients');
    document.getElementById('verbatims-textarea').value = verbatimsRec?.fields.Notes || '';
    document.getElementById('verbatims-record-id').value = verbatimsRec?.id || '';
  } catch {
    SOURCE_CATEGORIES.forEach(cat => {
      document.getElementById(`sources-cat-${cat.slug}`).innerHTML =
        '<li class="source-empty">Aucune source configurée.</li>';
    });
  }
}

function renderSourceCategory(slug, records) {
  const ul = document.getElementById(`sources-cat-${slug}`);
  if (!records || records.length === 0) {
    ul.innerHTML = '<li class="source-empty">Aucune source ajoutée.</li>';
    return;
  }
  ul.innerHTML = records.map(r => `
    <li class="source-url-item">
      <a href="${escHtml(r.fields.url || '#')}" target="_blank" rel="noopener" class="source-url-link">
        <span class="source-url-name">${escHtml(r.fields.Nom || r.fields.url || '')}</span>
        <span class="source-url-host">${escHtml(getHostname(r.fields.url || ''))}</span>
      </a>
      <button class="btn-remove-source" onclick="deleteSource('${r.id}','${slug}')" title="Supprimer">×</button>
    </li>
  `).join('');
}

function toggleAddSourceForm(slug) {
  const form = document.getElementById(`add-form-${slug}`);
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) {
    document.getElementById(`new-src-name-${slug}`)?.focus();
  }
}

async function addSource(category, slug) {
  const nomEl = document.getElementById(`new-src-name-${slug}`);
  const urlEl = document.getElementById(`new-src-url-${slug}`);
  const nom = nomEl.value.trim();
  const url = urlEl.value.trim();
  if (!url) { toast('URL requise.', 'error'); return; }

  const btn = document.querySelector(`#add-form-${slug} .btn-primary`);
  if (btn) btn.disabled = true;

  try {
    await airtableCreate('Sources', {
      Nom: nom || getHostname(url),
      url: url,
      'Catégorie': category,
    });
    nomEl.value = '';
    urlEl.value = '';
    toggleAddSourceForm(slug);
    toast('Source ajoutée.', 'success');
    // Reload this category
    const res = await airtableGet('Sources', `{Catégorie}='${category}'`);
    renderSourceCategory(slug, res.records || []);
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteSource(recordId, slug) {
  if (!confirm('Supprimer cette source ?')) return;
  try {
    await airtableDelete('Sources', recordId);
    toast('Source supprimée.', 'success');
    // Find category name from slug
    const cat = SOURCE_CATEGORIES.find(c => c.slug === slug);
    if (cat) {
      const res = await airtableGet('Sources', `{Catégorie}='${cat.name}'`);
      renderSourceCategory(slug, res.records || []);
    }
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
  }
}

async function saveVerbatims() {
  const text = document.getElementById('verbatims-textarea').value.trim();
  const recordId = document.getElementById('verbatims-record-id').value;
  const btn = document.getElementById('save-verbatims-btn');
  btn.disabled = true;
  btn.classList.add('btn-loading');

  try {
    if (recordId) {
      await airtableUpdate('Sources', recordId, { Notes: text });
    } else {
      const res = await airtableCreate('Sources', {
        Nom: 'Verbatims clients',
        'Catégorie': 'Terrain / RDV clients',
        Notes: text,
      });
      document.getElementById('verbatims-record-id').value = res.record?.id || '';
    }
    toast('Verbatims sauvegardés.', 'success');
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
  }
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
function init() {
  if (checkAuth()) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    renderWeekHeader();
    loadCalendarCards();
  }

  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const pw = document.getElementById('password-input').value;
    if (login(pw)) {
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      renderWeekHeader();
      loadCalendarCards();
    } else {
      document.getElementById('login-error').classList.remove('hidden');
      document.getElementById('password-input').select();
    }
  });

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => showPage(tab.dataset.page));
  });

  // Week navigation
  document.getElementById('prev-week').addEventListener('click', () => {
    state.weekStart = addDays(state.weekStart, -7);
    renderWeekHeader();
    loadCalendarCards();
  });
  document.getElementById('next-week').addEventListener('click', () => {
    state.weekStart = addDays(state.weekStart, 7);
    renderWeekHeader();
    loadCalendarCards();
  });

  // Profile selector
  document.querySelectorAll('.profile-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.profile = btn.dataset.profile;
      loadCalendarCards();
    });
  });

  // Generate week
  document.getElementById('generate-btn').addEventListener('click', generateWeek);

  // Card detail — event delegation on the grid
  document.getElementById('calendar-grid').addEventListener('click', e => {
    if (e.target.closest('.btn-write, .btn-remove, .status-badge')) return;
    const card = e.target.closest('.idea-card');
    if (card) openCardDetail(card.dataset.id);
  });

  // Card detail modal close
  document.getElementById('close-card-detail-modal').addEventListener('click', closeCardDetail);
  document.getElementById('close-card-detail-modal-2').addEventListener('click', closeCardDetail);
  document.getElementById('card-detail-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCardDetail();
  });

  // Write modal
  document.getElementById('close-write-modal').addEventListener('click', closeWriteModal);
  document.getElementById('generate-post-btn').addEventListener('click', generatePost);
  document.getElementById('mark-ready-btn').addEventListener('click', markAsReady);
  document.getElementById('copy-post-btn').addEventListener('click', copyPost);
  document.getElementById('post-content').addEventListener('input', e => updateCharCount(e.target.value));
  document.getElementById('write-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeWriteModal();
  });

  // Sources — verbatims save
  document.getElementById('save-verbatims-btn').addEventListener('click', saveVerbatims);

  // ESC closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
