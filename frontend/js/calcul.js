function construirePayload(avecPrix) {
  const panObj = catPan.find(p => p.id === document.getElementById('pan_sel')?.value);
  const hasGen = sourceAppoint === 'groupe';

  const joursId = chargeMode==='charges' ? 'jours_auto' : 'jours_auto_wh';
  const tarifId = chargeMode==='charges' ? 'tarif_kwh'  : 'tarif_wh';

  const payload = {
    // Charges
    mode:              chargeMode,
    charges:           chargeMode==='charges'
      ? charges.map(c=>({
          nom:         c.nom||'Appareil',
          puissance_w: parseFloat(c.puiss)||0,
          quantite:    parseInt(c.qte)||1,
          duree_h:     parseFloat(c.duree)||0,
        }))
      : [],
    energie_wh:        chargeMode==='wh'
      ? parseFloat(document.getElementById('energie_wh')?.value)||0 : 0,

    jours_autonomie:    parseFloat(document.getElementById(joursId)?.value)||2,
    tarif_kwh:          parseFloat(document.getElementById(tarifId)?.value)||110,
    taux_actualisation: parseFloat(document.getElementById('taux_act')?.value)||5,
    remise_pct:         parseFloat(document.getElementById('remise_pct')?.value)||0,

    // Site
    hsp:         parseFloat(document.getElementById('hsp')?.value)||5.5,
    irr_ghi:     parseFloat(document.getElementById('irr')?.value)||5.8,
    temp_amb:    parseFloat(document.getElementById('temp_amb')?.value)||30,
    temp_min:    parseFloat(document.getElementById('temp_min')?.value)||15,
    temp_max:    parseFloat(document.getElementById('temp_max')?.value)||70,
    pr_pct:      parseFloat(document.getElementById('pr')?.value)||80,

    // Appoint
    source_appoint: sourceAppoint,

    // Panneau
    pan_puissance_wc: parseFloat(document.getElementById('pan_power')?.value)||550,
    pan_voc:          parseFloat(document.getElementById('pan_voc')?.value)||49.5,
    pan_vmp:          parseFloat(document.getElementById('pan_vmp')?.value)||41.2,
    pan_icc:          parseFloat(document.getElementById('pan_icc')?.value)||10.2,
    pan_coeff_temp:   parseFloat(document.getElementById('pan_coeff')?.value)||-0.35,
    pan_marque:       panObj ? panObj.marque : '',
    pan_modele:       panObj ? panObj.modele : '',

    // Onduleur — coeff sécurité choisi par l'utilisateur (1.2 à 1.5)
    // Le backend calcule P_inv = P_charges × coeff
    coeff_inv: parseFloat(document.getElementById('coeff_inv')?.value)||1.3,

    // Batterie — type par défaut pour tous les scénarios (backend
    // sélectionne AUTO le modèle par scénario), sauf forçage manuel
    // ci-dessous pour un scénario donné.
    bat_type:      document.getElementById('bat_type')?.value||'LiFePO4',
    bat_tension_v: parseFloat(document.getElementById('bat_v')?.value)||48,

    // Groupe
    gen_modele:     hasGen ? document.getElementById('gen_modele')?.value : null,
    gen_fuel:       hasGen ? document.getElementById('gen_fuel')?.value   : null,
    facteur_simult: hasGen ? parseFloat(document.getElementById('fac_simult')?.value)/100 : 0.8,
    eta_ge:         hasGen ? parseFloat(document.getElementById('eta_ge')?.value)/100      : 0.85,

  };

  // Prix par scénario (panneau / onduleur / batterie / groupe / câbles /
  // structure / installation / divers) — 0 = utiliser prix catalogue.
  // À l'étape Dimensionnement (avecPrix=false), les champs n'existent pas encore : tout à 0.
  ['100','75','50','30'].forEach(t=>{
    payload[`prix_panneau_${t}`]      = avecPrix ? (parseFloat(document.getElementById(`prix_panneau_${t}`)?.value)||0)      : 0;
    payload[`prix_onduleur_${t}`]     = avecPrix ? (parseFloat(document.getElementById(`prix_onduleur_${t}`)?.value)||0)     : 0;
    payload[`prix_batterie_${t}`]     = avecPrix ? (parseFloat(document.getElementById(`prix_batterie_${t}`)?.value)||0)     : 0;
    payload[`prix_groupe_${t}`]       = avecPrix ? (parseFloat(document.getElementById(`prix_groupe_${t}`)?.value)||0)       : 0;
    payload[`prix_cables_${t}`]       = avecPrix ? (parseFloat(document.getElementById(`prix_cables_${t}`)?.value)||0)       : 0;
    payload[`prix_structure_${t}`]    = avecPrix ? (parseFloat(document.getElementById(`prix_structure_${t}`)?.value)||0)    : 0;
    payload[`prix_installation_${t}`] = avecPrix ? (parseFloat(document.getElementById(`prix_installation_${t}`)?.value)||0) : 0;
    payload[`prix_divers_${t}`]       = avecPrix ? (parseFloat(document.getElementById(`prix_divers_${t}`)?.value)||0)       : 0;
  });

  // Onduleurs forcés manuellement par l'utilisateur sur le tableau de bord
  // (scénarios où le choix automatique posait un problème technique, ou
  // simplement un choix manuel), avec leur quantité en parallèle.
  Object.keys(onduleurForces).forEach(t => {
    if (onduleurForces[t]) {
      payload[`onduleur_force_${t}`]     = onduleurForces[t];
      payload[`onduleur_force_qty_${t}`] = onduleurForcesQty[t] || 1;
    }
  });

  // Batteries forcées manuellement par l'utilisateur sur le tableau de
  // bord pour un scénario donné (peut être une technologie différente
  // de bat_type), avec leur quantité de modules.
  Object.keys(batterieForces).forEach(t => {
    if (batterieForces[t]) {
      payload[`batterie_force_${t}`]     = batterieForces[t];
      payload[`batterie_force_qty_${t}`] = batterieForcesQty[t] || 1;
    }
  });

  return payload;
}

