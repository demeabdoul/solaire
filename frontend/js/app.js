let projets = [];

async function initApp() {
  await loadProjets();
  showVue('dashboard');
}

function showVue(name) {
  document.querySelectorAll('.vue').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav').forEach(n => n.classList.remove('active'));
  document.getElementById('vue-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
  if (name === 'dashboard') renderDashboard();
  if (name === 'projets')   renderProjets();
  if (name === 'nouveau')   initWizard();
}

// Charge la liste des projets depuis la base de données (table
// `projets`, via l'API Flask) à la place de localStorage.
async function loadProjets() {
  try {
    const r = await fetch(API + '/projets');
    if (!r.ok) throw new Error(await r.text());
    projets = await r.json();
  } catch (e) {
    console.error('Erreur chargement projets :', e);
    projets = [];
  }
  document.getElementById('nb-projets').textContent = projets.length;
  renderDashboard();
  renderProjets();
}

// Crée ou met à jour un projet en base via l'API (POST /projets).
// `data.id` présent → mise à jour ; absent → création.
// Retourne le projet tel que renvoyé par le serveur (avec son id
// définitif et ses dates), pour rester compatible avec l'usage
// existant (`const saved = await sauvegarderProjet(...)`).
async function sauvegarderProjet(data) {
  const r = await fetch(API + '/projets', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  const saved = await r.json();
  await loadProjets();
  return saved;
}

async function supprimerProjet(id) {
  if (!confirm('Supprimer ce projet ?')) return;
  try {
    const r = await fetch(API + '/projets/' + id, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
  } catch (e) {
    console.error('Erreur suppression projet :', e);
    alert('Erreur lors de la suppression : ' + e.message);
    return;
  }
  await loadProjets();
}

// Ouvre un projet existant : récupère sa version complète (avec
// tous les scénarios) depuis la base, puisque la liste chargée par
// loadProjets() ne contient qu'un résumé léger.
async function ouvrirProjet(id) {
  let p;
  try {
    const r = await fetch(API + '/projets/' + id);
    if (!r.ok) throw new Error(await r.text());
    p = await r.json();
  } catch (e) {
    console.error('Erreur ouverture projet :', e);
    alert('Impossible d\'ouvrir ce projet : ' + e.message);
    return;
  }
  currentProjetId = id;
  showVue('nouveau');
  if (p.scenarios && p.scenarios.length) {
    scenariosResult = p.scenarios;
    renderScenarios(p.scenarios);
    goStep(6);
    goStep(0);
  }
}


function renderDashboard() {
  const total = projets.length;
  const calc  = projets.filter(p => p.statut === 'calcule').length;
  let kwc = 0, kwh = 0;
  projets.forEach(p => {
    kwc += parseFloat(p.ppv_installe_kwc || 0);
    kwh += parseFloat(p.capacite_inst_kwh || 0);
  });
  document.getElementById('st-total').textContent = total;
  document.getElementById('st-calc').textContent  = calc;
  document.getElementById('st-kwc').textContent   = kwc.toFixed(1);
  document.getElementById('st-kwh').textContent   = kwh.toFixed(1);

  const el = document.getElementById('recent-list');
  if (!projets.length) {
    el.innerHTML = '<div class="empty-msg">Aucun projet. Cliquez sur "+ Nouveau projet".</div>';
    return;
  }
  const sorted = [...projets].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  el.innerHTML = `<table>
    <thead><tr><th>Projet</th><th>Client</th><th>Site</th><th>Statut</th><th>Date</th></tr></thead>
    <tbody>${sorted.slice(0, 6).map(p => `
      <tr style="cursor:pointer" onclick="ouvrirProjet(${p.id})">
        <td><strong>${p.nom_projet || '—'}</strong></td>
        <td>${p.nom_client || '—'}</td>
        <td>${p.nom_site || '—'}</td>
        <td><span class="pcard-statut ${p.statut === 'calcule' ? 'st-calcule' : 'st-brouillon'}">${p.statut || 'brouillon'}</span></td>
        <td>${new Date(p.updated_at).toLocaleDateString('fr-FR')}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

function renderProjets() {
  document.getElementById('projets-count').textContent = projets.length + ' projet(s)';
  const sorted = [...projets].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  let html = `<div class="pcard new" onclick="showVue('nouveau')">
    <div style="font-size:28px">+</div><div>Créer un nouveau projet</div>
  </div>`;
  html += sorted.map(p => `
    <div class="pcard" onclick="ouvrirProjet(${p.id})">
      <button class="pcard-del" onclick="event.stopPropagation();supprimerProjet(${p.id})">&#128465;</button>
      <div class="pcard-name">${p.nom_projet || '—'}</div>
      <div class="pcard-client">${p.nom_client || '—'}</div>
      <div class="pcard-meta">
        <span>${p.nom_site || '—'}</span>
        <span class="pcard-statut ${p.statut === 'calcule' ? 'st-calcule' : 'st-brouillon'}">${p.statut || 'brouillon'}</span>
      </div>
    </div>`).join('');
  document.getElementById('projets-grid').innerHTML = html;
}