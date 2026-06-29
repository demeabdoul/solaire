// ════════════════════════════════════════════════════
// VARIABLES GLOBALES
// ════════════════════════════════════════════════════
let step            = 0;
let projectType     = 'residential';
let sourceAppoint   = 'reseau';
let chargeMode      = 'charges';
let charges         = [];
let chargeId        = 0;
let currentProjetId = null;
let catPan          = [];
let catInv          = [];
let catBat          = {};
let precalcData     = null;
let scenariosResult = null;
let geoTimer        = null;

const APPAREILS = {
  residential:[
    ['Réfrigérateur 150L',150,1,24],['Climatiseur 1.5CV',1100,1,6],
    ['TV LED 43"',80,1,5],['Éclairage LED',15,6,8],
    ['Ventilateur',75,2,10],['Chargeurs mobiles',30,3,4]
  ],
  commercial:[
    ['Climatiseur 2CV',1500,2,8],['Éclairage LED bureau',40,8,10],
    ['Ordinateur de bureau',250,5,8],['Imprimante',500,1,2]
  ],
  telecom:[
    ['BTS station de base',2000,1,24],['Climatisation site',1500,1,24],
    ['Équipements radio',800,1,24],['Éclairage',100,2,2]
  ],
  industrial:[
    ['Moteur pompage 5CV',3700,1,8],['Éclairage atelier LED',200,10,10],
    ['Compresseur',1500,1,4]
  ],
  hospital:[
    ['Réfrigérateur médicaments',100,2,24],['Éclairage salles',60,8,14],
    ['Équipements médicaux',500,3,8],['Stérilisateur',3000,1,1]
  ],
  school:[
    ['Éclairage salles',40,10,8],['Vidéoprojecteur',300,3,6],
    ['Ordinateurs',250,5,8]
  ],
};

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════
async function initWizard() {
  step=0; currentProjetId=null; projectType='residential';
  sourceAppoint='reseau'; chargeMode='charges';
  charges=[]; chargeId=0; precalcData=null; scenariosResult=null;
  dashboardScenarios=null;

  const dp=document.getElementById('date_projet');
  if(dp) dp.value=new Date().toISOString().split('T')[0];

  document.querySelectorAll('.tcard').forEach((c,i)=>
    c.classList.toggle('selected',i===0));
  const apR=document.getElementById('ap-reseau');
  const apG=document.getElementById('ap-groupe');
  if(apR) apR.classList.add('selected');
  if(apG) apG.classList.remove('selected');

  ['geo-coords','geo-status','meteo-result'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='none';
  });
  const ns=document.getElementById('nom_site');
  if(ns) ns.value='';
  const rg=document.getElementById('region_site');
  if(rg) rg.value='';

  goStep(0);
  await loadCat();
  initCharges();
}

// ════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════
function goStep(n) {
  step=n;
  document.querySelectorAll('.wp').forEach((p,i)=>p.classList.toggle('active',i===n));
  document.querySelectorAll('.ws').forEach((s,i)=>{
    s.classList.remove('active','done');
    if(i===n) s.classList.add('active');
    if(i<n)   s.classList.add('done');
  });
  if(n===2){
    const mc=document.getElementById('mode-charges');
    const mw=document.getElementById('mode-wh');
    if(mc) mc.style.display=chargeMode==='charges'?'block':'none';
    if(mw) mw.style.display=chargeMode==='wh'?'block':'none';
    if(chargeMode==='charges') renderCharges();
  }
  if(n===3){
    const cg=document.getElementById('card-gen');
    if(cg) cg.style.display=sourceAppoint==='groupe'?'block':'none';
    // Mettre à jour la puissance onduleur recommandée
    updatePuissanceOnduleur();
  }
  if(n===4 && dashboardScenarios){
    renderDashboardTechnique(dashboardScenarios);
  }
  window.scrollTo(0,0);
}

function wNext(){
  if(step===0 && !document.getElementById('nom_projet')?.value?.trim()){
    alert('Le nom du projet est obligatoire.'); return;
  }
  if(step===1 && !document.getElementById('nom_site')?.value?.trim()){
    alert('Le nom du site est obligatoire.'); return;
  }
  goStep(step+1);
}
function wPrev(){ if(step>0) goStep(step-1); }

