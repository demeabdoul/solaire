// ════════════════════════════════════════════════════════════
// SCHÉMA UNIFILAIRE — symboles électriques normalisés IEC,
// généré dynamiquement à partir des données réelles du scénario
// (config S×P, onduleur(s), protections, batteries, appoint).
// Une ligne de gauche à droite : Champ PV → sectionneur DC →
// parafoudre DC → onduleur → disjoncteur AC → inverseur de
// source (réseau/groupe) → tableau de charges, avec la branche
// batterie (disjoncteur DC dédié) en dérivation sous l'onduleur.
// ════════════════════════════════════════════════════════════
function genererSchemaCablage(scenario) {
  const pv  = scenario.generateur_pv || {};
  const inv = scenario.onduleur      || {};
  const st  = scenario.stockage      || {};
  const ge  = scenario.groupe        || null;
  const cab = scenario.cables        || {};
  const cab_dc  = cab.dc          || {};
  const cab_ac  = cab.ac          || {};
  const cab_bat = cab.batterie    || {};
  const spd     = cab.parafoudre_dc || {};
  const prot    = cab.protections || {};
  const appoint = scenario.source_appoint === 'groupe' ? 'groupe' : 'reseau';
  const nInv = inv.n_unites || 1;
  const na = v => (v !== undefined && v !== null && v !== '') ? v : '—';

  const labelAppoint = appoint === 'groupe'
    ? `Groupe électrogène ${na(ge?.puissance_kw)} kW`
    : 'Réseau public BT';

  const M = '#334155';
  const W = 680, H = 400;
  const yMain = 130;

  return `
<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg"
     style="font-family:'Segoe UI',Arial,sans-serif">
  <defs>
    <marker id="schGnd" viewBox="0 0 10 10" refX="5" refY="9" markerWidth="8" markerHeight="8">
      <line x1="0" y1="9" x2="10" y2="9" stroke="${M}" stroke-width="1"/>
    </marker>
  </defs>

  <text x="30" y="28" font-size="11" font-weight="700" fill="${M}">Champ PV</text>
  <text x="30" y="42" font-size="9" fill="#64748b">
    ${na(pv.n_panneaux)} panneaux — ${na(pv.n_serie)}S × ${na(pv.n_parallele)}P — ${na(pv.ppv_installe_kwc)} kWc
  </text>
  <g stroke="${M}" stroke-width="1" fill="none">
    <line x1="40" y1="52" x2="40" y2="${yMain}"/>
    <line x1="30" y1="56" x2="50" y2="56"/>
    <line x1="33" y1="62" x2="47" y2="62"/>
    <line x1="36" y1="68" x2="44" y2="68"/>
  </g>
  <line x1="40" y1="${yMain}" x2="100" y2="${yMain}" stroke="${M}" stroke-width="1.25"/>
  <text x="55" y="${yMain-10}" font-size="9" fill="#64748b">
    ${na(cab_dc.i_champ_a)} A DC — ${na(cab_dc.section_mm2)} mm²
  </text>

  <g stroke="${M}" stroke-width="1.25" fill="none">
    <line x1="100" y1="${yMain}" x2="112" y2="${yMain}"/>
    <line x1="112" y1="${yMain}" x2="128" y2="${yMain-14}"/>
    <circle cx="112" cy="${yMain}" r="2" fill="${M}" stroke="none"/>
    <circle cx="128" cy="${yMain}" r="2" fill="${M}" stroke="none"/>
    <line x1="128" y1="${yMain}" x2="146" y2="${yMain}"/>
  </g>
  <text x="113" y="${yMain+20}" font-size="8" fill="#64748b" text-anchor="middle">
    <tspan x="113">Sectionneur</tspan><tspan x="113" dy="10">DC</tspan>
  </text>
  <text x="113" y="${yMain+48}" font-size="8" fill="#64748b" text-anchor="middle">
    ${na(prot.fus_champ_calibre)}
  </text>

  <line x1="146" y1="${yMain}" x2="146" y2="${yMain-46}" stroke="${M}" stroke-width="1" fill="none"/>
  <path d="M140,${yMain-46} L152,${yMain-46} L146,${yMain-58} Z" fill="none" stroke="${M}" stroke-width="1"/>
  <g stroke="${M}" stroke-width="1" fill="none">
    <line x1="146" y1="${yMain-58}" x2="146" y2="${yMain-66}"/>
    <line x1="138" y1="${yMain-66}" x2="154" y2="${yMain-66}"/>
    <line x1="141" y1="${yMain-70}" x2="151" y2="${yMain-70}"/>
    <line x1="144" y1="${yMain-74}" x2="148" y2="${yMain-74}"/>
  </g>
  <text x="160" y="${yMain-56}" font-size="8" fill="#64748b">Parafoudre DC</text>
  <text x="160" y="${yMain-46}" font-size="8" fill="#64748b">${na(spd.tension_max_v)} V — Type ${na(spd.type)}</text>

  <line x1="146" y1="${yMain}" x2="220" y2="${yMain}" stroke="${M}" stroke-width="1.25"/>

  <rect x="220" y="${yMain-36}" width="120" height="72" rx="4" fill="none" stroke="${M}" stroke-width="1.25"/>
  <circle cx="265" cy="${yMain-2}" r="13" fill="none" stroke="${M}" stroke-width="1"/>
  <path d="M256,${yMain-2} L274,${yMain-2}" stroke="${M}" stroke-width="1" fill="none"/>
  <path d="M256,${yMain+2} Q261,${yMain-7} 265,${yMain-2} Q269,${yMain+3} 274,${yMain-2}" fill="none" stroke="${M}" stroke-width="1"/>
  <text x="280" y="${yMain-12}" font-size="9" fill="${M}" font-weight="700">~</text>
  <text x="226" y="${yMain-22}" font-size="9" font-weight="700" fill="${M}">Onduleur hybride</text>
  <text x="226" y="${yMain+22}" font-size="8" fill="#64748b">${na(inv.marque)} ${na(inv.modele)}</text>
  <text x="226" y="${yMain+32}" font-size="8" fill="#64748b">
    ${(nInv>1?`${nInv}× `:'')}${na(inv.puissance_kva)} kVA${nInv>1?` (${na(inv.puissance_kva_totale)} kVA cumulés)`:''}
  </text>

  <line x1="280" y1="${yMain+36}" x2="280" y2="${yMain+66}" stroke="${M}" stroke-width="1" fill="none"/>
  <g stroke="${M}" stroke-width="1.25" fill="none">
    <line x1="280" y1="${yMain+66}" x2="280" y2="${yMain+78}"/>
    <line x1="280" y1="${yMain+78}" x2="296" y2="${yMain+92}"/>
    <circle cx="280" cy="${yMain+78}" r="2" fill="${M}" stroke="none"/>
    <circle cx="296" cy="${yMain+92}" r="2" fill="${M}" stroke="none"/>
    <line x1="280" y1="${yMain+92}" x2="280" y2="${yMain+104}"/>
    <line x1="280" y1="${yMain+78}" x2="280" y2="${yMain+92}" opacity="0"/>
  </g>
  <line x1="280" y1="${yMain+78}" x2="280" y2="${yMain+92}" stroke="${M}" stroke-width="1.25" fill="none"/>
  <text x="296" y="${yMain+88}" font-size="8" fill="#64748b">${na(prot.disj_dc_bat_calibre)}</text>
  <line x1="280" y1="${yMain+104}" x2="280" y2="${yMain+130}" stroke="${M}" stroke-width="1" fill="none"/>
  <text x="262" y="${yMain+62}" font-size="8" fill="#64748b" text-anchor="end">
    ${na(cab_bat.i_bat_a)} A — ${na(cab_bat.section_mm2)} mm²
  </text>

  <rect x="220" y="${yMain+130}" width="120" height="48" rx="4" fill="none" stroke="${M}" stroke-width="1.25"/>
  <g stroke="${M}" stroke-width="1" fill="none">
    <line x1="238" y1="${yMain+146}" x2="238" y2="${yMain+162}"/>
    <line x1="238" y1="${yMain+146}" x2="246" y2="${yMain+146}"/>
    <line x1="238" y1="${yMain+162}" x2="246" y2="${yMain+162}"/>
    <line x1="246" y1="${yMain+142}" x2="246" y2="${yMain+150}" stroke-width="2"/>
    <line x1="246" y1="${yMain+158}" x2="246" y2="${yMain+166}" stroke-width="2"/>
  </g>
  <text x="256" y="${yMain+150}" font-size="9" font-weight="700" fill="${M}">Batteries</text>
  <text x="256" y="${yMain+162}" font-size="8" fill="#64748b">${na(st.marque)} ${na(st.modele)} × ${na(st.n_modules)}</text>
  <text x="256" y="${yMain+172}" font-size="8" fill="#64748b">${na(st.capacite_inst_kwh)} kWh installés</text>

  <line x1="340" y1="${yMain}" x2="370" y2="${yMain}" stroke="${M}" stroke-width="1.25" fill="none"/>
  <g stroke="${M}" stroke-width="1.25" fill="none">
    <line x1="370" y1="${yMain}" x2="382" y2="${yMain}"/>
    <line x1="382" y1="${yMain}" x2="398" y2="${yMain-14}"/>
    <circle cx="382" cy="${yMain}" r="2" fill="${M}" stroke="none"/>
    <circle cx="398" cy="${yMain}" r="2" fill="${M}" stroke="none"/>
    <line x1="398" y1="${yMain}" x2="416" y2="${yMain}"/>
  </g>
  <text x="383" y="${yMain+18}" font-size="8" fill="#64748b" text-anchor="middle">
    <tspan x="383">Disjoncteur</tspan><tspan x="383" dy="10">AC</tspan>
  </text>
  <text x="383" y="${yMain+44}" font-size="8" fill="#64748b" text-anchor="middle">${na(prot.disj_ac_calibre)}</text>
  <text x="383" y="${yMain-20}" font-size="8" fill="#64748b" text-anchor="middle">
    ${na(cab_ac.i_ac_a)} A — ${na(cab_ac.section_mm2)} mm²
  </text>

  <line x1="416" y1="${yMain}" x2="450" y2="${yMain}" stroke="${M}" stroke-width="1.25" fill="none"/>

  <g fill="none" stroke="${M}" stroke-width="1.25">
    <line x1="450" y1="${yMain}" x2="450" y2="${yMain-50}"/>
    <line x1="450" y1="${yMain-50}" x2="450" y2="${yMain-62}"/>
    <line x1="450" y1="${yMain}" x2="450" y2="${yMain+50}"/>
    <line x1="450" y1="${yMain+50}" x2="450" y2="${yMain+62}"/>
    <circle cx="450" cy="${yMain}" r="2.5" fill="${M}" stroke="none"/>
  </g>
  <line x1="450" y1="${yMain-62}" x2="478" y2="${yMain-62}" stroke="${M}" stroke-width="1.25" fill="none"/>
  <line x1="450" y1="${yMain+62}" x2="478" y2="${yMain+62}" stroke="${M}" stroke-width="1.25" fill="none"/>
  <text x="438" y="${yMain-30}" font-size="8" fill="#64748b" text-anchor="end">Source 1</text>
  <text x="438" y="${yMain+78}" font-size="8" fill="#64748b" text-anchor="end">Source 2</text>
  <text x="408" y="${yMain+14}" font-size="8" fill="#64748b" text-anchor="middle">
    <tspan x="408">Inverseur</tspan><tspan x="408" dy="9">de source</tspan>
  </text>

  <rect x="478" y="${yMain-78}" width="150" height="32" rx="4"
        fill="${appoint==='groupe'?'#FEF2F2':'#EFF6FF'}"
        stroke="${appoint==='groupe'?'#DC2626':'#2563EB'}" stroke-width="1"/>
  <text x="553" y="${yMain-66}" text-anchor="middle" font-size="9" font-weight="700"
        fill="${appoint==='groupe'?'#991B1B':'#1E40AF'}">Production solaire</text>
  <text x="553" y="${yMain-55}" text-anchor="middle" font-size="8"
        fill="${appoint==='groupe'?'#991B1B':'#1E40AF'}">Onduleur / batteries</text>

  <rect x="478" y="${yMain+46}" width="150" height="32" rx="4"
        fill="${appoint==='groupe'?'#FEF2F2':'#EFF6FF'}"
        stroke="${appoint==='groupe'?'#DC2626':'#2563EB'}" stroke-width="1"/>
  <text x="553" y="${yMain+58}" text-anchor="middle" font-size="9" font-weight="700"
        fill="${appoint==='groupe'?'#991B1B':'#1E40AF'}">${labelAppoint}</text>
  <text x="553" y="${yMain+69}" text-anchor="middle" font-size="8"
        fill="${appoint==='groupe'?'#991B1B':'#1E40AF'}">Appoint / secours</text>

  <rect x="600" y="${yMain-30}" width="60" height="60" rx="4" fill="none" stroke="${M}" stroke-width="1.25"/>
  <line x1="610" y1="${yMain-16}" x2="650" y2="${yMain-16}" stroke="${M}" stroke-width="0.75"/>
  <line x1="610" y1="${yMain-4}"  x2="650" y2="${yMain-4}"  stroke="${M}" stroke-width="0.75"/>
  <line x1="610" y1="${yMain+8}"  x2="650" y2="${yMain+8}"  stroke="${M}" stroke-width="0.75"/>
  <line x1="610" y1="${yMain+20}" x2="650" y2="${yMain+20}" stroke="${M}" stroke-width="0.75"/>
  <text x="630" y="${yMain-40}" text-anchor="middle" font-size="9" font-weight="700" fill="${M}">TGBT</text>
  <text x="630" y="${yMain+44}" text-anchor="middle" font-size="8" fill="#64748b">Charges</text>

  <line x1="628" y1="${yMain-62}" x2="628" y2="${yMain-30}" stroke="${M}" stroke-width="1.25" fill="none"/>
  <line x1="628" y1="${yMain+62}" x2="628" y2="${yMain+30}" stroke="${M}" stroke-width="1.25" fill="none"/>

  <line x1="40" y1="${yMain+250-198}" x2="40" y2="${yMain+250-198}" opacity="0"/>
  <rect x="30" y="${H-72}" width="${W-60}" height="56" rx="6" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="0.5"/>
  <text x="44" y="${H-52}" font-size="9" font-weight="700" fill="${M}">Légende</text>
  <text x="44" y="${H-38}" font-size="8" fill="#64748b">
    Schéma unifilaire — symboles conformes IEC 60364. Ratio PV/onduleur : ${na(inv.ratio)}
    (${inv.etat==='vert'?'conforme':inv.etat==='orange'?'à surveiller':'hors plage'}).
  </text>
  <text x="44" y="${H-24}" font-size="8" fill="#64748b">
    ${ge ? `Appoint groupe électrogène : ${na(ge.pourcentage_appoint)}% de la consommation.` : 'Appoint assuré par le réseau public lorsque la production/stockage solaire est insuffisant.'}
  </text>
</svg>`;
}

