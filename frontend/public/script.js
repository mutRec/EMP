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

// ---------------------------------------------------------------
// Menú mòbil
// ---------------------------------------------------------------
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  document.getElementById('navOverlay').classList.toggle('show');
  navLinks.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => navLinks.classList.remove('open'))
  );
}

// ---------------------------------------------------------------
// Carregar els cursos disponibles al formulari
// ---------------------------------------------------------------
async function carregarCursos() {
  // ✅ CANVI: 'cursDesitjat' en lloc de 'curs'
  const selectCurs = document.getElementById('cursDesitjat');
  if (!selectCurs) {
    console.warn("⚠️ No s'ha trobat cap <select> amb id='cursDesitjat'");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/cursos`);
    if (!response.ok) throw new Error('Error de xarxa');
    const cursos = await response.json();

    selectCurs.innerHTML = '';

    if (cursos.length === 0) {
      selectCurs.innerHTML = '<option value="">No hi ha cursos amb places disponibles ara mateix</option>';
      return;
    }

    selectCurs.innerHTML = '<option value="">Selecciona un curs</option>';

    const grups = {};
    cursos.forEach((curs) => {
      const nivell = curs.nivell || curs.nivell_id || 'altres';
      if (!grups[nivell]) grups[nivell] = [];
      grups[nivell].push(curs);
    });

    Object.keys(grups).forEach((nivell) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = NIVELL_LABELS[nivell] || nivell;
      grups[nivell].forEach((curs) => {
        const option = document.createElement('option');
        option.value = curs.id;
        const placesDisponibles = curs.places_disponibles !== undefined 
          ? curs.places_disponibles 
          : (curs.places_totals - curs.places_ocupades);
        const places = placesDisponibles === 1 ? '1 plaça' : `${placesDisponibles} places`;
        option.textContent = `${curs.nom} — ${Number(curs.preu).toFixed(0)}€ (${places})`;
        if (placesDisponibles <= 0) option.disabled = true;
        optgroup.appendChild(option);
      });
      selectCurs.appendChild(optgroup);
    });
  } catch (error) {
    console.error('Error carregant cursos:', error);
    selectCurs.innerHTML = '<option value="">No s\'han pogut carregar els cursos</option>';
  }
}

document.addEventListener('DOMContentLoaded', carregarCursos);

// ---------------------------------------------------------------
// Enviar el formulari de matrícula
// ---------------------------------------------------------------
const form = document.getElementById('matriculaForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const missatgeEl = document.getElementById('missatge');
    const submitBtn = document.getElementById('submitBtn');

    const setMissatge = (text, tipus) => {
      missatgeEl.textContent = text;
      missatgeEl.className = `missatge show ${tipus}`;
    };

    setMissatge('Processant la teva sol·licitud…', 'info');
    submitBtn.disabled = true;

    const formData = {
      nom_complet: document.getElementById('nom').value.trim(),
      email: document.getElementById('email').value.trim(),
      telefon: document.getElementById('telefon').value.trim(),
      data_naixement: document.getElementById('data_naixement').value,
      // ✅ CANVI: 'cursDesitjat' en lloc de 'curs'
      curs_id: parseInt(document.getElementById('cursDesitjat').value, 10),
      comentaris: document.getElementById('comentaris').value.trim(),
    };

    if (!formData.curs_id) {
      setMissatge('Selecciona un curs abans d\'enviar la matrícula.', 'error');
      submitBtn.disabled = false;
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/matricules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMissatge(`✅ ${data.message}`, 'exit');
        form.reset();
        await carregarCursos();
      } else {
        setMissatge(`❌ ${data.error || 'Error desconegut'}`, 'error');
      }
    } catch (error) {
      setMissatge('❌ Error de connexió amb el servidor. Torna-ho a provar més tard.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

document.getElementById('navOverlay').addEventListener('click', () => {
  document.querySelector('.nav-links').classList.remove('open');
  document.getElementById('navOverlay').classList.remove('show');
});