function selectType(t,el){
  projectType=t;
  document.querySelectorAll('.tcard').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  initCharges();
}
function selectAppoint(a,el){
  sourceAppoint=a;
  document.querySelectorAll('.appoint-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
}

// ════════════════════════════════════════════════════
// GÉOCODAGE AUTOMATIQUE
// Déclenché dès que l'utilisateur saisit région OU pays
// ════════════════════════════════════════════════════
function onSiteFieldChange(){
  const site   = document.getElementById('nom_site')?.value?.trim()   || '';
  const region = document.getElementById('region_site')?.value?.trim()|| '';
  const pays   = document.getElementById('pays')?.value               || '';

  // Construire la requête : région + pays suffisent
  let query = '';
  if(site)   query = site + (region ? ', '+region : '') + ', '+pays;
  else if(region) query = region + ', '+pays;
  else return; // pas assez d'info

  if(query.length < 3) return;

  clearTimeout(geoTimer);
  geoTimer = setTimeout(()=>_rechercherSite(query), 700);
}

async function _rechercherSite(query){
  const sts=document.getElementById('geo-status');
  if(!sts) return;

  sts.style.cssText='display:block;font-size:12px;padding:8px 12px;border-radius:8px;margin-top:8px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E';
  sts.innerHTML='<span class="spinner"></span> Localisation en cours...';

  try{
    // Géocodage
    const r=await fetch(`${API}/geocode?q=${encodeURIComponent(query)}`);
    if(!r.ok) throw new Error('Lieu introuvable');
    const geo=await r.json();

    const setTxt=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    const setVal=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};

    setVal('lat_hidden', geo.lat);
    setVal('lon_hidden', geo.lon);
    setTxt('lat_display', geo.lat.toFixed(4)+'°');
    setTxt('lon_display', geo.lon.toFixed(4)+'°');
    setTxt('geo-nom-complet', geo.nom.split(',').slice(0,3).join(', '));
    const gc=document.getElementById('geo-coords');
    if(gc) gc.style.display='block';

    sts.innerHTML='<span class="spinner"></span> Importation météo PVGIS/NASA...';

    // Météo automatique
    const rm=await fetch(`${API}/meteo?lat=${geo.lat}&lon=${geo.lon}`);
    if(!rm.ok) throw new Error('Météo indisponible');
    const m=await rm.json();

    setVal('hsp',      m.hsp);
    setVal('irr',      m.irr_ghi);
    setVal('temp_amb', m.temp_amb);
    setTxt('m-hsp',    m.hsp      +' h/j');
    setTxt('m-ghi',    m.irr_ghi  +' kWh/m²/j');
    setTxt('m-temp',   m.temp_amb +' °C');
    setTxt('meteo-source','Source : '+m.source);
    const mr=document.getElementById('meteo-result');
    if(mr) mr.style.display='block';

    sts.style.cssText='display:block;font-size:12px;padding:8px 12px;border-radius:8px;margin-top:8px;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46';
    sts.innerHTML=`&#10003; <strong>${geo.nom.split(',').slice(0,2).join(', ')}</strong>`+
      ` — Lat:${geo.lat.toFixed(4)}° Lon:${geo.lon.toFixed(4)}°`+
      ` | ${m.source}`;

  }catch(e){
    sts.style.cssText='display:block;font-size:12px;padding:8px 12px;border-radius:8px;margin-top:8px;background:#FEF2F2;border:1px solid #FECACA;color:#DC2626';
    sts.innerHTML='&#9888; '+e.message+' — Vérifiez le backend (python main.py)';
  }
}

// ════════════════════════════════════════════════════
// CHARGES ÉLECTRIQUES
// Avec possibilité d'ajouter et personnaliser manuellement
// ════════════════════════════════════════════════════
function initCharges(){
  charges=[]; chargeId=0;
  (APPAREILS[projectType]||APPAREILS.residential)
    .forEach(c=>addCharge(c[0],c[1],c[2],c[3]));
}

function addCharge(nom='',puiss=0,qte=1,duree=4){
  charges.push({id:++chargeId, nom, puiss, qte, duree, custom:false});
  renderCharges();
}