function renderRapport(scenario, projet) {
  // ── Extraction de toutes les données du scénario ──────────
  const taux  = scenario.taux_solaire;
  const en    = scenario.energie       || {};
  const pv    = scenario.generateur_pv || {};
  const ct    = scenario.correction_thermique || {};
  const inv   = scenario.onduleur      || {};
  const reg   = scenario.regulateur    || {};
  const cab   = scenario.cables        || {};
  const pro   = scenario.protections   || {};
  const st    = scenario.stockage      || {};
  const ge    = scenario.groupe        || null;
  const bud   = scenario.budget        || {};
  const rent  = scenario.rentabilite   || {};
  const p     = scenario.params        || {};
  const coh   = scenario.coherence     || {};

  // Câbles extraits correctement de la nouvelle structure
  const cab_dc  = cab.dc          || {};
  const cab_ac  = cab.ac          || {};
  const cab_bat = cab.batterie    || {};
  const cab_reg = cab.regulateur  || {};
  const spd     = cab.parafoudre_dc || {};
  const prot    = cab.protections || pro || {};

  const today = new Date().toLocaleDateString('fr-FR',
    {day:'2-digit', month:'long', year:'numeric'});

  const APPOINT = { reseau:'Réseau électrique', groupe:'Groupe électrogène' };
  const TYP = {
    residential:'Résidentiel', commercial:'Commercial',
    telecom:'Site télécom',    industrial:'Industriel',
    hospital:'Santé',          school:'Scolaire'
  };
  const SC = {
    100:{bg:'#ECFDF5',color:'#065F46',border:'#A7F3D0',label:'Autonomie maximale'},
    75: {bg:'#EFF6FF',color:'#1E40AF',border:'#BFDBFE',label:'Économique optimal'},
    50: {bg:'#FFFBEB',color:'#92400E',border:'#FDE68A',label:'Équilibre'},
    30: {bg:'#FEF2F2',color:'#991B1B',border:'#FECACA',label:'Investissement réduit'},
  };
  const sty = SC[taux] || SC[100];

  // ── Helpers ───────────────────────────────────────────────
  const fmt  = v => (v||0).toLocaleString('fr-FR');
  const fmtM = v => ((v||0)/1e6).toFixed(2);
  const na   = v => (v !== undefined && v !== null && v !== '') ? v : '—';
  const inv_etat_color = inv.etat==='vert'?'#059669':inv.etat==='orange'?'#D97706':'#DC2626';
  const inv_etat_label = inv.etat==='vert'?'✓ Conforme':inv.etat==='orange'?'⚠ Attention':'✗ Hors plage';
  const serie_color = pv.serie_ok?'#059669':'#DC2626';
  const serie_label = pv.serie_ok?'✓ Conforme':'✗ Vérifier';

  const html = `
<div style="max-width:820px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;
            color:#1e293b;font-size:13px;line-height:1.6">

  <!-- ══ EN-TÊTE ══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;
              padding-bottom:20px;border-bottom:4px solid #F59E0B;margin-bottom:28px">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <svg width="40" height="40" viewBox="0 0 340 340" style="flex-shrink:0">
          <defs><clipPath id="rapClip"><circle cx="170" cy="170" r="92"/></clipPath></defs>
          <g transform="translate(170,170)">
            <g fill="#F2B705">
              <rect x="-5" y="-130" width="10" height="34" rx="4"/>
              <rect x="-5" y="96" width="10" height="34" rx="4"/>
              <rect x="-130" y="-5" width="34" height="10" rx="4"/>
              <rect x="96" y="-5" width="34" height="10" rx="4"/>
              <g transform="rotate(45)">
                <rect x="-5" y="-130" width="10" height="30" rx="4"/>
                <rect x="-5" y="100" width="10" height="30" rx="4"/>
                <rect x="-130" y="-5" width="30" height="10" rx="4"/>
                <rect x="100" y="-5" width="30" height="10" rx="4"/>
              </g>
            </g>
          </g>
          <circle cx="170" cy="170" r="92" fill="#1B7A3D"/>
          <g clip-path="url(#rapClip)">
            <path d="M 200 112 C 152 112, 130 128, 130 152 C 130 172, 148 180, 172 184 C 196 188, 206 194, 206 208 C 206 224, 188 232, 166 232 C 144 232, 128 224, 120 210"
                  fill="none" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round"/>
          </g>
        </svg>
        <div style="font-size:22px;font-weight:800;color:#0f172a">
          Solar<span style="color:#1B7A3D">Dim</span> <span style="color:#F2B705">Pro</span>
        </div>
      </div>
      <div style="font-size:12px;color:#94a3b8">
        Rapport de dimensionnement — Système PV hybride
      </div>
      <div style="margin-top:10px">
        <span style="display:inline-block;padding:4px 16px;border-radius:20px;
               font-size:12px;font-weight:700;
               background:${sty.bg};color:${sty.color};border:1px solid ${sty.border}">
          Scénario ${taux}% solaire — ${sty.label}
        </span>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:16px;font-weight:700;color:#0f172a">RAPPORT TECHNIQUE</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">Établi le : ${today}</div>
      <div style="font-size:12px;color:#64748b">
        Réf : ${projet.ref_projet||'SD-'+new Date().getFullYear()}
      </div>
      ${projet.ingenieur
        ?`<div style="font-size:12px;color:#64748b">Ingénieur : ${projet.ingenieur}</div>`:''}
    </div>
  </div>

  <!-- ══ 1. IDENTIFICATION ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      1. Identification du projet
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div style="background:#f8fafc;border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;
                    text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">
          Client
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr><td style="color:#64748b;padding:3px 0;width:40%">Nom</td>
              <td style="font-weight:600">${na(projet.nom_client)}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0">Contact</td>
              <td>${na(projet.contact)}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0">Adresse</td>
              <td>${na(projet.adresse)}</td></tr>
        </table>
      </div>
      <div style="background:#f8fafc;border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;
                    text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">
          Projet
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr><td style="color:#64748b;padding:3px 0;width:40%">Désignation</td>
              <td style="font-weight:600">${na(projet.nom_projet)}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0">Site</td>
              <td>${na(projet.nom_site)}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0">Type</td>
              <td>${TYP[projet.type_projet]||na(projet.type_projet)}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0">Appoint</td>
              <td>${APPOINT[scenario.source_appoint]||na(scenario.source_appoint)}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0">Couverture PV</td>
              <td><strong>${taux}% solaire</strong></td></tr>
        </table>
      </div>
    </div>
  </div>

  <!-- ══ 2. DONNÉES DU SITE ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      2. Données du site et ressource solaire
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
      ${[
        ['PSH',          na(p.hsp),      'h/j',       '#D97706'],
        ['Irradiation',  na(p.irr_ghi),  'kWh/m²/j',  '#D97706'],
        ['Température',  na(p.temp_amb), '°C',         '#2563EB'],
        ['Rendement η',  '65',           '%',          '#1e293b'],
      ].map(([lbl,val,unit,col])=>`
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                    padding:12px;text-align:center">
          <div style="font-size:10px;color:#94a3b8;margin-bottom:4px">${lbl}</div>
          <div style="font-size:20px;font-weight:800;color:${col}">${val}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${unit}</div>
        </div>`).join('')}
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:10px 14px;
                font-size:12px;color:#64748b">
      T°min/max site : ${na(p.temp_min)}°C / ${na(p.temp_max)}°C
      &nbsp;|&nbsp; Performance ratio PR : ${na(p.pr_pct)}%
      &nbsp;|&nbsp; Données météo : PVGIS / NASA POWER
    </div>
  </div>

  <!-- ══ 3. BILAN ÉNERGÉTIQUE ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      3. Bilan énergétique journalier
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                  padding:14px;text-align:center">
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px">Consommation totale</div>
        <div style="font-size:24px;font-weight:800;color:#D97706">${na(en.e_brute_kwh_j)}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">kWh/j</div>
      </div>
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;
                  padding:14px;text-align:center">
        <div style="font-size:11px;color:#065F46;margin-bottom:6px">
          Part solaire (${taux}%)
        </div>
        <div style="font-size:24px;font-weight:800;color:#059669">${na(en.e_pv_kwh_j)}</div>
        <div style="font-size:11px;color:#065F46;margin-top:2px">kWh/j</div>
      </div>
      <div style="background:${taux<100?'#EFF6FF':'#f8fafc'};
                  border:1px solid ${taux<100?'#BFDBFE':'#e2e8f0'};
                  border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:11px;color:${taux<100?'#1E40AF':'#94a3b8'};margin-bottom:6px">
          Appoint ${100-taux}%
        </div>
        <div style="font-size:24px;font-weight:800;
                    color:${taux<100?'#2563EB':'#94a3b8'}">${na(en.e_appoint_kwh_j)}</div>
        <div style="font-size:11px;color:${taux<100?'#1E40AF':'#94a3b8'};margin-top:2px">
          kWh/j
        </div>
      </div>
    </div>
  </div>

  <!-- ══ 4. GÉNÉRATEUR PV ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      4. Générateur photovoltaïque
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      ${[
        ['Ppv calculée',   pv.ppv_calcule_kwc+' kWc',  '#94a3b8'],
        ['Ppv installée',  pv.ppv_installe_kwc+' kWc', '#D97706'],
        ['Nb panneaux',    pv.n_panneaux+' unités',     '#1e293b'],
        ['Production/an',  Math.round((pv.prod_annuelle_kwh||0)/1000)+' MWh', '#059669'],
      ].map(([lbl,val,col])=>`
        <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;
                    padding:12px;text-align:center">
          <div style="font-size:10px;color:#92400E;margin-bottom:4px">${lbl}</div>
          <div style="font-size:16px;font-weight:800;color:${col}">${val}</div>
        </div>`).join('')}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="text-align:left;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Paramètre</th>
          <th style="text-align:right;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Valeur</th>
          <th style="text-align:right;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Statut</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">Panneau sélectionné</td>
          <td style="padding:7px 12px;text-align:right">
            ${na(p.pan_marque)} ${na(p.pan_modele)} — ${na(p.pan_wc)} Wc
          </td>
          <td style="padding:7px 12px;text-align:right">—</td>
        </tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Puissance PV calculée (E_pv / PSH × 0.65)
          </td>
          <td style="padding:7px 12px;text-align:right;font-weight:700">
            ${na(pv.ppv_calcule_kwc)} kWc
          </td>
          <td style="padding:7px 12px;text-align:right">—</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Puissance PV installée (réelle, ≥ calculée)
          </td>
          <td style="padding:7px 12px;text-align:right;font-weight:800;color:#D97706;font-size:14px">
            ${na(pv.ppv_installe_kwc)} kWc
          </td>
          <td style="padding:7px 12px;text-align:right">
            <span style="color:#059669;font-weight:600">
              +${na(pv.ecart_pct)}%
            </span>
          </td>
        </tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Voc corrigée à Tmin=${na(ct.tmin)}°C
          </td>
          <td style="padding:7px 12px;text-align:right;font-weight:600">
            ${na(ct.voc_corr_v)} V (chaîne : ${na(ct.vstr_voc)} V)
          </td>
          <td style="padding:7px 12px;text-align:right">
            ≤ ${na(pv.nserie_max)} panneaux/série
          </td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Vmp corrigée à Tmax=${na(ct.tmax)}°C
          </td>
          <td style="padding:7px 12px;text-align:right;font-weight:600">
            ${na(ct.vmp_corr_min_v)} V (chaîne : ${na(ct.vstr_vmp_min)} V)
          </td>
          <td style="padding:7px 12px;text-align:right">
            Plage MPPT: ${na(pv.nserie_mppt_min)}–${na(pv.nserie_mppt_max)} panneaux
          </td>
        </tr>
        <tr style="background:#FFFBEB">
          <td style="padding:7px 12px;font-weight:700">
            Configuration finale
          </td>
          <td style="padding:7px 12px;text-align:right;font-weight:800;font-size:14px">
            ${na(pv.n_serie)} S × ${na(pv.n_parallele)} P = ${na(pv.n_panneaux)} panneaux
          </td>
          <td style="padding:7px 12px;text-align:right">
            <span style="color:${serie_color};font-weight:700">${serie_label}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ══ 5. ONDULEUR ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      5. Onduleur / Chargeur hybride
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="text-align:left;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Paramètre</th>
          <th style="text-align:right;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Valeur</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Modèle ${inv.choix_manuel ? 'choisi manuellement' : 'sélectionné automatiquement'}
          </td>
          <td style="padding:7px 12px;text-align:right;font-weight:700">
            ${(inv.n_unites||1) > 1 ? `${inv.n_unites} × ` : ''}${na(inv.marque)} ${na(inv.modele)}
          </td>
        </tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">Puissance nominale (unitaire)</td>
          <td style="padding:7px 12px;text-align:right;font-weight:800;font-size:14px">
            ${na(inv.puissance_kva)} kVA
          </td>
        </tr>
        ${(inv.n_unites||1) > 1 ? `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Montage en parallèle (aucun modèle seul ne couvrait le besoin)
          </td>
          <td style="padding:7px 12px;text-align:right;font-weight:800;font-size:14px;color:#7C3AED">
            ${inv.n_unites} unités = ${na(inv.puissance_kva_totale)} kVA cumulés
          </td>
        </tr>` : ''}
        <tr style="background:#f8fafc;border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Puissance charges (${na(p.coeff_inv)}× coeff sécurité)
          </td>
          <td style="padding:7px 12px;text-align:right">
            ${na(inv.p_charges_kw)} kW × ${na(p.coeff_inv)} = ${na(inv.p_inv_requise)} kVA requis
          </td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">Ratio DC/AC (Ppv/Ponduleur)</td>
          <td style="padding:7px 12px;text-align:right">
            ${na(inv.ratio)}
            <span style="color:${inv_etat_color};font-weight:600;margin-left:8px">
              ${inv_etat_label}
            </span>
          </td>
        </tr>
        <tr style="background:#f8fafc">
          <td style="padding:7px 12px;font-weight:600">Rendement onduleur</td>
          <td style="padding:7px 12px;text-align:right">${na(inv.rendement)} %</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ══ 6. RÉGULATEUR MPPT ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      6. Régulateur de charge MPPT
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600;width:50%">Courant MPPT requis</td>
        <td style="padding:7px 12px;font-weight:700;color:#D97706">
          ${na(cab_reg.i_reg_a)} A
        </td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">Section câble régulateur</td>
        <td style="padding:7px 12px;font-weight:700">${na(cab_reg.section_mm2)} mm²</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600">Tension système batterie</td>
        <td style="padding:7px 12px">${na(p.bat_v)} V DC</td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">Type recommandé</td>
        <td style="padding:7px 12px">Régulateur MPPT</td>
      </tr>
    </table>
  </div>

  <!-- ══ 7. CÂBLAGE & PROTECTIONS ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      7. Câblage et protections électriques
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="text-align:left;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Circuit</th>
          <th style="text-align:right;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Courant (A)</th>
          <th style="text-align:right;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Section câble</th>
          <th style="text-align:right;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Protection</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Câble DC — chaîne série
          </td>
          <td style="padding:7px 12px;text-align:right">${na(cab_dc.i_chaine_a)} A</td>
          <td style="padding:7px 12px;text-align:right;font-weight:700">
            ${na(cab_dc.section_mm2)} mm²
          </td>
          <td style="padding:7px 12px;text-align:right">
            Fusible ${na(prot.fus_chaine_calibre || (prot.fus_chaine_a + ' A'))}
          </td>
        </tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Câble DC — champ PV total
          </td>
          <td style="padding:7px 12px;text-align:right">${na(cab_dc.i_champ_a)} A</td>
          <td style="padding:7px 12px;text-align:right;font-weight:700">
            ${na(cab_dc.section_mm2)} mm²
          </td>
          <td style="padding:7px 12px;text-align:right">
            Fusible ${na(prot.fus_champ_calibre || (prot.fus_champ_a + ' A'))}
          </td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Câble AC — sortie onduleur
          </td>
          <td style="padding:7px 12px;text-align:right">${na(cab_ac.i_ac_a)} A</td>
          <td style="padding:7px 12px;text-align:right;font-weight:700">
            ${na(cab_ac.section_mm2)} mm²
          </td>
          <td style="padding:7px 12px;text-align:right">
            ${na(prot.disj_ac_calibre || ('Disjoncteur ' + prot.disj_ac_a + ' A'))}
          </td>
        </tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            Câble batterie (charge/décharge)
          </td>
          <td style="padding:7px 12px;text-align:right">${na(cab_bat.i_bat_a)} A</td>
          <td style="padding:7px 12px;text-align:right;font-weight:700">
            ${na(cab_bat.section_mm2)} mm²
          </td>
          <td style="padding:7px 12px;text-align:right">
            ${na(prot.disj_dc_bat_calibre || ('Disjoncteur ' + prot.disj_bat_a + ' A'))}
          </td>
        </tr>
        <tr>
          <td style="padding:7px 12px;font-weight:600">
            Câble régulateur MPPT
          </td>
          <td style="padding:7px 12px;text-align:right">${na(cab_reg.i_reg_a)} A</td>
          <td style="padding:7px 12px;text-align:right;font-weight:700">
            ${na(cab_reg.section_mm2)} mm²
          </td>
          <td style="padding:7px 12px;text-align:right">—</td>
        </tr>
        <tr style="background:#FFFBEB;border-bottom:1px solid #f1f5f9">
          <td style="padding:7px 12px;font-weight:600">
            ⚡ Protection foudre — Côté DC (champ PV)
          </td>
          <td style="padding:7px 12px;text-align:right">—</td>
          <td style="padding:7px 12px;text-align:right;font-weight:700">—</td>
          <td style="padding:7px 12px;text-align:right">
            ${na(spd.label)}
          </td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:10px;color:#64748b;margin-top:8px;line-height:1.6">
      ⚡ Le parafoudre DC (${na(spd.note)}) — norme ${na(spd.norme)}.
    </p>
  </div>

  <!-- ══ 7BIS. SCHÉMA DE CÂBLAGE ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      Schéma unifilaire de l'installation
    </div>
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fff">
      ${genererSchemaCablage(scenario)}
    </div>
  </div>

  <!-- ══ 8. BATTERIES ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      8. Système de stockage par batteries
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      ${[
        ['Capacité requise', na(st.capacite_req_kwh)+' kWh', '#7C3AED'],
        ['En Ah (48V)',      na(st.capacite_req_ah)+' Ah',   '#7C3AED'],
        ['Modules',         na(st.n_modules)+' modules',     '#1e293b'],
        ['Autonomie',       na(st.jours_autonomie)+' j / '+na(st.autonomie_heures)+'h','#059669'],
      ].map(([lbl,val,col])=>`
        <div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;
                    padding:12px;text-align:center">
          <div style="font-size:10px;color:#4C1D95;margin-bottom:4px">${lbl}</div>
          <div style="font-size:15px;font-weight:800;color:${col}">${val}</div>
        </div>`).join('')}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600;width:45%">Technologie</td>
        <td style="padding:7px 12px;font-weight:700">${na(st.type)}</td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">
          Modèle ${st.choix_manuel ? 'choisi manuellement' : 'retenu automatiquement'}
        </td>
        <td style="padding:7px 12px">
          ${na(st.marque)} ${na(st.modele)} — ${na(st.capacite_u_kwh)} kWh / module
        </td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600">Capacité totale installée</td>
        <td style="padding:7px 12px;font-weight:800;color:#7C3AED;font-size:14px">
          ${na(st.capacite_inst_kwh)} kWh
          (${na(st.n_modules)} × ${na(st.capacite_u_kwh)} kWh)
        </td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">Profondeur de décharge (DOD)</td>
        <td style="padding:7px 12px">${na(st.dod_pct)} %</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600">Câble batterie</td>
        <td style="padding:7px 12px">
          ${na(st.cable_courant_a)} A → Section ${na(st.cable_section_mm2)} mm²
        </td>
      </tr>
    </table>
  </div>

  ${ge ? `
  <!-- ══ 9. GROUPE ÉLECTROGÈNE ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      9. Groupe électrogène de secours
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600;width:45%">Modèle</td>
        <td style="padding:7px 12px">${na(ge.modele||p.gen_modele)}</td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">Carburant</td>
        <td style="padding:7px 12px">${na(ge.carburant||p.gen_fuel)}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600">Puissance recommandée</td>
        <td style="padding:7px 12px;font-weight:700;color:#D97706">
          ${na(ge.puissance_kw)} kW
        </td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">Énergie assurée par le groupe</td>
        <td style="padding:7px 12px">
          ${na(ge.energie_jour_kwh)} kWh/j —
          soit ${na(ge.pourcentage_appoint)}% de la consommation
        </td>
      </tr>
    </table>
  </div>` : ''}
  <!-- ══ PIED DE PAGE ══ -->
  <div style="margin-top:36px;padding-top:16px;border-top:1px solid #e2e8f0;
              display:flex;justify-content:space-between;align-items:center;
              font-size:10px;color:#94a3b8">
    <div>
      <div style="font-weight:600;color:#64748b">
        SolarDim Pro — Rapport technique de dimensionnement solaire hybride
      </div>
      <div>Document généré le ${today}</div>
      <div style="margin-top:4px;font-style:italic">
        Le budget et l'analyse de rentabilité figurent dans le rapport financier séparé.
      </div>
    </div>
    <div style="text-align:right">
      <div>Réf : ${projet.ref_projet||'—'}</div>
      <div>Ingénieur : ${projet.ingenieur||'—'}</div>
      <div style="margin-top:6px;padding:3px 12px;
                  background:${sty.bg};color:${sty.color};
                  border:1px solid ${sty.border};
                  border-radius:20px;font-weight:700;font-size:11px">
        Scénario retenu : ${taux}% solaire
      </div>
    </div>
  </div>

</div>`;

  const el = document.getElementById('rapport-content');
  if(el) el.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
// RAPPORT FINANCIER — Budget (CAPEX) + Rentabilité
// Contient un résumé des grandes lignes techniques du scénario,
// puis le détail financier complet (budget, rentabilité, CO₂).
// ════════════════════════════════════════════════════════════
function renderRapportFinancier(scenario, projet) {
  const taux  = scenario.taux_solaire;
  const pv    = scenario.generateur_pv || {};
  const inv   = scenario.onduleur      || {};
  const st    = scenario.stockage      || {};
  const ge    = scenario.groupe        || null;
  const bud   = scenario.budget        || {};
  const rent  = scenario.rentabilite   || {};
  const p     = scenario.params        || {};

  const today = new Date().toLocaleDateString('fr-FR',
    {day:'2-digit', month:'long', year:'numeric'});

  const APPOINT = { reseau:'Réseau électrique', groupe:'Groupe électrogène' };
  const TYP = {
    residential:'Résidentiel', commercial:'Commercial',
    telecom:'Site télécom',    industrial:'Industriel',
    hospital:'Santé',          school:'Scolaire'
  };
  const SC = {
    100:{bg:'#ECFDF5',color:'#065F46',border:'#A7F3D0',label:'Autonomie maximale'},
    75: {bg:'#EFF6FF',color:'#1E40AF',border:'#BFDBFE',label:'Économique optimal'},
    50: {bg:'#FFFBEB',color:'#92400E',border:'#FDE68A',label:'Équilibre'},
    30: {bg:'#FEF2F2',color:'#991B1B',border:'#FECACA',label:'Investissement réduit'},
  };
  const sty = SC[taux] || SC[100];

  const fmt  = v => (v||0).toLocaleString('fr-FR');
  const fmtM = v => ((v||0)/1e6).toFixed(2);
  const na   = v => (v !== undefined && v !== null && v !== '') ? v : '—';

  const budRows = [
    [`Panneaux solaires (${pv.n_panneaux||0} × ${p.pan_wc||'—'} Wc)`, bud.panneaux],
    [`Onduleur ${p.inv_marque||''} ${p.inv_modele||''} (${p.inv_kva||'—'} kVA)${(p.inv_n||1) > 1 ? ` × ${p.inv_n}` : ''}`, bud.onduleurs],
    [`Batteries ${st.type||''} — ${st.n_modules||0} × ${st.capacite_u_kwh||'—'} kWh`, bud.batteries],
    ['Groupe électrogène', bud.groupe],
    ['Câblage & protections', bud.cables],
    ['Structure & montage', bud.structure],
    ['Installation & mise en service', bud.installation],
    ['Divers & imprévus', bud.divers],
  ].filter(r => r[1] > 0).map(r =>
    `<tr>
      <td style="padding:7px 12px">${r[0]}</td>
      <td style="padding:7px 12px;text-align:right;font-weight:600">
        ${fmt(r[1])} FCFA
      </td>
    </tr>`
  ).join('');

  const html = `
<div style="max-width:820px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;
            color:#1e293b;font-size:13px;line-height:1.6">

  <!-- ══ EN-TÊTE ══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;
              padding-bottom:20px;border-bottom:4px solid #F59E0B;margin-bottom:28px">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <svg width="40" height="40" viewBox="0 0 340 340" style="flex-shrink:0">
          <defs><clipPath id="rapClipFin"><circle cx="170" cy="170" r="92"/></clipPath></defs>
          <g transform="translate(170,170)">
            <g fill="#F2B705">
              <rect x="-5" y="-130" width="10" height="34" rx="4"/>
              <rect x="-5" y="96" width="10" height="34" rx="4"/>
              <rect x="-130" y="-5" width="34" height="10" rx="4"/>
              <rect x="96" y="-5" width="34" height="10" rx="4"/>
              <g transform="rotate(45)">
                <rect x="-5" y="-130" width="10" height="30" rx="4"/>
                <rect x="-5" y="100" width="10" height="30" rx="4"/>
                <rect x="-130" y="-5" width="30" height="10" rx="4"/>
                <rect x="100" y="-5" width="30" height="10" rx="4"/>
              </g>
            </g>
          </g>
          <circle cx="170" cy="170" r="92" fill="#1B7A3D"/>
          <g clip-path="url(#rapClipFin)">
            <path d="M 200 112 C 152 112, 130 128, 130 152 C 130 172, 148 180, 172 184 C 196 188, 206 194, 206 208 C 206 224, 188 232, 166 232 C 144 232, 128 224, 120 210"
                  fill="none" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round"/>
          </g>
        </svg>
        <div style="font-size:22px;font-weight:800;color:#0f172a">
          Solar<span style="color:#1B7A3D">Dim</span> <span style="color:#F2B705">Pro</span>
        </div>
      </div>
      <div style="font-size:12px;color:#94a3b8">
        Rapport financier — Système PV hybride
      </div>
      <div style="margin-top:10px">
        <span style="display:inline-block;padding:4px 16px;border-radius:20px;
               font-size:12px;font-weight:700;
               background:${sty.bg};color:${sty.color};border:1px solid ${sty.border}">
          Scénario ${taux}% solaire — ${sty.label}
        </span>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:16px;font-weight:700;color:#0f172a">RAPPORT FINANCIER</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">Établi le : ${today}</div>
      <div style="font-size:12px;color:#64748b">
        Réf : ${projet.ref_projet||'SD-'+new Date().getFullYear()}
      </div>
      ${projet.ingenieur
        ?`<div style="font-size:12px;color:#64748b">Ingénieur : ${projet.ingenieur}</div>`:''}
    </div>
  </div>

  <!-- ══ 1. RAPPEL DU PROJET ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      1. Rappel du projet
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div style="background:#f8fafc;border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;
                    text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">
          Client
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr><td style="color:#64748b;padding:3px 0;width:40%">Nom</td>
              <td style="font-weight:600">${na(projet.nom_client)}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0">Adresse</td>
              <td>${na(projet.adresse)}</td></tr>
        </table>
      </div>
      <div style="background:#f8fafc;border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;
                    text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">
          Projet
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr><td style="color:#64748b;padding:3px 0;width:40%">Désignation</td>
              <td style="font-weight:600">${na(projet.nom_projet)}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0">Site</td>
              <td>${na(projet.nom_site)}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0">Type</td>
              <td>${TYP[projet.type_projet]||na(projet.type_projet)}</td></tr>
        </table>
      </div>
    </div>
  </div>

  <!-- ══ 2. GRANDES LIGNES TECHNIQUES (résumé) ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      2. Synthèse de la solution technique retenue
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:-4px 0 12px">
      Détail complet (calculs, câblage, protections) dans le rapport technique séparé.
    </p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      ${[
        ['Champ PV installé',  na(pv.ppv_installe_kwc)+' kWc', '#D97706'],
        ['Onduleur',           ((inv.n_unites||1) > 1 ? `${inv.n_unites}× ` : '')+na(inv.puissance_kva_totale||inv.puissance_kva)+' kVA',   '#1e293b'],
        ['Stockage batteries', na(st.capacite_inst_kwh)+' kWh','#7C3AED'],
        ['Appoint',            APPOINT[scenario.source_appoint]||na(scenario.source_appoint),'#2563EB'],
      ].map(([lbl,val,col])=>`
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                    padding:12px;text-align:center">
          <div style="font-size:10px;color:#94a3b8;margin-bottom:4px">${lbl}</div>
          <div style="font-size:15px;font-weight:800;color:${col}">${val}</div>
        </div>`).join('')}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600;width:50%">Configuration panneaux</td>
        <td style="padding:7px 12px">
          ${na(pv.n_panneaux)} panneaux ${na(p.pan_wc)} Wc
          (${na(pv.n_serie)} S × ${na(pv.n_parallele)} P)
        </td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">Production annuelle estimée</td>
        <td style="padding:7px 12px">
          ${Math.round((pv.prod_annuelle_kwh||0)/1000)} MWh/an
        </td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600">Couverture solaire</td>
        <td style="padding:7px 12px"><strong>${taux}%</strong> de la consommation</td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">Stockage</td>
        <td style="padding:7px 12px">
          ${na(st.marque)} ${na(st.modele)} —
          ${na(st.n_modules)} × ${na(st.capacite_u_kwh)} kWh
          (autonomie ${na(st.jours_autonomie)} j)
        </td>
      </tr>
      ${ge ? `
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600">Groupe électrogène</td>
        <td style="padding:7px 12px">
          ${na(ge.modele||p.gen_modele)} — ${na(ge.puissance_kw)} kW
        </td>
      </tr>` : ''}
    </table>
  </div>

  <!-- ══ BUDGET ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      3. Budget prévisionnel d'investissement (CAPEX)
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="text-align:left;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Poste</th>
          <th style="text-align:right;padding:7px 12px;color:#64748b;font-size:10px;
                     text-transform:uppercase">Montant (FCFA)</th>
        </tr>
      </thead>
      <tbody>
        ${budRows}
        ${(bud.remise_pct||0) > 0 ? `
        <tr style="background:#f8fafc">
          <td style="padding:7px 12px">Sous-total HT</td>
          <td style="padding:7px 12px;text-align:right">${fmt(bud.total_ht)}</td>
        </tr>
        <tr>
          <td style="padding:7px 12px;color:#059669">
            Remise (${bud.remise_pct}%)
          </td>
          <td style="padding:7px 12px;text-align:right;color:#059669">
            − ${fmt((bud.total_ht||0)-(bud.total_net||0))}
          </td>
        </tr>` : ''}
        <tr style="background:#FFFBEB;border-top:2px solid #FDE68A">
          <td style="padding:12px;font-size:14px;font-weight:700">TOTAL NET</td>
          <td style="padding:12px;text-align:right;font-size:20px;
                     font-weight:800;color:#D97706">
            ${fmt(bud.total_net)} FCFA
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ══ RENTABILITÉ ══ -->
  <div style="margin-bottom:24px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;
                border-left:4px solid #F59E0B;padding-left:12px;margin-bottom:14px">
      4. Analyse économique et rentabilité
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">
      ${[
        ['Économies/an',     fmt(rent.economies_annuelles)+' FCFA','#059669','#ECFDF5','#A7F3D0'],
        ['Temps de retour',  (rent.temps_retour_ans!=null && rent.temps_retour_ans<100?rent.temps_retour_ans+' ans':'N/A'),'#D97706','#FFFBEB','#FDE68A'],
        ['TRI',              (rent.tri_pct!=null?rent.tri_pct+' %':'N/A'),'#D97706','#FFFBEB','#FDE68A'],
        ['VAN 20 ans',       fmtM(rent.van_20ans)+' M FCFA',
          rent.van_20ans>0?'#059669':'#DC2626',
          rent.van_20ans>0?'#ECFDF5':'#FEF2F2',
          rent.van_20ans>0?'#A7F3D0':'#FECACA'],
        ['CO₂ évité',        ((rent.co2_kg_an||0)/1000).toFixed(1)+' t/an','#059669','#ECFDF5','#A7F3D0'],
      ].map(([lbl,val,col,bg,brd])=>`
        <div style="background:${bg};border:1px solid ${brd};border-radius:10px;
                    padding:14px;text-align:center">
          <div style="font-size:10px;color:${col};opacity:0.8;margin-bottom:6px">${lbl}</div>
          <div style="font-size:17px;font-weight:800;color:${col}">${val}</div>
        </div>`).join('')}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600;width:55%">Investissement total</td>
        <td style="padding:7px 12px;font-weight:700">${fmt(bud.total_net)} FCFA</td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">Production annuelle estimée</td>
        <td style="padding:7px 12px">${fmt(rent.prod_annuelle_kwh)} kWh/an</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600">Économies sur facture électrique</td>
        <td style="padding:7px 12px;color:#059669;font-weight:600">
          ${fmt(rent.economies_annuelles)} FCFA/an
        </td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">
          Charges O&M annuelles (1,2%/an)
        </td>
        <td style="padding:7px 12px">${fmt(rent.opex_annuel)} FCFA/an</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600">Flux net annuel</td>
        <td style="padding:7px 12px;font-weight:700">${fmt(rent.flux_net)} FCFA/an</td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">
          Temps de retour sur investissement
        </td>
        <td style="padding:7px 12px;font-weight:700;color:#D97706">
          ${rent.temps_retour_ans!=null && rent.temps_retour_ans<100?rent.temps_retour_ans+' ans':'Non calculable'}
        </td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600">
          TRI (Taux de Rentabilité Interne)
        </td>
        <td style="padding:7px 12px;font-weight:700;color:#D97706">
          ${rent.tri_pct!=null?rent.tri_pct+' %':'Non calculable'}
        </td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:7px 12px;font-weight:600">
          VAN sur 20 ans (${na(p.taux_act)}% / 20 ans)
        </td>
        <td style="padding:7px 12px;font-weight:700;
                   color:${(rent.van_20ans||0)>0?'#059669':'#DC2626'}">
          ${fmt(rent.van_20ans)} FCFA
        </td>
      </tr>
      <tr>
        <td style="padding:7px 12px;font-weight:600">LCOE (coût production kWh)</td>
        <td style="padding:7px 12px">
          ${na(rent.lcoe_fcfa_kwh)} FCFA/kWh
          <span style="color:#94a3b8">
            (tarif réseau : ${na(p.tarif)} FCFA/kWh)
          </span>
        </td>
      </tr>
      <tr style="background:#ECFDF5">
        <td style="padding:7px 12px;font-weight:600;color:#065F46">CO₂ évité</td>
        <td style="padding:7px 12px;font-weight:700;color:#059669">
          ${fmt(rent.co2_kg_an)} kg/an —
          soit ${((rent.co2_kg_an||0)*20/1000).toFixed(1)} t sur 20 ans
        </td>
      </tr>
    </table>
  </div>

  <!-- ══ PIED DE PAGE ══ -->
  <div style="margin-top:36px;padding-top:16px;border-top:1px solid #e2e8f0;
              display:flex;justify-content:space-between;align-items:center;
              font-size:10px;color:#94a3b8">
    <div>
      <div style="font-weight:600;color:#64748b">
        SolarDim Pro — Rapport financier de dimensionnement solaire hybride
      </div>
      <div>Document généré le ${today}</div>
    </div>
    <div style="text-align:right">
      <div>Réf : ${projet.ref_projet||'—'}</div>
      <div>Ingénieur : ${projet.ingenieur||'—'}</div>
      <div style="margin-top:6px;padding:3px 12px;
                  background:${sty.bg};color:${sty.color};
                  border:1px solid ${sty.border};
                  border-radius:20px;font-weight:700;font-size:11px">
        Scénario retenu : ${taux}% solaire
      </div>
    </div>
  </div>

</div>`;

  const el = document.getElementById('rapport-financier-content');
  if(el) el.innerHTML = html;
}
