// ---------------------------------------------------------------
// Configuració
// ---------------------------------------------------------------
const API_BASE = '/api';

const NIVELL_LABELS = {
  sensibilitzacio: 'Sensibilització',
  iniciacio: 'Iniciació',
  elemental: 'Elemental',
  professional: 'Professional',
  adults: 'Adults',
};

const ESTAT_CLASSES = {
  pendent: 'badge--pendent',
  confirmada: 'badge--confirmada',
  'cancel·lada': 'badge--cancel',
};

let cursosCache = [];

// ---------------------------------------------------------------
// Utilitats
// ---------------------------------------------------------------
async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (response.status === 401) {
    mostrarLogin();
    throw new Error('No autenticat');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error inesperat');
  }
  return data;
}

function mostrarToast(missatge, esError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = missatge;
  toast.className = `toast show ${esError ? 'error' : ''}`;
  setTimeout(() => toast.classList.remove('show'), 3200);
}

function formatDataHora(iso) {
  return new Date(iso).toLocaleString('ca-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------
// Autenticació
// ---------------------------------------------------------------
function mostrarLogin() {
  document.getElementById('loginWrap').style.display = 'flex';
  document.getElementById('adminApp').style.display = 'none';
}

function mostrarApp(username) {
  document.getElementById('loginWrap').style.display = 'none';
  document.getElementById('adminApp').style.display = 'block';
  document.getElementById('adminUsername').textContent = username;
  document.getElementById('adminAvatar').textContent = username.charAt(0).toUpperCase();
  carregarTot();
}

async function comprovarSessio() {
  try {
    const data = await apiFetch('/auth/me');
    mostrarApp(data.username);
  } catch (err) {
    mostrarLogin();
  }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  errorEl.classList.remove('show');
  btn.disabled = true;
  btn.textContent = 'Accedint…';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error iniciant sessió');
    mostrarApp(data.username);
    document.getElementById('loginForm').reset();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Iniciar sessió';
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } finally {
    mostrarLogin();
  }
});

// ---------------------------------------------------------------
// Càrrega general
// ---------------------------------------------------------------
async function carregarTot() {
  await Promise.all([carregarStats(), carregarCursosAdmin(), carregarMatricules()]);
}