// Ajouter une ligne vierge — l'utilisateur saisit tout manuellement
function addChargeManuelle(){
  charges.push({id:++chargeId, nom:'', puiss:0, qte:1, duree:4, custom:true});
  renderCharges();
  // Focus sur le champ nom de la dernière ligne
  setTimeout(()=>{
    const inputs=document.querySelectorAll('.ch-nom-input');
    if(inputs.length) inputs[inputs.length-1].focus();
  },100);
}

function renderCharges(){
  const list=APPAREILS[projectType]||APPAREILS.residential;
  const opts=list.map(a=>
    `<option value="${a[0]}|${a[1]}">${a[0]} (${a[1]} W)</option>`
  ).join('');

  const el=document.getElementById('charges-list');
  if(!el) return;

  el.innerHTML=charges.map(c=>{
    const wh=(c.puiss*c.qte*c.duree).toLocaleString('fr-FR');

    if(c.custom){
      // Ligne entièrement personnalisable — saisie libre
      return `<div class="ch-row" id="ch-${c.id}">
        <input type="text"   class="ch-nom-input"
               placeholder="Nom de l'appareil"
               value="${c.nom}"
               onchange="chUpdNom(${c.id},this.value)">
        <input type="number" value="${c.puiss}" min="0" placeholder="W"
               onchange="chUpd(${c.id},'puiss',this.value)">
        <input type="number" value="${c.qte}"   min="1"
               onchange="chUpd(${c.id},'qte',this.value)">
        <input type="number" value="${c.duree}" min="0" max="24" step="0.5"
               onchange="chUpd(${c.id},'duree',this.value)">
        <div class="ch-wh">${wh} Wh</div>
        <button class="btn btn-red btn-sm" onclick="chDel(${c.id})">&#128465;</button>
      </div>`;
    } else {
      // Ligne avec liste déroulante
      return `<div class="ch-row" id="ch-${c.id}">
        <select onchange="chSel(${c.id},this)">
          <option value="">-- Choisir --</option>
          ${opts}
          <option value="${c.nom}|${c.puiss}" selected>${c.nom||'Personnalisé'}</option>
          <option value="__custom__">Saisie manuelle...</option>
        </select>
        <input type="number" value="${c.puiss}" min="0"
               onchange="chUpd(${c.id},'puiss',this.value)">
        <input type="number" value="${c.qte}"   min="1"
               onchange="chUpd(${c.id},'qte',this.value)">
        <input type="number" value="${c.duree}" min="0" max="24" step="0.5"
               onchange="chUpd(${c.id},'duree',this.value)">
        <div class="ch-wh">${wh} Wh</div>
        <button class="btn btn-red btn-sm" onclick="chDel(${c.id})">&#128465;</button>
      </div>`;
    }
  }).join('');

  calcCharges();
  updatePuissanceOnduleur();
}

function chSel(id,sel){
  if(sel.value==='__custom__'){
    // Convertir en ligne personnalisée
    const c=charges.find(x=>x.id===id);
    if(c){ c.custom=true; c.nom=''; c.puiss=0; }
    renderCharges();
    return;
  }
  const[nom,puiss]=sel.value.split('|');
  const c=charges.find(x=>x.id===id);
  if(c){ c.nom=nom; c.puiss=parseFloat(puiss)||0; }
  renderCharges();
}
function chUpdNom(id,val){
  const c=charges.find(x=>x.id===id);
  if(c) c.nom=val;
  calcCharges();
}
function chUpd(id,field,val){
  const c=charges.find(x=>x.id===id);
  if(c){ c[field]=parseFloat(val)||0; renderCharges(); }
}
function chDel(id){
  charges=charges.filter(c=>c.id!==id);
  renderCharges();
}

function calcCharges(){
  const totalWh=charges.reduce((s,c)=>s+c.puiss*c.qte*c.duree,0);
  const totalW =charges.reduce((s,c)=>s+c.puiss*c.qte,0);
  const setTxt=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setTxt('t-conso',(totalWh/1000).toFixed(2));
  setTxt('t-puiss',totalW);
}

