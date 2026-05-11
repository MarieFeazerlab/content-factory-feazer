/* ============================================================
   CONTENT FACTORY FEAZER — App
   ============================================================ */

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────
const PASSWORD = 'Feazercontent2026!?!?';
const SESSION_KEY = 'cf_feazer_auth';

const PILIERS = {
  P1: { label: 'Autorité',                 jour: 'Lundi',    dayOffset: 0 },
  P2: { label: 'Démonstration',            jour: 'Mercredi', dayOffset: 2 },
  P3: { label: 'Culture / Différenciation', jour: 'Vendredi', dayOffset: 4 },
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

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
const state = {
  weekStart:    getWeekStart(new Date()),
  profile:      'feazer',
  currentCard:  null,   // card data for write modal
  loadingBar:   null,   // interval ref
  cardCache:    {},     // recordId → fields, for card detail modal
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

function formatDateShort(date) {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatDateFull(date) {
  const d = new Date(date);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
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
  const res = await fetch(`/.netlify/functions/${endpoint}`, {
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

  Object.entries(PILIERS).forEach(([code, info]) => {
    const date = addDays(state.weekStart, info.dayOffset);
    document.getElementById(`date-${code.toLowerCase()}`).textContent = formatDateFull(date);
  });
}

// ──────────────────────────────────────────────
// CALENDAR — LOAD CARDS
// ──────────────────────────────────────────────
async function loadCalendarCards() {
  const semaine = toISODate(state.weekStart);
  const profil  = PROFILE_LABELS[state.profile];

  // Clear columns
  ['P1','P2','P3'].forEach(p => {
    document.getElementById(`cards-${p.toLowerCase()}`).innerHTML = `
      <div class="col-empty-state"><p>Chargement…</p></div>`;
  });

  try {
    const filter = `AND({Date de publication}='${semaine}',{Mode de publication}='${profil}')`;
    const result = await airtableGet('Calendrier éditorial', filter);
    const records = result.records || [];

    const byPilier = { P1: [], P2: [], P3: [] };
    records.forEach(r => {
      const p = r.fields.Pilier;
      if (byPilier[p]) byPilier[p].push(r);
    });

    ['P1','P2','P3'].forEach(p => renderPilierCards(p, byPilier[p]));
  } catch (err) {
    ['P1','P2','P3'].forEach(p => {
      document.getElementById(`cards-${p.toLowerCase()}`).innerHTML = `
        <div class="col-empty-state"><p>Erreur de chargement.<br>${err.message}</p></div>`;
    });
  }
}

function renderPilierCards(pilier, records) {
  const container = document.getElementById(`cards-${pilier.toLowerCase()}`);
  if (!records || records.length === 0) {
    container.innerHTML = `
      <div class="col-empty-state">
        <p>Aucune idée générée.<br>Cliquez sur "Générer la semaine".</p>
      </div>`;
    return;
  }
  records.forEach(r => { state.cardCache[r.id] = r.fields; });
  container.innerHTML = records.map(r => cardHTML(r)).join('');
}

function cardHTML(record) {
  const f = record.fields;
  const statusClass = {
    'Brouillon':       'status-brouillon',
    'Prêt à publier':  'status-pret',
    'Publié':          'status-publie',
  }[f.Statut] || 'status-brouillon';

  const pilierClass = {P1:'pilier-p1', P2:'pilier-p2', P3:'pilier-p3'}[f.Pilier] || '';

  return `
    <div class="idea-card" data-id="${record.id}" data-pilier="${f.Pilier}">
      <div class="card-top-row">
        <span class="format-badge">${f.Format || 'Texte long'}</span>
        <div class="card-actions-row">
          <button class="btn-write" onclick="openWriteModal('${record.id}')">Écrire ↗</button>
          <button class="btn-remove" title="Retirer" onclick="removeCard('${record.id}', '${f.Pilier}')">×</button>
        </div>
      </div>
      <div class="card-title">${escHtml(f['Titre / idée'] || '')}</div>
      ${f['Hook suggéré'] ? `<div class="card-hook">${escHtml(f['Hook suggéré'])}</div>` : ''}
      <div class="card-bottom-row">
        <span class="card-source">${escHtml(f.Source || '')}</span>
        <span class="status-badge ${statusClass}" onclick="cycleStatus('${record.id}', '${f.Statut || 'Brouillon'}', '${f.Pilier}')">${f.Statut || 'Brouillon'}</span>
      </div>
    </div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ──────────────────────────────────────────────
// CALENDAR — STATUS CYCLE
// ──────────────────────────────────────────────
async function cycleStatus(recordId, currentStatus, pilier) {
  const idx     = STATUS_CYCLE.indexOf(currentStatus);
  const newStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];

  try {
    await airtableUpdate('Calendrier éditorial', recordId, { Statut: newStatus });
    // Update DOM directly
    const card = document.querySelector(`.idea-card[data-id="${recordId}"]`);
    if (card) {
      const badge = card.querySelector('.status-badge');
      badge.className = 'status-badge ' + {
        'Brouillon':      'status-brouillon',
        'Prêt à publier': 'status-pret',
        'Publié':         'status-publie',
      }[newStatus];
      badge.textContent = newStatus;
      badge.setAttribute('onclick', `cycleStatus('${recordId}', '${newStatus}', '${pilier}')`);
    }
  } catch {
    toast('Erreur lors de la mise à jour du statut.', 'error');
  }
}

// ──────────────────────────────────────────────
// CALENDAR — REMOVE CARD
// ──────────────────────────────────────────────
async function removeCard(recordId, pilier) {
  if (!confirm('Retirer cette idée ?')) return;
  try {
    await airtableDelete('Calendrier éditorial', recordId);
    const card = document.querySelector(`.idea-card[data-id="${recordId}"]`);
    if (card) {
      card.style.transition = 'opacity 0.2s';
      card.style.opacity = '0';
      setTimeout(() => {
        card.remove();
        // Check if container empty
        const container = document.getElementById(`cards-${pilier.toLowerCase()}`);
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
    // Load active sources
    const sourcesRes = await airtableGet('Sources', `AND({Type}='url',{Actif}=1)`);
    const sources = (sourcesRes.records || []).map(r => ({
      nom:    r.fields.Nom,
      url:    r.fields.URL,
      pilier: r.fields.Pilier,
    }));

    // Generate for each pillar sequentially (to avoid API rate limits)
    for (const [pilier, info] of Object.entries(PILIERS)) {
      const pilierSources = sources.filter(s => s.pilier === pilier);
      document.getElementById(`cards-${pilier.toLowerCase()}`).innerHTML =
        `<div class="col-empty-state"><p>Génération en cours…</p></div>`;
      try {
        const result = await api('generate', {
          pilier,
          pilierLabel: info.label,
          semaine,
          profil,
          profilLabel: PROFILE_LABELS[profil],
          jour:       info.jour,
          sources:    pilierSources,
        });
        if (result.idees) {
          renderPilierCards(pilier, result.idees.map(idee => ({
            id: idee.recordId,
            fields: {
              'Titre / idée':        idee.titre,
              'Hook suggéré':        idee.hook,
              Format:                idee.format,
              Source:                idee.source,
              Statut:                'Brouillon',
              Pilier:                pilier,
              'Mode de publication': PROFILE_LABELS[profil],
            }
          })));
        }
      } catch (err) {
        document.getElementById(`cards-${pilier.toLowerCase()}`).innerHTML =
          `<div class="col-empty-state"><p>Erreur : ${err.message}</p></div>`;
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
  // Fallback to DOM if cache miss (e.g. older session)
  const domCard = document.querySelector(`.idea-card[data-id="${recordId}"]`);

  const fields = {
    'Titre / idée': cached['Titre / idée'] || domCard?.querySelector('.card-title')?.textContent || '',
    'Hook suggéré': cached['Hook suggéré'] || domCard?.querySelector('.card-hook')?.textContent  || '',
    Format:         cached.Format          || domCard?.querySelector('.format-badge')?.textContent || '',
    Source:         cached.Source          || domCard?.querySelector('.card-source')?.textContent  || '',
    Pilier:         cached.Pilier          || domCard?.dataset.pilier || 'P1',
    recordId,
  };

  state.currentCard = fields;

  document.getElementById('write-title').value = fields['Titre / idée'];

  const pilierDisplay = document.getElementById('write-pilier-display');
  pilierDisplay.innerHTML = `<span class="pilier-badge pilier-${fields.Pilier.toLowerCase()}">${fields.Pilier} — ${PILIERS[fields.Pilier]?.label || ''}</span>`;

  document.getElementById('write-format-display').innerHTML =
    `<span class="format-badge">${fields.Format}</span>`;

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
const PILIER_LABELS_DETAIL = {
  P1: 'Autorité',
  P2: 'Démonstration',
  P3: 'Culture / Différenciation',
};

function openCardDetail(recordId) {
  const f = state.cardCache[recordId];
  if (!f) return;

  document.getElementById('card-detail-title').textContent = f['Titre / idée'] || 'Détail de l\'idée';

  const pilierClass = { P1: 'pilier-p1', P2: 'pilier-p2', P3: 'pilier-p3' }[f.Pilier] || '';

  document.getElementById('card-detail-body').innerHTML = `
    <div class="card-detail-fields">
      <div class="card-detail-field">
        <span class="card-detail-label">Pilier</span>
        <div><span class="pilier-badge ${pilierClass}">${escHtml(f.Pilier || '')} — ${escHtml(PILIER_LABELS_DETAIL[f.Pilier] || '')}</span></div>
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
      pilier:      state.currentCard.Pilier,
      pilierLabel: PILIERS[state.currentCard.Pilier]?.label || '',
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

    // Update DOM card
    const domCard = document.querySelector(`.idea-card[data-id="${state.currentCard.recordId}"]`);
    if (domCard) {
      const badge = domCard.querySelector('.status-badge');
      if (badge) {
        badge.className = 'status-badge status-pret';
        badge.textContent = 'Prêt à publier';
        badge.setAttribute('onclick', `cycleStatus('${state.currentCard.recordId}', 'Prêt à publier', '${state.currentCard.Pilier}')`);
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
// SOURCES PAGE — LOAD ALL
// ──────────────────────────────────────────────
async function loadSourcesPage() {
  loadURLs();
  loadCalls();
  loadRepurposing();
}

// ──────────────────────────────────────────────
// URLS
// ──────────────────────────────────────────────
async function loadURLs() {
  const tbody = document.getElementById('urls-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Chargement…</td></tr>';

  try {
    const res = await airtableGet('Sources', `{Type}='url'`);
    const records = res.records || [];

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="table-loading">
            Aucune source. <button class="btn-table-action" onclick="initDefaultSources()">Initialiser les sources par défaut</button>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = records.map(r => `
      <tr>
        <td><strong>${escHtml(r.fields.Nom || '')}</strong></td>
        <td class="table-url"><a href="${escHtml(r.fields.URL || '')}" target="_blank">${escHtml(r.fields.URL || '')}</a></td>
        <td><span class="pilier-badge pilier-${(r.fields.Pilier||'').toLowerCase()}">${r.fields.Pilier || ''}</span></td>
        <td>
          <label class="toggle">
            <input type="checkbox" ${r.fields.Actif ? 'checked' : ''} onchange="toggleURL('${r.id}', this.checked)">
            <span class="toggle-track"></span>
          </label>
        </td>
        <td><button class="btn-table-action danger" onclick="deleteURL('${r.id}')">Supprimer</button></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-loading">Erreur : ${err.message}</td></tr>`;
  }
}

async function toggleURL(recordId, active) {
  try {
    await airtableUpdate('Sources', recordId, { Actif: active });
  } catch {
    toast('Erreur lors de la mise à jour.', 'error');
    loadURLs();
  }
}

async function deleteURL(recordId) {
  if (!confirm('Supprimer cette source ?')) return;
  try {
    await airtableDelete('Sources', recordId);
    toast('Source supprimée.', 'success');
    loadURLs();
  } catch {
    toast('Erreur lors de la suppression.', 'error');
  }
}

async function saveNewURL() {
  const nom    = document.getElementById('new-url-name').value.trim();
  const url    = document.getElementById('new-url-url').value.trim();
  const pilier = document.getElementById('new-url-pilier').value;

  if (!nom || !url) { toast('Nom et URL requis.', 'error'); return; }

  const btn = document.getElementById('save-url-btn');
  btn.disabled = true;

  try {
    await airtableCreate('Sources', { Nom: nom, URL: url, Pilier: pilier, Type: 'url', Actif: true });
    toast('Source ajoutée !', 'success');
    document.getElementById('add-url-form').classList.add('hidden');
    document.getElementById('new-url-name').value = '';
    document.getElementById('new-url-url').value = '';
    loadURLs();
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function initDefaultSources() {
  const btn = document.querySelector('button[onclick="initDefaultSources()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Initialisation…'; }
  startLoadingBar();

  try {
    await api('setup', { action: 'sources' });
    toast('Sources par défaut initialisées !', 'success');
    loadURLs();
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Initialiser les sources par défaut'; }
  } finally {
    stopLoadingBar();
  }
}

// ──────────────────────────────────────────────
// CALLS
// ──────────────────────────────────────────────
async function loadCalls() {
  const tbody = document.getElementById('calls-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Chargement…</td></tr>';

  try {
    const res = await airtableGet('Calls', '');
    const records = res.records || [];

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Aucun call enregistré.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(r => {
      const insights = r.fields['Insights extraits'] || '';
      const count = insights ? (insights.match(/"contenu"/g) || []).length : 0;
      const date = r.fields.Date ? formatDateFull(new Date(r.fields.Date)) : '—';
      return `
        <tr>
          <td><strong>${escHtml(r.fields.Nom || '')}</strong></td>
          <td>${date}</td>
          <td>${count > 0 ? `${count} insight${count > 1 ? 's' : ''}` : 'Extraction en cours…'}</td>
          <td>
            <button class="btn-table-action" onclick="viewCallInsights('${r.id}')">Voir les insights</button>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="table-loading">Erreur : ${err.message}</td></tr>`;
  }
}

function viewCallInsights(recordId) {
  // We'll fetch the record from Airtable to get insights
  airtableGet('Calls', `RECORD_ID()='${recordId}'`).then(res => {
    const record = (res.records || [])[0];
    if (!record) return;
    const insights = record.fields['Insights extraits'] || '';
    let parsed = [];
    try { parsed = JSON.parse(insights).insights || []; } catch {}

    document.getElementById('call-modal-title').textContent = `Insights — ${record.fields.Nom || ''}`;
    const body = document.getElementById('call-modal-body');

    if (parsed.length === 0) {
      body.innerHTML = `<p style="color:var(--text-muted)">Aucun insight extrait ou extraction en cours.</p>`;
    } else {
      body.innerHTML = `<div class="insights-list">
        ${parsed.map(ins => `
          <div class="insight-item">
            <div class="insight-cat">${escHtml(ins.categorie || '')}</div>
            <div class="insight-content">${escHtml(ins.contenu || '')}</div>
            ${ins.potentiel_contenu ? `<div class="insight-potential">💡 ${escHtml(ins.potentiel_contenu)}</div>` : ''}
          </div>
        `).join('')}
      </div>`;
    }
    document.getElementById('call-modal').classList.remove('hidden');
  }).catch(() => toast('Impossible de charger les insights.', 'error'));
}

async function saveNewCall() {
  const nom     = document.getElementById('new-call-name').value.trim();
  const content = document.getElementById('new-call-content').value.trim();
  const file    = document.getElementById('new-call-file').files[0];

  if (!nom) { toast('Nom du call requis.', 'error'); return; }

  let text = content;

  if (!text && file) {
    text = await readFileAsText(file);
  }

  if (!text) { toast('Contenu ou fichier requis.', 'error'); return; }

  const btn = document.getElementById('save-call-btn');
  btn.disabled = true;
  btn.textContent = 'Analyse en cours…';
  startLoadingBar();

  try {
    await api('analyze', { type: 'call', nom, content: text });
    toast('Call analysé et ajouté !', 'success');
    document.getElementById('add-call-form').classList.add('hidden');
    document.getElementById('new-call-name').value = '';
    document.getElementById('new-call-content').value = '';
    document.getElementById('new-call-file').value = '';
    loadCalls();
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
  } finally {
    stopLoadingBar();
    btn.disabled = false;
    btn.textContent = 'Analyser et ajouter ↗';
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
    reader.readAsText(file, 'UTF-8');
  });
}

// ──────────────────────────────────────────────
// REPURPOSING
// ──────────────────────────────────────────────
async function loadRepurposing() {
  const container = document.getElementById('repurposing-list');

  try {
    const res = await airtableGet('Repurposing', '');
    const records = res.records || [];

    if (records.length === 0) {
      container.innerHTML = `<div class="table-empty">Aucun contenu analysé pour l'instant.</div>`;
      return;
    }

    container.innerHTML = records.map(r => `
      <div class="repurposing-card">
        <div class="repurposing-card-info">
          <div class="repurposing-card-title">${escHtml(r.fields.Titre || r.fields.URL || 'Sans titre')}</div>
          <div class="repurposing-card-url">${escHtml(r.fields.URL || '')}</div>
          <div class="repurposing-card-meta">Analysé le ${r.fields.Date ? formatDateFull(new Date(r.fields.Date)) : '—'}</div>
        </div>
        <button class="btn-table-action" onclick="viewRepurposing('${r.id}')">Voir les angles</button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="table-empty">Erreur : ${err.message}</div>`;
  }
}

function viewRepurposing(recordId) {
  airtableGet('Repurposing', `RECORD_ID()='${recordId}'`).then(res => {
    const record = (res.records || [])[0];
    if (!record) return;

    const angles = record.fields['Angles extraits'] || '';
    let parsed = { titre: '', angles: [] };
    try { parsed = JSON.parse(angles); } catch {}

    document.getElementById('repurposing-modal-title').textContent =
      `Angles — ${parsed.titre || record.fields.URL || ''}`;
    const body = document.getElementById('repurposing-modal-body');

    if (!parsed.angles || parsed.angles.length === 0) {
      body.innerHTML = `<p style="color:var(--text-muted)">Aucun angle extrait.</p>`;
    } else {
      body.innerHTML = `<div class="insights-list">
        ${parsed.angles.map(a => `
          <div class="insight-item">
            <div class="insight-cat">
              <span class="pilier-badge pilier-${(a.pilier||'').toLowerCase()}">${a.pilier || ''}</span>
              &nbsp;
              <span class="format-badge">${a.format || ''}</span>
            </div>
            <div class="insight-content" style="margin-top:8px">${escHtml(a.angle || '')}</div>
            ${a.hook ? `<div class="insight-potential">Hook : ${escHtml(a.hook)}</div>` : ''}
          </div>
        `).join('')}
      </div>`;
    }
    document.getElementById('repurposing-modal').classList.remove('hidden');
  }).catch(() => toast('Impossible de charger les angles.', 'error'));
}

async function analyzeURL() {
  const url = document.getElementById('repurposing-url').value.trim();
  if (!url) { toast('URL requise.', 'error'); return; }

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.textContent = 'Analyse…';
  startLoadingBar();

  try {
    await api('analyze', { type: 'repurposing', url });
    toast('Contenu analysé !', 'success');
    document.getElementById('repurposing-url').value = '';
    loadRepurposing();
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
  } finally {
    stopLoadingBar();
    btn.disabled = false;
    btn.textContent = 'Analyser ↗';
  }
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
function init() {
  // Auth gate
  if (checkAuth()) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    renderWeekHeader();
    loadCalendarCards();
  }

  // Login form
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

  // Card detail — event delegation sur toute la grid, ignore boutons et badges
  document.getElementById('calendar-grid').addEventListener('click', e => {
    if (e.target.closest('.btn-write, .btn-remove, .status-badge')) return;
    const card = e.target.closest('.idea-card');
    if (card) openCardDetail(card.dataset.id);
  });

  // Card detail modal — fermeture
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

  // Call modal
  document.getElementById('close-call-modal').addEventListener('click', () => {
    document.getElementById('call-modal').classList.add('hidden');
  });
  document.getElementById('call-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // Repurposing modal
  document.getElementById('close-repurposing-modal').addEventListener('click', () => {
    document.getElementById('repurposing-modal').classList.add('hidden');
  });
  document.getElementById('repurposing-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // Sources — add URL
  document.getElementById('add-url-btn').addEventListener('click', () => {
    document.getElementById('add-url-form').classList.remove('hidden');
    document.getElementById('new-url-name').focus();
  });
  document.getElementById('cancel-url-btn').addEventListener('click', () => {
    document.getElementById('add-url-form').classList.add('hidden');
  });
  document.getElementById('save-url-btn').addEventListener('click', saveNewURL);

  // Sources — add call
  document.getElementById('add-call-btn').addEventListener('click', () => {
    document.getElementById('add-call-form').classList.remove('hidden');
    document.getElementById('new-call-name').focus();
  });
  document.getElementById('cancel-call-btn').addEventListener('click', () => {
    document.getElementById('add-call-form').classList.add('hidden');
  });
  document.getElementById('save-call-btn').addEventListener('click', saveNewCall);

  // Repurposing
  document.getElementById('analyze-btn').addEventListener('click', analyzeURL);
  document.getElementById('repurposing-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') analyzeURL();
  });

  // ESC closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