// ════════════════════════════════════════════════════
// ÉTAPE 4 — TABLEAU DE BORD TECHNIQUE (avant saisie des prix)
// ════════════════════════════════════════════════════
let dashboardScenarios = null;
let chartProdConso     = null;
let chartKwc            = null;
let onduleurForces      = {};   // { '100': 'inv_id', '75': null, ... } — choix manuel par scénario
let onduleurForcesQty   = {};   // { '100': 2, ... } — nombre d'onduleurs en parallèle pour le choix manuel
let batterieForces       = {};  // { '100': 'LiFePO4:2', ... } — choix manuel batterie par scénario
let batterieForcesQty    = {};  // { '100': 4, ... } — nombre de modules pour le choix manuel

async function lancerDimensionnement() {
  const btn = document.getElementById('btn-dimensionner');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Calcul du dimensionnement...';

  const payload = construirePayload(false);

  try {
    const r = await fetch(API + '/calculer', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    if(!r.ok) throw new Error(await r.text());
    const data = await r.json();
    if(!data.scenarios?.length) throw new Error('Aucun scénario retourné');

    dashboardScenarios = data.scenarios;
    renderDashboardTechnique(data.scenarios);

    // Pré-remplir les prix onduleur avec le prix catalogue pour chaque scénario
    data.scenarios.forEach(s => {
      const el = document.getElementById(`prix_onduleur_${s.taux_solaire}`);
      if (el && (!el.value || parseFloat(el.value) === 0) && s.onduleur.prix_fcfa) {
        el.value = s.onduleur.prix_fcfa;
        el.title = `Prix catalogue : ${s.onduleur.prix_fcfa.toLocaleString('fr-FR')} FCFA`;
      }
    });

    goStep(4);

  } catch(e) {
    console.error(e);
    alert('Erreur lors du dimensionnement : ' + e.message + '\n\nLancez : python main.py');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '&#128202; Calculer le dimensionnement &#8594;';
  }
}

// Applique un onduleur choisi manuellement pour un scénario donné
// (déclenché depuis le menu déroulant affiché sur les scénarios en erreur),
// puis relance le calcul complet des 4 scénarios avec ce forçage pris en compte.
async function appliquerOnduleurManuel(taux) {
  const sel = document.getElementById(`dash-inv-override-${taux}`);
  const qtyEl = document.getElementById(`dash-inv-qty-${taux}`);
  if (!sel || !sel.value) return;

  onduleurForces[taux]    = sel.value;
  onduleurForcesQty[taux] = Math.max(1, parseInt(qtyEl?.value) || 1);

  const btn = sel.nextElementSibling;
  const labelOrig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Recalcul…'; }

  try {
    const payload = construirePayload(false);
    const r = await fetch(API + '/calculer', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    if (!data.scenarios?.length) throw new Error('Aucun scénario retourné');

    dashboardScenarios = data.scenarios;
    renderDashboardTechnique(data.scenarios);

    data.scenarios.forEach(s => {
      const el = document.getElementById(`prix_onduleur_${s.taux_solaire}`);
      if (el && (!el.value || parseFloat(el.value) === 0) && s.onduleur.prix_fcfa) {
        el.value = s.onduleur.prix_fcfa;
      }
    });
  } catch(e) {
    console.error(e);
    alert('Erreur lors du recalcul : ' + e.message);
    if (btn) { btn.disabled = false; btn.innerHTML = labelOrig; }
  }
}

// Retire le forçage manuel d'un scénario pour revenir au choix automatique
async function retirerOnduleurManuel(taux) {
  delete onduleurForces[taux];
  delete onduleurForcesQty[taux];

  try {
    const payload = construirePayload(false);
    const r = await fetch(API + '/calculer', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    if (!data.scenarios?.length) throw new Error('Aucun scénario retourné');

    dashboardScenarios = data.scenarios;
    renderDashboardTechnique(data.scenarios);
  } catch(e) {
    console.error(e);
    alert('Erreur lors du recalcul : ' + e.message);
  }
}

// Applique une batterie choisie manuellement pour un scénario donné
// (technologie + modèle peuvent différer de bat_type, choisis dans le
// menu déroulant affiché sur la carte du scénario), avec la quantité
// de modules voulue, puis relance le calcul complet des 4 scénarios.
async function appliquerBatterieManuelle(taux) {
  const sel = document.getElementById(`dash-bat-override-${taux}`);
  const qtyEl = document.getElementById(`dash-bat-qty-${taux}`);
  if (!sel || !sel.value) return;

  batterieForces[taux]    = sel.value;
  batterieForcesQty[taux] = Math.max(1, parseInt(qtyEl?.value) || 1);

  try {
    const payload = construirePayload(false);
    const r = await fetch(API + '/calculer', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    if (!data.scenarios?.length) throw new Error('Aucun scénario retourné');

    dashboardScenarios = data.scenarios;
    renderDashboardTechnique(data.scenarios);
  } catch(e) {
    console.error(e);
    alert('Erreur lors du recalcul : ' + e.message);
  }
}

// Retire le forçage manuel de batterie d'un scénario pour revenir
// au choix automatique (technologie bat_type globale).
async function retirerBatterieManuelle(taux) {
  delete batterieForces[taux];
  delete batterieForcesQty[taux];

  try {
    const payload = construirePayload(false);
    const r = await fetch(API + '/calculer', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    if (!data.scenarios?.length) throw new Error('Aucun scénario retourné');

    dashboardScenarios = data.scenarios;
    renderDashboardTechnique(data.scenarios);
  } catch(e) {
    console.error(e);
    alert('Erreur lors du recalcul : ' + e.message);
  }
}

function _scenarioEstValide(s) {
  const pv  = s.generateur_pv;
  const inv = s.onduleur;
  const okSerie = pv.serie_ok === true;
  const okPpv   = pv.ppv_installe_kwc >= pv.ppv_calcule_kwc - 0.001;
  const okInv   = inv.etat !== 'rouge';
  return okSerie && okPpv && okInv;
}

function renderDashboardTechnique(scenarios) {
  const colors  = ['#1D4ED8','#0891B2','#7C3AED','#B45309'];

  // ── 1. Cartes de validation par scénario ─────────────────
  const valEl = document.getElementById('dash-validation');
  if (valEl) {
    const tousValides = scenarios.every(_scenarioEstValide);
    let html = '';

    if (tousValides) {
      html += `<div class="info-box" style="background:#ECFDF5;border-color:#A7F3D0;margin-bottom:1rem">
        <div class="info-title" style="color:#065F46">✅ Tous les scénarios respectent les contraintes techniques — vous pouvez continuer</div>
      </div>`;
    }

    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-bottom:1.5rem">`;
    scenarios.forEach((s, i) => {
      const ok   = _scenarioEstValide(s);
      const pv   = s.generateur_pv;
      const inv  = s.onduleur;
      const st   = s.stockage;
      const bg   = ok ? '#F0FDF4' : '#FFF1F2';
      const bord = ok ? '#86EFAC' : '#FDA4AF';
      const raisons = [];
      if (!pv.serie_ok) raisons.push(`Config ${pv.n_serie}S×${pv.n_parallele}P hors plage MPPT`);
      if (pv.ppv_installe_kwc < pv.ppv_calcule_kwc - 0.001)
        raisons.push(`Ppv inst. (${pv.ppv_installe_kwc}) < calc. (${pv.ppv_calcule_kwc})`);
      if (inv.etat === 'rouge') raisons.push(`Ratio onduleur ${inv.ratio} hors plage`);

      const etatBadge = e => {
        const m = {vert:'#059669',orange:'#D97706',rouge:'#DC2626'};
        const l = {vert:'✓ Optimal',orange:'⚠ Acceptable',rouge:'✗ Hors plage'};
        return `<span style="background:${m[e]||'#94a3b8'};color:#fff;padding:2px 8px;
          border-radius:99px;font-size:11px;font-weight:600">${l[e]||e}</span>`;
      };

      html += `<div style="background:${bg};border:2px solid ${bord};border-radius:12px;padding:16px">
        <div style="font-weight:700;font-size:15px;color:${colors[i]};margin-bottom:10px">
          ${ok ? '✅' : '❌'} Scénario ${s.taux_solaire}%
        </div>
        <div style="font-size:12px;color:#374151;line-height:2">
          <b>${pv.n_panneaux} panneaux</b> — ${pv.n_serie}S × ${pv.n_parallele}P<br>
          PV : <b>${pv.ppv_installe_kwc} kWc</b> (calc. ${pv.ppv_calcule_kwc} kWc)<br>
          Onduleur : <b>${(inv.n_unites||1) > 1 ? `${inv.n_unites} × ` : ''}${inv.marque} ${inv.modele} — ${inv.puissance_kva} kVA</b>
          ${(inv.n_unites||1) > 1 ? ` <span style="color:#64748b">(${inv.puissance_kva_totale} kVA cumulés)</span>` : ''}
          ${inv.choix_manuel ? ' <span style="background:#DBEAFE;color:#1E40AF;font-size:10px;font-weight:700;padding:1px 6px;border-radius:99px">✋ MANUEL</span>' : ''}<br>
          Ratio PV/Inv : ${inv.ratio} ${etatBadge(inv.etat)}<br>
          Config S×P : ${pv.serie_ok
            ? '<span style="color:#059669;font-weight:600">✓ Valide</span>'
            : '<span style="color:#DC2626;font-weight:600">✗ Invalide</span>'}<br>
          Batterie : <b>${st.marque} ${st.modele} × ${st.n_modules}</b> = ${st.capacite_inst_kwh} kWh
          ${st.choix_manuel ? ' <span style="background:#DBEAFE;color:#1E40AF;font-size:10px;font-weight:700;padding:1px 6px;border-radius:99px">✋ MANUEL</span>' : ''}<br>
          Autonomie : <b>${st.autonomie_heures} h</b>
        </div>
        ${raisons.length ? `<div style="margin-top:10px;font-size:11px;color:#DC2626;
          background:#FEE2E2;padding:8px 10px;border-radius:6px;line-height:1.8">
          ${raisons.map(r => `⚠ ${r}`).join('<br>')}
        </div>` : ''}
        <div style="margin-top:12px;padding-top:12px;border-top:1px dashed ${bord}">
          <label style="font-size:11px;font-weight:700;color:#374151;display:block;margin-bottom:5px">
            ${inv.choix_manuel ? 'Onduleur choisi manuellement :' : 'Choisir manuellement un autre onduleur :'}
          </label>
          <div style="display:flex;gap:6px;margin-bottom:6px">
            <select id="dash-inv-override-${s.taux_solaire}" style="flex:1;font-size:12px;
              padding:6px 8px;border:1px solid #CBD5E1;border-radius:6px">
              ${catInv.slice().sort((a,b)=>parseFloat(a.puissance_kva)-parseFloat(b.puissance_kva))
                .map(o => `<option value="${o.id}" ${String(o.id)===String(inv.id)?'selected':''}>
                  ${o.marque} ${o.modele} — ${o.puissance_kva} kVA
                </option>`).join('')}
            </select>
            <input type="number" id="dash-inv-qty-${s.taux_solaire}" min="1" max="8"
              value="${inv.n_unites||1}" title="Nombre d'onduleurs en parallèle"
              style="width:54px;font-size:12px;padding:6px 4px;text-align:center;
              border:1px solid #CBD5E1;border-radius:6px">
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm" style="flex:1"
              onclick="appliquerOnduleurManuel(${s.taux_solaire})">
              &#128260; Appliquer
            </button>
            ${inv.choix_manuel ? `<button class="btn btn-sm" style="flex:1"
              onclick="retirerOnduleurManuel(${s.taux_solaire})">
              &#8634; Revenir à l'auto
            </button>` : ''}
          </div>
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px dashed ${bord}">
          <label style="font-size:11px;font-weight:700;color:#374151;display:block;margin-bottom:5px">
            ${st.choix_manuel ? 'Batterie choisie manuellement :' : 'Choisir manuellement une autre batterie :'}
          </label>
          <div style="display:flex;gap:6px;margin-bottom:6px">
            <select id="dash-bat-override-${s.taux_solaire}" style="flex:1;font-size:12px;
              padding:6px 8px;border:1px solid #CBD5E1;border-radius:6px">
              ${Object.keys(catBat).map(type => `
                <optgroup label="${type}">
                  ${catBat[type].map((b,i) => `<option value="${type}:${i}"
                    ${(type+':'+i)===String(st.id)?'selected':''}>
                    ${b.marque} ${b.modele} — ${b.capacite_kwh} kWh
                  </option>`).join('')}
                </optgroup>`).join('')}
            </select>
            <input type="number" id="dash-bat-qty-${s.taux_solaire}" min="1" max="40"
              value="${st.n_modules||1}" title="Nombre de modules"
              style="width:54px;font-size:12px;padding:6px 4px;text-align:center;
              border:1px solid #CBD5E1;border-radius:6px">
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm" style="flex:1"
              onclick="appliquerBatterieManuelle(${s.taux_solaire})">
              &#128260; Appliquer
            </button>
            ${st.choix_manuel ? `<button class="btn btn-sm" style="flex:1"
              onclick="retirerBatterieManuelle(${s.taux_solaire})">
              &#8634; Revenir à l'auto
            </button>` : ''}
          </div>
        </div>
      </div>`;
    });
    html += '</div>';
    valEl.innerHTML = html;
  }

  // ── 2. Tableau technique complet ─────────────────────────
  const tblEl = document.getElementById('dash-table-container');
  if (tblEl) {
    const etatBadge = e => {
      const m = {vert:'#059669',orange:'#D97706',rouge:'#DC2626'};
      const l = {vert:'✓ Optimal',orange:'⚠ Acceptable',rouge:'✗ Hors plage'};
      return `<span style="background:${m[e]||'#94a3b8'};color:#fff;padding:2px 7px;
        border-radius:99px;font-size:11px;font-weight:600">${l[e]||e}</span>`;
    };

    const sections = [
      { titre: '⚡ Générateur PV', rows: [
        ['Ppv calculé (kWc)',        s => s.generateur_pv.ppv_calcule_kwc],
        ['Ppv installé (kWc)',       s => s.generateur_pv.ppv_installe_kwc],
        ['Écart sur-dim. (%)',       s => `+${s.generateur_pv.ecart_pct}%`],
        ['Nombre de panneaux',       s => s.generateur_pv.n_panneaux],
        ['Config S × P',             s => `${s.generateur_pv.n_serie}S × ${s.generateur_pv.n_parallele}P`],
        ['Ns min MPPT',              s => s.generateur_pv.nserie_mppt_min],
        ['Ns max MPPT',              s => s.generateur_pv.nserie_mppt_max],
        ['Ns max absolu',            s => s.generateur_pv.nserie_max],
        ['Config valide',            s => s.generateur_pv.serie_ok ? '✅ Oui' : '❌ Non'],
        ['Production annuelle (kWh)',s => (s.generateur_pv.prod_annuelle_kwh||0).toLocaleString('fr-FR')],
        ['Rendement système η (%)',  s => s.generateur_pv.eta_systeme],
      ]},
      { titre: '🌡 Correction thermique', rows: [
        ['Voc corrigée Tmin (V)',    s => s.correction_thermique.voc_corr_v],
        ['Vmp corrigée Tmax (V)',    s => s.correction_thermique.vmp_corr_min_v],
        ['Vmp corrigée Tmin (V)',    s => s.correction_thermique.vmp_corr_max_v],
        ['Tension Voc string (V)',   s => s.correction_thermique.vstr_voc],
        ['Tension Vmp string min (V)',s => s.correction_thermique.vstr_vmp_min],
        ['Tension Vmp string max (V)',s => s.correction_thermique.vstr_vmp_max],
      ]},
      { titre: '🔌 Onduleur', rows: [
        ['Marque / Modèle',          s => `${s.onduleur.marque} ${s.onduleur.modele}`],
        ['Puissance (kVA)',          s => s.onduleur.puissance_kva],
        ['Rendement (%)',            s => s.onduleur.rendement],
        ['Puissance requise (kVA)',  s => s.onduleur.p_inv_requise],
        ['Ratio PV/onduleur',        s => s.onduleur.ratio],
        ['État dimensionnement',     s => etatBadge(s.onduleur.etat)],
      ]},
      { titre: '🔋 Stockage', rows: [
        ['Technologie',              s => s.stockage.type],
        ['Marque / Modèle',         s => `${s.stockage.marque} ${s.stockage.modele}`],
        ['Jours autonomie eff.',     s => s.stockage.jours_autonomie],
        ['Capacité requise (kWh)',   s => s.stockage.capacite_req_kwh],
        ['Capacité requise (Ah)',    s => s.stockage.capacite_req_ah],
        ['Capacité unitaire (kWh)',  s => s.stockage.capacite_u_kwh],
        ['Nombre de modules',        s => s.stockage.n_modules],
        ['Capacité installée (kWh)', s => s.stockage.capacite_inst_kwh],
        ['DOD (%)',                  s => s.stockage.dod_pct],
        ['Autonomie (h)',            s => s.stockage.autonomie_heures],
      ]},
      { titre: '🔧 Câbles & Protections', rows: [
        ['Câble DC — section (mm²)', s => s.cables.dc.section_mm2],
        ['Câble DC — I champ (A)',   s => s.cables.dc.i_champ_a],
        ['Câble DC — I chaîne (A)',  s => s.cables.dc.i_chaine_a],
        ['Câble AC — section (mm²)', s => s.cables.ac.section_mm2],
        ['Câble AC — courant (A)',   s => s.cables.ac.i_ac_a],
        ['Câble batterie (mm²)',     s => s.cables.batterie.section_mm2],
        ['Câble batterie I (A)',     s => s.cables.batterie.i_bat_a],
        ['Câble régulateur (mm²)',   s => s.cables.regulateur.section_mm2],
        ['Fusible chaîne',           s => s.protections.fus_chaine_calibre || `${s.protections.fus_chaine_a} A`],
        ['Fusible champ',            s => s.protections.fus_champ_calibre  || `${s.protections.fus_champ_a} A`],
        ['Disjoncteur AC',           s => s.protections.disj_ac_calibre    || `Disjoncteur ${s.protections.disj_ac_a} A`],
        ['Disjoncteur batterie',     s => s.protections.disj_dc_bat_calibre|| `Disjoncteur ${s.protections.disj_bat_a} A`],
        ['Parafoudre DC',            s => s.cables.parafoudre_dc?.label || '—'],
        ['Conformité IEC 60364',     s => s.protections.conformite_iec?.conforme
                                          ? '✅ Conforme'
                                          : `⚠ ${(s.protections.conformite_iec?.alertes||[]).length} alerte(s)`],
      ]},
      { titre: '📊 Énergie & Couverture', rows: [
        ['Consommation brute (kWh/j)',  s => s.energie.e_brute_kwh_j],
        ['Énergie PV couverte (kWh/j)', s => s.energie.e_pv_kwh_j],
        ['Énergie appoint (kWh/j)',     s => s.energie.e_appoint_kwh_j],
        ['Production jour (kWh/j)',     s => s.energie.prod_jour_kwh],
        ['Couverture solaire (%)',       s => `${s.energie.couverture_pct}%`],
        ['CO₂ évité (kg/an)',           s => (s.rentabilite.co2_kg_an||0).toLocaleString('fr-FR')],
      ]},
    ];

    let tbl = `<div class="card">
      <div class="card-title">📋 Résultats techniques complets — 4 scénarios</div>
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#F8FAFC">
            <th style="text-align:left;padding:9px 14px;border-bottom:2px solid #E2E8F0;min-width:200px">Paramètre</th>
            ${scenarios.map((s,i) => `
            <th style="text-align:center;padding:9px 14px;border-bottom:2px solid #E2E8F0;
              color:${colors[i]};white-space:nowrap">
              Scénario ${s.taux_solaire}%
            </th>`).join('')}
          </tr>
        </thead>
        <tbody>`;

    sections.forEach(sec => {
      tbl += `<tr><td colspan="${scenarios.length+1}" style="padding:10px 14px 4px;
        font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;
        color:#64748B;background:#F1F5F9;border-top:2px solid #E2E8F0">
        ${sec.titre}</td></tr>`;
      sec.rows.forEach(([label, fn], ri) => {
        const bg = ri % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        tbl += `<tr style="background:${bg}">
          <td style="padding:7px 14px;color:#374151;font-weight:500;
            border-bottom:1px solid #F1F5F9">${label}</td>
          ${scenarios.map(s => `
          <td style="padding:7px 14px;text-align:center;border-bottom:1px solid #F1F5F9">
            ${fn(s) ?? '—'}
          </td>`).join('')}
        </tr>`;
      });
    });

    tbl += `</tbody></table></div></div>`;
    tblEl.innerHTML = tbl;
  }

  // ── 3. Graphique : Production vs Consommation ─────────────
  const ctx1 = document.getElementById('chart-prod-conso');
  if (ctx1) {
    if (chartProdConso) { chartProdConso.destroy(); chartProdConso = null; }
    const eBrute = scenarios[0]?.energie.e_brute_kwh_j || 0;
    chartProdConso = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: scenarios.map(s => `Scénario ${s.taux_solaire}%`),
        datasets: [
          {
            label: 'Production PV (kWh/j)',
            data: scenarios.map(s => +(s.energie.prod_jour_kwh||0).toFixed(2)),
            backgroundColor: 'rgba(245,158,11,0.8)',
            borderColor: '#F59E0B', borderWidth: 1.5, borderRadius: 5,
          },
          {
            label: 'Appoint (kWh/j)',
            data: scenarios.map(s => +(s.energie.e_appoint_kwh_j||0).toFixed(2)),
            backgroundColor: 'rgba(100,116,139,0.45)',
            borderColor: '#64748B', borderWidth: 1.5, borderRadius: 5,
          },
          {
            label: 'Consommation totale (kWh/j)',
            data: scenarios.map(() => +eBrute.toFixed(2)),
            type: 'line',
            borderColor: '#DC2626', borderWidth: 2.5, borderDash: [6,3],
            pointRadius: 5, fill: false, tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 } } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y} kWh/j` } },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true,
               title: { display: true, text: 'kWh/j', font: { size: 11 } } },
        },
      },
    });
  }

  // ── 4. Graphique : kWc installé par scénario ─────────────
  const ctx2 = document.getElementById('chart-kwc');
  if (ctx2) {
    if (chartKwc) { chartKwc.destroy(); chartKwc = null; }
    chartKwc = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: scenarios.map(s => `Scénario ${s.taux_solaire}%`),
        datasets: [
          {
            label: 'Ppv installé (kWc)',
            data: scenarios.map(s => s.generateur_pv.ppv_installe_kwc),
            backgroundColor: scenarios.map((_,i) => colors[i].replace(')',',0.75)').replace('#','rgba(').replace(/([0-9a-f]{2})/gi, m => parseInt(m,16)+',')),
            backgroundColor: ['rgba(29,78,216,0.75)','rgba(8,145,178,0.75)',
                              'rgba(124,58,237,0.75)','rgba(180,83,9,0.75)'],
            borderColor: colors, borderWidth: 1.5, borderRadius: 7,
          },
          {
            label: 'Ppv calculé (kWc)',
            data: scenarios.map(s => s.generateur_pv.ppv_calcule_kwc),
            type: 'line',
            borderColor: '#DC2626', borderWidth: 2, borderDash: [5,3],
            pointRadius: 5, fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 } } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y} kWc` } },
        },
        scales: {
          y: { beginAtZero: true,
               title: { display: true, text: 'kWc', font: { size: 11 } } },
        },
      },
    });
  }
}