function switchChargeMode(mode,el){
  chargeMode=mode;
  document.querySelectorAll('.ctab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  ['mode-charges','mode-wh'].forEach(id=>{
    const e=document.getElementById(id);
    if(e) e.style.display='none';
  });
  const target=document.getElementById('mode-'+mode);
  if(target) target.style.display='block';
  if(mode==='charges') renderCharges();
  updatePuissanceOnduleur();
}

// ════════════════════════════════════════════════════
// PUISSANCE ONDULEUR CALCULÉE
// Mode "charges" : on connaît la puissance des équipements
//   → P_inv = P_nominale_charges × coeff (1.2 à 1.5)
// Mode "wh" (saisie directe Wh/jour) : on ne connaît PAS la
// puissance des charges, donc on dérive une puissance crête
// équivalente depuis l'énergie journalière et le HSP, exactement
// comme le fait le backend (_calc_energie, mode 'wh') :
//   P_equiv (W) = Energie_Wh_jour / HSP
//   → P_inv = P_equiv × coeff
// ════════════════════════════════════════════════════
function updatePuissanceOnduleur(){
  const setTxt=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const coeff = parseFloat(document.getElementById('coeff_inv')?.value)||1.3;
  let totalW = 0;
  let labelNominale = '';

  if (chargeMode === 'wh') {
    const energieWh = parseFloat(document.getElementById('energie_wh')?.value) || 0;
    const hsp        = parseFloat(document.getElementById('hsp')?.value) || 5.5;
    if (energieWh <= 0 || hsp <= 0) return;
    totalW = energieWh / hsp;  // puissance crête équivalente (W), cf. backend _calc_energie
    labelNominale = (totalW/1000).toFixed(2)+' kW (estimée : '+energieWh+' Wh/j ÷ '+hsp+' h HSP)';
  } else {
    totalW = charges.reduce((s,c)=>s+c.puiss*c.qte,0);
    if (totalW <= 0) return;
    labelNominale = (totalW/1000).toFixed(2)+' kW';
  }

  const p_inv_kva = (totalW / 1000 * coeff);

  setTxt('inv-p-nominale',  labelNominale);
  setTxt('inv-p-calculee',  p_inv_kva.toFixed(2)+' kVA');
  setTxt('inv-p-recommande',
    p_inv_kva.toFixed(2)+' kVA (coeff '+coeff+')');

  // Sélectionner automatiquement l'onduleur adapté dans le catalogue
  if(catInv.length){
    let meilleur=null, ecartMin=Infinity;
    catInv.forEach(o=>{
      const p=parseFloat(o.puissance_kva);
      const ecart=Math.abs(p-p_inv_kva);
      if(ecart<ecartMin){ ecartMin=ecart; meilleur=o; }
    });
    if(meilleur){
      const sel=document.getElementById('inv_sel');
      if(sel){
        sel.value=meilleur.id;
        onInvSelect();
      }
      setTxt('inv-modele-auto',
        `${meilleur.marque} ${meilleur.modele} — ${meilleur.puissance_kva} kVA`);
    }
  }
}

function onCoeffInvChange(){
  updatePuissanceOnduleur();
}