// ---------------------------------------------------------------
// Estadístiques
// ---------------------------------------------------------------
async function carregarStats() {
  try {
    const s = await apiFetch('/admin/stats');
    document.getElementById('statTotal').textContent = s.total;
    document.getElementById('statPendents').textContent = s.pendents;
    document.getElementById('statConfirmades').textContent = s.confirmades;
    document.getElementById('statCancelades').textContent = s.cancelades;
    document.getElementById('statIngressos').textContent = `${Number(s.ingressos_estimats).toFixed(0)} €`;
    document.getElementById('statPlaces').textContent = `${s.places_disponibles}/${s.places_totals}`;
  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------------
// MATRÍCULES
// ---------------------------------------------------------------
function construirQuery() {
  const params = new URLSearchParams();
  const estat = document.getElementById('filterEstat').value;
  const cursId = document.getElementById('filterCurs').value;
  const q = document.getElementById('filterCerca').value.trim();
  if (estat) params.set('estat', estat);
  if (cursId) params.set('curs_id', cursId);
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function carregarMatricules() {
  const tbody = document.getElementById('matriculesBody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Carregant dades…</td></tr>';

  try {
    const matricules = await apiFetch(`/admin/matricules${construirQuery()}`);

    if (matricules.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hi ha matrícules amb aquests filtres.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    matricules.forEach((m) => {
      const tr = document.createElement('tr');
      const badgeClass = ESTAT_CLASSES[m.estat] || '';
      tr.innerHTML = `
        <td>${formatDataHora(m.data_matricula)}</td>
        <td><strong>${escapeHtml(m.nom_complet)}</strong><br><span style="font-size:0.78rem;color:var(--color-ink-soft);">${NIVELL_LABELS[m.nivell] || m.nivell}</span></td>
        <td>${escapeHtml(m.email)}<br><span style="font-size:0.78rem;color:var(--color-ink-soft);">${escapeHtml(m.telefon || '')}</span></td>
        <td>${escapeHtml(m.curs_nom)}</td>
        <td>${Number(m.preu).toFixed(0)} €</td>
        <td class="comment-cell" title="${escapeHtml(m.comentaris || '')}">${escapeHtml(m.comentaris || '—')}</td>
        <td><span class="badge ${badgeClass}">${m.estat}</span></td>
        <td class="actions-cell">
          <select class="estat-select" data-id="${m.matricula_id}">
            <option value="pendent" ${m.estat === 'pendent' ? 'selected' : ''}>Pendent</option>
            <option value="confirmada" ${m.estat === 'confirmada' ? 'selected' : ''}>Confirmada</option>
            <option value="cancel·lada" ${m.estat === 'cancel·lada' ? 'selected' : ''}>Cancel·lada</option>
          </select>
          <button class="btn btn--sm btn--danger" data-delete-matricula="${m.matricula_id}">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.estat-select').forEach((select) => {
      select.addEventListener('change', () => canviarEstatMatricula(select.dataset.id, select.value));
    });
    tbody.querySelectorAll('[data-delete-matricula]').forEach((btn) => {
      btn.addEventListener('click', () => eliminarMatricula(btn.dataset.deleteMatricula));
    });
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Error carregant les matrícules: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function canviarEstatMatricula(id, estat) {
  try {
    await apiFetch(`/admin/matricules/${id}/estat`, {
      method: 'PATCH',
      body: JSON.stringify({ estat }),
    });
    mostrarToast('Estat actualitzat correctament.');
    await Promise.all([carregarMatricules(), carregarStats(), carregarCursosAdmin()]);
  } catch (err) {
    mostrarToast(err.message, true);
    await carregarMatricules();
  }
}

async function eliminarMatricula(id) {
  if (!confirm('Segur que vols eliminar aquesta matrícula? Aquesta acció no es pot desfer.')) return;
  try {
    await apiFetch(`/admin/matricules/${id}`, { method: 'DELETE' });
    mostrarToast('Matrícula eliminada.');
    await Promise.all([carregarMatricules(), carregarStats(), carregarCursosAdmin()]);
  } catch (err) {
    mostrarToast(err.message, true);
  }
}

['filterEstat', 'filterCurs', 'filterCerca'].forEach((id) => {
  const el = document.getElementById(id);
  const evt = id === 'filterCerca' ? 'input' : 'change';
  el.addEventListener(evt, debounce(carregarMatricules, 300));
});

document.getElementById('refreshMatriculesBtn').addEventListener('click', () => {
  carregarMatricules();
  carregarStats();
});

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------
// GESTIÓ DE CURSOS
// ---------------------------------------------------------------
async function carregarCursosAdmin() {
  const tbody = document.getElementById('cursosBody');
  const filterCursSelect = document.getElementById('filterCurs');

  try {
    const cursos = await apiFetch('/admin/cursos');
    cursosCache = cursos;

    // Desplegable de filtre de matrícules
    const valorActual = filterCursSelect.value;
    filterCursSelect.innerHTML = '<option value="">Tots els cursos</option>';
    cursos.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nom;
      filterCursSelect.appendChild(opt);
    });
    filterCursSelect.value = valorActual;

    if (cursos.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Encara no hi ha cap curs creat.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    cursos.forEach((c) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(c.nom)}</strong></td>
        <td>${NIVELL_LABELS[c.nivell] || c.nivell}</td>
        <td>${Number(c.preu).toFixed(0)} €</td>
        <td>${c.places_disponibles}/${c.places_totals}</td>
        <td>${escapeHtml(c.horari || '—')}</td>
        <td><span class="badge ${c.actiu ? 'badge--confirmada' : 'badge--cancel'}">${c.actiu ? 'Actiu' : 'Inactiu'}</span></td>
        <td class="actions-cell">
          <button class="btn btn--sm btn--ghost" data-edit-curs="${c.id}">Editar</button>
          <button class="btn btn--sm btn--danger" data-delete-curs="${c.id}">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-edit-curs]').forEach((btn) => {
      btn.addEventListener('click', () => obrirModalCurs(btn.dataset.editCurs));
    });
    tbody.querySelectorAll('[data-delete-curs]').forEach((btn) => {
      btn.addEventListener('click', () => eliminarCurs(btn.dataset.deleteCurs));
    });
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Error carregant els cursos: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function obrirModalCurs(id) {
  const overlay = document.getElementById('cursModalOverlay');
  const form = document.getElementById('cursForm');
  form.reset();

  if (id) {
    const curs = cursosCache.find((c) => String(c.id) === String(id));
    if (!curs) return;
    document.getElementById('cursModalTitle').textContent = 'Editar curs';
    document.getElementById('cursId').value = curs.id;
    document.getElementById('cursNom').value = curs.nom;
    document.getElementById('cursNivell').value = curs.nivell;
    document.getElementById('cursDescripcio').value = curs.descripcio || '';
    document.getElementById('cursPreu').value = curs.preu;
    document.getElementById('cursPlaces').value = curs.places_totals;
    document.getElementById('cursEdatMin').value = curs.edat_min ?? '';
    document.getElementById('cursEdatMax').value = curs.edat_max ?? '';
    document.getElementById('cursHorari').value = curs.horari || '';
    document.getElementById('cursActiu').checked = curs.actiu;
  } else {
    document.getElementById('cursModalTitle').textContent = 'Nou curs';
    document.getElementById('cursId').value = '';
    document.getElementById('cursActiu').checked = true;
  }

  overlay.classList.add('show');
}

function tancarModalCurs() {
  document.getElementById('cursModalOverlay').classList.remove('show');
}

document.getElementById('novCursBtn').addEventListener('click', () => obrirModalCurs(null));
document.getElementById('cursModalClose').addEventListener('click', tancarModalCurs);
document.getElementById('cursCancelBtn').addEventListener('click', tancarModalCurs);
document.getElementById('cursModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'cursModalOverlay') tancarModalCurs();
});

document.getElementById('cursForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('cursId').value;
  const saveBtn = document.getElementById('cursSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Desant…';

  const payload = {
    nom: document.getElementById('cursNom').value.trim(),
    nivell: document.getElementById('cursNivell').value,
    descripcio: document.getElementById('cursDescripcio').value.trim(),
    preu: parseFloat(document.getElementById('cursPreu').value),
    places_totals: parseInt(document.getElementById('cursPlaces').value, 10),
    edat_min: document.getElementById('cursEdatMin').value ? parseInt(document.getElementById('cursEdatMin').value, 10) : null,
    edat_max: document.getElementById('cursEdatMax').value ? parseInt(document.getElementById('cursEdatMax').value, 10) : null,
    horari: document.getElementById('cursHorari').value.trim(),
    actiu: document.getElementById('cursActiu').checked,
  };

  try {
    if (id) {
      await apiFetch(`/admin/cursos/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      mostrarToast('Curs actualitzat correctament.');
    } else {
      await apiFetch('/admin/cursos', { method: 'POST', body: JSON.stringify(payload) });
      mostrarToast('Curs creat correctament.');
    }
    tancarModalCurs();
    await Promise.all([carregarCursosAdmin(), carregarStats(), carregarMatricules()]);
  } catch (err) {
    mostrarToast(err.message, true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Desar';
  }
});

async function eliminarCurs(id) {
  if (!confirm('Segur que vols eliminar aquest curs?')) return;
  try {
    await apiFetch(`/admin/cursos/${id}`, { method: 'DELETE' });
    mostrarToast('Curs eliminat.');
    await Promise.all([carregarCursosAdmin(), carregarStats()]);
  } catch (err) {
    mostrarToast(err.message, true);
  }
}

// ---------------------------------------------------------------
// Arrencada
// ---------------------------------------------------------------
comprovarSessio();