function validerDimensionnement() {
  if (!dashboardScenarios) {
    alert('Veuillez d\'abord calculer le dimensionnement.');
    return;
  }
  const tousValides = dashboardScenarios.every(_scenarioEstValide);
  if (!tousValides) {
    alert('Certains scénarios présentent des problèmes techniques (voir le tableau ci-dessus). Corrigez les paramètres (panneaux, onduleur, tensions) avant de continuer.');
    return;
  }
  goStep(5);
}

async function lancerCalcul() {
  const btn = document.getElementById('btn-calc');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Génération des 4 scénarios...';

  const payload = construirePayload(true);

  try {
    const r = await fetch(API + '/calculer', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    if(!r.ok) throw new Error(await r.text());
    const data = await r.json();
    if(!data.scenarios?.length) throw new Error('Aucun scénario retourné');

    scenariosResult = data.scenarios;

    // Log vérification console
    console.log('=== SCÉNARIOS ===');
    data.scenarios.forEach(s => {
      const pv=s.generateur_pv, inv=s.onduleur, st=s.stockage;
      const ok = pv.ppv_installe_kwc >= pv.ppv_calcule_kwc - 0.001 ? '✓' : '✗';
      console.log(
        `${s.taux_solaire}%` +
        ` | calc=${pv.ppv_calcule_kwc}kWc inst=${pv.ppv_installe_kwc}kWc ${ok}` +
        ` | ${pv.n_panneaux}pan ${pv.n_serie}S×${pv.n_parallele}P` +
        ` | ${inv.marque} ${inv.modele} ${inv.puissance_kva}kVA` +
        ` | ${st.marque} ×${st.n_modules}=${st.capacite_inst_kwh}kWh` +
        ` | ${s.budget.total_net.toLocaleString()}FCFA`
      );
    });

    const saved = await sauvegarderProjet({
      id:             currentProjetId,
      nom_projet:     document.getElementById('nom_projet')?.value||'Sans nom',
      nom_client:     document.getElementById('nom_client')?.value||'',
      contact:        document.getElementById('contact_client')?.value||'',
      adresse:        document.getElementById('adresse_client')?.value||'',
      nom_site:       document.getElementById('nom_site')?.value||'',
      pays:           document.getElementById('pays')?.value||'',
      ingenieur:      document.getElementById('ingenieur')?.value||'',
      ref_projet:     document.getElementById('ref_projet')?.value||'',
      type_projet:    projectType,
      source_appoint: sourceAppoint,
      statut:         'calcule',
      scenarios:      data.scenarios,
    });
    currentProjetId = saved.id;

    renderScenarios(data.scenarios);
    goStep(6);

  } catch(e) {
    console.error(e);
    alert('Erreur : ' + e.message + '\n\nLancez : python main.py');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '&#9881; Générer les 4 scénarios';
  }
}


function renderScenarios(scenarios) {
  const bestIdx = scenarios.reduce((best,s,i) =>
    s.rentabilite.van_20ans > scenarios[best].rentabilite.van_20ans ? i : best, 0);

  const SC = {
    100:{cls:'sc-100',titre:'100% Solaire',desc:'Autonomie maximale'},
    75: {cls:'sc-75', titre:'75% Solaire', desc:'Économique optimal'},
    50: {cls:'sc-50', titre:'50% Solaire', desc:'Équilibre'},
    30: {cls:'sc-30', titre:'30% Solaire', desc:'Investissement minimal'},
  };
  const APPOINT = {reseau:'Réseau électrique', groupe:'Groupe électrogène'};

  let html = `<div class="scenarios-grid">`;

  scenarios.forEach((s,i) => {
    const r  = s.rentabilite, b = s.budget;
    const pv = s.generateur_pv, st = s.stockage, inv = s.onduleur;
    const en = s.energie, sc = SC[s.taux_solaire];
    const best = i===bestIdx && b.total_net>0;
    const invCls = inv.etat==='vert'?'c-green':inv.etat==='orange'?'c-sun':'c-red';

    html += `
    <div class="scenario-card" id="sc-card-${i}">
      ${best?'<div class="sc-best">&#9733; Recommandé</div>':''}
      <span class="sc-badge ${sc.cls}">${sc.titre}</span>
      <div class="sc-titre">${sc.desc}</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:8px">
        Appoint : ${APPOINT[s.source_appoint]||s.source_appoint}
      </div>

      <!-- Énergie -->
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:11px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="color:#64748b">&#9728; Solaire</span>
          <strong style="color:#D97706">${en.e_pv_kwh_j} kWh/j</strong>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:#64748b">&#9889; Appoint</span>
          <strong style="color:#2563EB">${en.e_appoint_kwh_j} kWh/j</strong>
        </div>
      </div>

      <!-- PV -->
      <div class="sc-section-title">&#9728; Générateur PV</div>
      <div class="sc-row">
        <span class="lbl">Ppv calculée</span>
        <span class="val" style="color:#94a3b8;font-size:11px">
          ${pv.ppv_calcule_kwc} kWc
        </span>
      </div>
      <div class="sc-row">
        <span class="lbl">Ppv installée</span>
        <span class="val c-sun"><strong>${pv.ppv_installe_kwc} kWc</strong></span>
      </div>
      <div class="sc-row">
        <span class="lbl">Panneaux</span>
        <span class="val"><strong>${pv.n_panneaux}</strong> unités</span>
      </div>
      <div class="sc-row">
        <span class="lbl">Configuration</span>
        <span class="val ${pv.serie_ok?'c-green':'c-red'}">
          ${pv.n_serie}S × ${pv.n_parallele}P
          ${pv.serie_ok?'&#10003;':'&#10005;'}
        </span>
      </div>

      <!-- Onduleur -->
      <div class="sc-section-title" style="margin-top:8px">&#9889; Onduleur</div>
      <div class="sc-row">
        <span class="lbl" style="font-size:10px">${inv.marque} ${inv.modele}</span>
        <span class="val"><strong>${inv.puissance_kva} kVA</strong></span>
      </div>
      <div class="sc-row">
        <span class="lbl">Ratio DC/AC</span>
        <span class="val ${invCls}">
          ${inv.ratio} ${inv.etat==='vert'?'&#10003;':'&#9888;'}
        </span>
      </div>
      <div class="sc-row">
        <span class="lbl">Prix</span>
        <span class="val">
          ${inv.prix_fcfa>0?inv.prix_fcfa.toLocaleString('fr-FR')+' FCFA':'—'}
        </span>
      </div>

      <!-- Batteries -->
      <div class="sc-section-title" style="margin-top:8px">&#128267; Batteries</div>
      <div class="sc-row">
        <span class="lbl" style="font-size:10px">${st.marque} ${st.modele}</span>
        <span class="val c-bat"><strong>${st.capacite_inst_kwh} kWh</strong></span>
      </div>
      <div class="sc-row">
        <span class="lbl">Modules</span>
        <span class="val">${st.n_modules} × ${st.capacite_u_kwh} kWh</span>
      </div>
      <div class="sc-row">
        <span class="lbl">Autonomie</span>
        <span class="val">${st.jours_autonomie}j / ${st.autonomie_heures}h</span>
      </div>

      <!-- Coût -->
      <div class="sc-divider">
        <div class="sc-row">
          <span class="lbl"><strong>Coût total</strong></span>
          <span class="val" style="color:#D97706;font-weight:700">
            ${b.total_net>0?(b.total_net/1e6).toFixed(2)+' M FCFA':'—'}
          </span>
        </div>
        <div class="sc-row">
          <span class="lbl">Économies/an</span>
          <span class="val c-green">
            ${(r.economies_annuelles/1000).toFixed(0)} k FCFA
          </span>
        </div>
        <div class="sc-row">
          <span class="lbl">Temps de retour</span>
          <span class="val">${r.temps_retour_ans!=null && r.temps_retour_ans<100?r.temps_retour_ans+' ans':'N/A'}</span>
        </div>
        <div class="sc-row">
          <span class="lbl">TRI (rentabilité)</span>
          <span class="val">${r.tri_pct!=null?r.tri_pct+' %':'N/A'}</span>
        </div>
        <div class="sc-row">
          <span class="lbl">VAN 20 ans</span>
          <span class="val ${r.van_20ans>0?'c-green':'c-red'}">
            ${r.van_20ans>0?'+':''}${(r.van_20ans/1e6).toFixed(2)} M FCFA
          </span>
        </div>
      </div>

      <button class="btn btn-primary" style="width:100%;margin-top:10px"
        onclick="selectionnerScenario(${i})">
        Choisir ce scénario &#8594;
      </button>
    </div>`;
  });

  html += `</div>`;

  // Tableau comparatif
  html += `
  <div class="card" style="margin-top:1.5rem">
    <div class="card-title">Tableau comparatif des 4 scénarios</div>
    <div style="overflow-x:auto"><table>
      <thead><tr>
        <th style="min-width:200px">Critère</th>
        ${scenarios.map(s=>`
        <th style="text-align:center">
          <span class="sc-badge ${SC[s.taux_solaire].cls}">${s.taux_solaire}%</span>
        </th>`).join('')}
      </tr></thead>
      <tbody>
        <tr style="background:#FFFBEB">
          <td><strong>Ppv calculée</strong></td>
          ${scenarios.map(s=>`<td style="text-align:center;color:#94a3b8">
            ${s.generateur_pv.ppv_calcule_kwc} kWc</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Ppv installée (≥ calculée)</strong></td>
          ${scenarios.map(s=>`<td style="text-align:center;font-weight:800;color:#D97706;font-size:14px">
            ${s.generateur_pv.ppv_installe_kwc} kWc</td>`).join('')}
        </tr>
        <tr style="background:#f8fafc">
          <td>Panneaux</td>
          ${scenarios.map(s=>`<td style="text-align:center;font-weight:700">
            ${s.generateur_pv.n_panneaux}</td>`).join('')}
        </tr>
        <tr>
          <td>Configuration (S×P)</td>
          ${scenarios.map(s=>`<td style="text-align:center">
            ${s.generateur_pv.n_serie}S × ${s.generateur_pv.n_parallele}P</td>`).join('')}
        </tr>
        <tr style="background:#EFF6FF">
          <td><strong>Onduleur</strong></td>
          ${scenarios.map(s=>`<td style="text-align:center;font-size:11px">
            <strong>${s.onduleur.marque}</strong><br>${s.onduleur.modele}</td>`).join('')}
        </tr>
        <tr>
          <td>Puissance onduleur</td>
          ${scenarios.map(s=>`<td style="text-align:center;font-weight:700">
            ${s.onduleur.puissance_kva} kVA</td>`).join('')}
        </tr>
        <tr style="background:#f8fafc">
          <td>Prix onduleur (FCFA)</td>
          ${scenarios.map(s=>`<td style="text-align:center">
            ${s.onduleur.prix_fcfa>0?s.onduleur.prix_fcfa.toLocaleString('fr-FR'):'—'}</td>`).join('')}
        </tr>
        <tr style="background:#F5F3FF">
          <td><strong>Batterie</strong></td>
          ${scenarios.map(s=>`<td style="text-align:center;font-size:11px">
            <strong>${s.stockage.marque}</strong><br>${s.stockage.modele}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Stockage installé</strong></td>
          ${scenarios.map(s=>`<td style="text-align:center;font-weight:800;color:#7C3AED;font-size:14px">
            ${s.stockage.capacite_inst_kwh} kWh</td>`).join('')}
        </tr>
        <tr style="background:#f8fafc">
          <td>Modules batteries</td>
          ${scenarios.map(s=>`<td style="text-align:center">
            ${s.stockage.n_modules} × ${s.stockage.capacite_u_kwh} kWh</td>`).join('')}
        </tr>
        <tr>
          <td>Autonomie</td>
          ${scenarios.map(s=>`<td style="text-align:center">
            ${s.stockage.jours_autonomie}j / ${s.stockage.autonomie_heures}h</td>`).join('')}
        </tr>
        <tr style="background:#FFFBEB">
          <td><strong>Coût total (FCFA)</strong></td>
          ${scenarios.map(s=>`<td style="text-align:center;font-weight:800;color:#D97706">
            ${s.budget.total_net>0?s.budget.total_net.toLocaleString('fr-FR'):'—'}</td>`).join('')}
        </tr>
        <tr>
          <td>Économies/an</td>
          ${scenarios.map(s=>`<td style="text-align:center">
            ${s.rentabilite.economies_annuelles.toLocaleString('fr-FR')}</td>`).join('')}
        </tr>
        <tr style="background:#f8fafc">
          <td>Temps de retour (années)</td>
          ${scenarios.map(s=>`<td style="text-align:center;font-weight:700">
            ${s.rentabilite.temps_retour_ans!=null && s.rentabilite.temps_retour_ans<100?s.rentabilite.temps_retour_ans:'—'}</td>`).join('')}
        </tr>
        <tr>
          <td>TRI (%)</td>
          ${scenarios.map(s=>`<td style="text-align:center;font-weight:700">
            ${s.rentabilite.tri_pct!=null?s.rentabilite.tri_pct+'%':'—'}</td>`).join('')}
        </tr>
        <tr>
          <td>VAN 20 ans (FCFA)</td>
          ${scenarios.map(s=>`<td style="text-align:center;font-weight:700;
            ${s.rentabilite.van_20ans>0?'color:#059669':'color:#DC2626'}">
            ${s.rentabilite.van_20ans.toLocaleString('fr-FR')}</td>`).join('')}
        </tr>
        <tr style="background:#f8fafc">
          <td>LCOE (FCFA/kWh)</td>
          ${scenarios.map(s=>`<td style="text-align:center">
            ${s.rentabilite.lcoe_fcfa_kwh}</td>`).join('')}
        </tr>
        <tr style="background:#ECFDF5">
          <td>CO₂ évité (t/an)</td>
          ${scenarios.map(s=>`<td style="text-align:center;color:#059669;font-weight:600">
            ${(s.rentabilite.co2_kg_an/1000).toFixed(1)}</td>`).join('')}
        </tr>
      </tbody>
    </table></div>
  </div>`;

  document.getElementById('scenarios-container').innerHTML = html;
}

function selectionnerScenario(idx) {
  if(!scenariosResult) return;
  document.querySelectorAll('.scenario-card').forEach((c,i) =>
    c.classList.toggle('selected', i===idx));
  const s = scenariosResult[idx];
  const p = projets.find(x => x.id === currentProjetId) || {};
  renderRapport(s, p);
  renderRapportFinancier(s, p);
  if (typeof switchRapportTab === 'function') switchRapportTab('technique');
  goStep(7);
}