// ════════════════════════════════════════════════════
// PRÉ-CALCUL
// ════════════════════════════════════════════════════
async function wNextPrecalcul(){
  const joursId=chargeMode==='charges'?'jours_auto':'jours_auto_wh';

  const payload={
    mode:chargeMode,
    charges:chargeMode==='charges'
      ?charges.map(c=>({
          nom:c.nom||'Appareil',
          puissance_w:c.puiss,
          quantite:c.qte,
          duree_h:c.duree
        })):[],
    energie_wh:chargeMode==='wh'
      ?parseFloat(document.getElementById('energie_wh')?.value)||0:0,

    pr_pct:      parseFloat(document.getElementById('pr')?.value)||80,
    // Rendement fixe à 0.65 comme défini
    inv_rendement_pct: 65,
    jours_autonomie: parseFloat(document.getElementById(joursId)?.value)||2,
    bat_type:    document.getElementById('bat_type')?.value||'LiFePO4',
    temp_min:    parseFloat(document.getElementById('temp_min')?.value)||15,
    temp_max:    parseFloat(document.getElementById('temp_max')?.value)||70,
    temp_amb:    parseFloat(document.getElementById('temp_amb')?.value)||30,
  };

  try{
    const r=await fetch(API+'/precalcul',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    precalcData=await r.json();
  }catch(e){
    // Calcul local : η = 0.65 fixe
    const eta=0.65; const hsp=5.5;
    let eb=0;
    if(chargeMode==='charges')
      eb=charges.reduce((s,c)=>s+c.puiss*c.qte*c.duree,0)/1000;
    else
      eb=(parseFloat(document.getElementById('energie_wh')?.value)||0)/1000;
    const ppv=eb/(5.5*eta);
    precalcData={
      ppv_100_kwc:ppv.toFixed(2),
      ppv_75_kwc: (ppv*0.75).toFixed(2),
      ppv_50_kwc: (ppv*0.50).toFixed(2),
      ppv_30_kwc: (ppv*0.30).toFixed(2),
      inv_rec_100:'—',inv_rec_75:'—',inv_rec_50:'—',inv_rec_30:'—',
      bat_rec_100:'—',bat_rec_75:'—',bat_rec_50:'—',bat_rec_30:'—',
    };
  }

  if(precalcData){
    const setTxt=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    setTxt('rec-ppv-100',(precalcData.ppv_100_kwc||'—')+' kWc');
    setTxt('rec-ppv-75', (precalcData.ppv_75_kwc ||'—')+' kWc');
    setTxt('rec-ppv-50', (precalcData.ppv_50_kwc ||'—')+' kWc');
    setTxt('rec-ppv-30', (precalcData.ppv_30_kwc ||'—')+' kWc');
    setTxt('inv-rec-label', precalcData.inv_rec_100||'—');
    setTxt('bat-rec-label', precalcData.bat_rec_100||'—');
  }

  goStep(3);
}

// ════════════════════════════════════════════════════
// CATALOGUES
// ════════════════════════════════════════════════════
async function loadCat(){
  try{
    const[pR,oR,bR]=await Promise.all([
      fetch(API+'/catalogues/panneaux'),
      fetch(API+'/catalogues/onduleurs'),
      fetch(API+'/catalogues/batteries'),
    ]);
    if(!pR.ok||!oR.ok||!bR.ok) throw new Error('Erreur HTTP catalogues');
    catPan=await pR.json();
    catInv=await oR.json();
    catBat=await bR.json();
    console.log(`✓ ${catPan.length} panneaux | ${catInv.length} onduleurs | ${Object.values(catBat).flat().length} batteries`);
    buildPanSel();
    buildInvSel();
    buildBatSel(document.getElementById('bat_type')?.value||'LiFePO4');
  }catch(e){
    console.error('Catalogues:',e.message);
    ['pan_sel','inv_sel','bat_sel'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.innerHTML='<option value="">Backend non disponible</option>';
    });
  }
}

function buildPanSel(){
  const el=document.getElementById('pan_sel');
  if(!el||!catPan.length) return;
  const trie=[...catPan].sort((a,b)=>
    parseFloat(a.puissance_wc)-parseFloat(b.puissance_wc));
  el.innerHTML=trie.map(p=>
    `<option value="${p.id}">${p.marque} ${p.modele} — ${p.puissance_wc} Wc`+
    `${p.technologie?' ('+p.technologie+')':''}</option>`
  ).join('')+'<option value="custom">➕ Personnalisé (saisie manuelle)</option>';
  el.selectedIndex=0;
  onPanSelect();
}

function buildInvSel(){
  const el=document.getElementById('inv_sel');
  if(!el||!catInv.length) return;
  const trie=[...catInv].sort((a,b)=>
    parseFloat(a.puissance_kva)-parseFloat(b.puissance_kva));
  el.innerHTML=trie.map(o=>
    `<option value="${o.id}">${o.marque} ${o.modele} — ${o.puissance_kva} kVA</option>`
  ).join('')+'<option value="custom">➕ Personnalisé (saisie manuelle)</option>';
  el.selectedIndex=0;
  onInvSelect();
}

function buildBatSel(type){
  const el=document.getElementById('bat_sel');
  if(!el) return;
  const models=catBat[type]||[];
  if(!models.length){
    el.innerHTML=`<option value="">Aucun modèle ${type}</option>`;
    return;
  }
  el.innerHTML=models.map((b,i)=>
    `<option value="${i}">${b.marque} ${b.modele} — `+
    `${b.capacite_kwh} kWh / ${b.tension_v}V `+
    `(DOD ${Math.round(b.dod*100)}% | ${b.cycles} cycles)</option>`
  ).join('')+'<option value="custom">➕ Personnalisé (saisie manuelle)</option>';
  el.selectedIndex=0;
  onBatSel();
}

function onPanSelect(){
  const v=document.getElementById('pan_sel')?.value;
  if(v==='custom'){
    // Activer les champs en mode édition manuelle
    ['pan_power','pan_voc','pan_vmp','pan_icc','pan_coeff'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){ el.readOnly=false; el.style.background='#fff'; el.value=''; }
    });
    const tech=document.getElementById('pan_tech');
    if(tech){ tech.readOnly=false; tech.value=''; }
    return;
  }
  const p=catPan.find(x=>x.id===v);
  if(!p) return;
  const setVal=(id,val)=>{
    const el=document.getElementById(id);
    if(el){ el.value=val; el.readOnly=true; el.style.background='#f8fafc'; }
  };
  setVal('pan_power', p.puissance_wc);
  setVal('pan_voc',   p.voc);
  setVal('pan_vmp',   p.vmp);
  setVal('pan_icc',   p.icc);
  setVal('pan_coeff', p.coeff_temp);
  const tech=document.getElementById('pan_tech');
  if(tech){ tech.value=p.technologie||'—'; tech.readOnly=true; }
}

function onInvSelect(){
  const v=document.getElementById('inv_sel')?.value;
  if(v==='custom'){
    ['inv_power','inv_eff','inv_vmin','inv_vmax','inv_vmax_abs'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){ el.readOnly=false; el.style.background='#fff'; el.value=''; }
    });
    return;
  }
  const o=catInv.find(x=>x.id===v);
  if(!o) return;
  const setVal=(id,val)=>{
    const el=document.getElementById(id);
    if(el){ el.value=val; el.readOnly=false; el.style.background='#f8fafc'; }
  };
  setVal('inv_power',    o.puissance_kva);
  setVal('inv_eff',      o.rendement);
  setVal('inv_vmin',     o.vmppt_min);
  setVal('inv_vmax',     o.vmppt_max);
  setVal('inv_vmax_abs', o.vmax);
}

function onBatType(){
  const t=document.getElementById('bat_type')?.value;
  if(t) buildBatSel(t);
}

function onBatSel(){
  const v=document.getElementById('bat_sel')?.value;
  if(v==='custom'){
    ['bat_kwh','bat_v','bat_dod','bat_eta'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){ el.readOnly=false; el.style.background='#fff'; el.value=''; }
    });
    return;
  }
  const type=document.getElementById('bat_type')?.value;
  const idx =parseInt(v)||0;
  const b   =(catBat[type]||[])[idx];
  if(!b) return;
  const setVal=(id,val)=>{
    const el=document.getElementById(id);
    if(el){ el.value=val; el.readOnly=false; el.style.background='#f8fafc'; }
  };
  setVal('bat_kwh', b.capacite_kwh);
  setVal('bat_v',   b.tension_v);
  setVal('bat_dod', Math.round(b.dod*100));
  setVal('bat_eta', Math.round(b.rendement*100));
}
// ════════════════════════════════════════════════════
// RAPPORT — Bascule entre vue technique et vue financière
// ════════════════════════════════════════════════════
function switchRapportTab(which){
  const isTech = which === 'technique';
  const tabTech = document.getElementById('tab-technique');
  const tabFin  = document.getElementById('tab-financier');
  const paneTech = document.getElementById('rapport-content');
  const paneFin  = document.getElementById('rapport-financier-content');
  if(tabTech)  tabTech.classList.toggle('active', isTech);
  if(tabFin)   tabFin.classList.toggle('active', !isTech);
  if(paneTech) paneTech.classList.toggle('active', isTech);
  if(paneFin)  paneFin.classList.toggle('active', !isTech);
}
