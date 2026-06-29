from flask import Flask, jsonify, request
from flask_cors import CORS
import json, os, math, urllib.request, urllib.parse, sqlite3
from datetime import datetime

app = Flask(__name__)
CORS(app)

CAT = os.path.join(os.path.dirname(__file__), 'catalogues')

# ════════════════════════════════════════════════════════════════
# BASE DE DONNÉES (SQLite) — persistance des projets
# ════════════════════════════════════════════════════════════════
# Chemin du fichier .db : déduit de DATABASE_URL (format
# "sqlite:///./solardim.db") si présent dans l'environnement,
# sinon solardim.db à côté de ce fichier (main.py).
# IMPORTANT : sqlite3 crée silencieusement un fichier VIDE si le
# chemin ne correspond à aucun fichier existant — d'où le message
# de diagnostic ci-dessous, à vérifier après chaque démarrage si
# la base semble vide alors qu'elle ne devrait pas l'être.
_db_url = os.environ.get('DATABASE_URL', 'sqlite:///./solardim.db')
DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    _db_url.replace('sqlite:///./', '').replace('sqlite:///', '')
)
_db_existait_deja = os.path.isfile(DB_PATH)
print(f"[DB] Chemin utilisé : {DB_PATH}")
print(f"[DB] Fichier {'existant — données conservées' if _db_existait_deja else 'ABSENT — un nouveau fichier VIDE va être créé ici'}")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Crée les tables si elles n'existent pas encore (idempotent —
    ne touche pas aux données existantes si la base est déjà là)."""
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prenom VARCHAR(100),
            nom VARCHAR(100),
            email VARCHAR(200),
            hashed_password VARCHAR(300),
            entreprise VARCHAR(200),
            plan VARCHAR(20),
            role VARCHAR(20),
            is_active BOOLEAN,
            created_at DATETIME
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS projets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            nom_projet VARCHAR(200),
            nom_site VARCHAR(200),
            nom_client VARCHAR(200),
            contact VARCHAR(200),
            adresse VARCHAR(300),
            ville VARCHAR(100),
            pays VARCHAR(10),
            ingenieur VARCHAR(200),
            ref_projet VARCHAR(100),
            type_projet VARCHAR(50),
            type_systeme VARCHAR(50),
            source_appoint VARCHAR(20),
            statut VARCHAR(30),
            data_input JSON,
            data_result JSON,
            created_at DATETIME,
            updated_at DATETIME
        )
    ''')
    # Si la table projets existait déjà avec un schéma plus ancien
    # (colonnes manquantes), on les ajoute pour rester compatible
    # sans perdre les données existantes.
    colonnes_attendues = {
        'nom_projet':     'VARCHAR(200)',
        'contact':        'VARCHAR(200)',
        'adresse':        'VARCHAR(300)',
        'source_appoint': 'VARCHAR(20)',
    }
    cols_existantes = [r['name'] for r in conn.execute('PRAGMA table_info(projets)').fetchall()]
    for col, type_sql in colonnes_attendues.items():
        if col not in cols_existantes:
            conn.execute(f'ALTER TABLE projets ADD COLUMN {col} {type_sql}')
    conn.commit()
    conn.close()

init_db()

# ════════════════════════════════════════════════════════════════
# CATALOGUES
# ════════════════════════════════════════════════════════════════
def get_panneaux():
    with open(os.path.join(CAT, 'panneaux.json'), encoding='utf-8') as f:
        return json.load(f)

def get_onduleurs():
    with open(os.path.join(CAT, 'onduleurs.json'), encoding='utf-8') as f:
        data = json.load(f)
    for o in data:
        if 'prix_fcfa' not in o:
            o['prix_fcfa'] = _prix_inv_defaut(float(o['puissance_kva']))
    return data

def get_batteries():
    with open(os.path.join(CAT, 'batteries.json'), encoding='utf-8') as f:
        return json.load(f)

def _prix_inv_defaut(kva):
    if kva <= 3:  return 85000
    if kva <= 5:  return 125000
    if kva <= 8:  return 195000
    if kva <= 10: return 220000
    if kva <= 15: return 280000
    return 350000

# ════════════════════════════════════════════════════════════════
# ALGORITHME — η=0.65 fixe
# ════════════════════════════════════════════════════════════════
ETA = 0.65

def calc_ppv(e_pv_kwh_j, hsp):
    """Ppv_calc = E_pv / (PSH × 0.65)"""
    if hsp <= 0: return 0
    return round(e_pv_kwh_j / (hsp * ETA), 3)


def _arrondi_section(s_calc):
    """Arrondit à la section normalisée supérieure (mm²)."""
    for s in [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150]:
        if s >= s_calc:
            return s
    return 150


def _section(i, usage='ac', longueur_m=None, tension_v=None):
    """
    Calcule la section de câble en cuivre selon IEC 60364 / NFC 15-100.

    Paramètres
    ----------
    i          : courant de calcul (A)
    usage      : 'dc' | 'ac' | 'batterie' | 'regulateur'
    longueur_m : longueur du câble aller (m) — optionnel, pour vérif. chute de tension
    tension_v  : tension du circuit (V)       — requis si longueur_m fourni

    Sections minimales imposées par usage
    --------------------------------------
    dc         : 4 mm²  (résistance UV, bipolaire, norme PV)
    batterie   : aucun minimum forcé — dimensionnée uniquement par le
                 courant calculé (Iz ≥ I, comme pour AC)
    regulateur : 6 mm²
    ac         : 1.5 mm² (standard)
    """
    # ── Courant admissible → section de base (câble Cu, isolant 90°C, pose libre) ──
    if   i <= 13:  s = 1.5
    elif i <= 18:  s = 2.5
    elif i <= 24:  s = 4
    elif i <= 32:  s = 6
    elif i <= 41:  s = 10
    elif i <= 57:  s = 16
    elif i <= 76:  s = 25
    elif i <= 96:  s = 35
    elif i <= 120: s = 50
    elif i <= 150: s = 70
    elif i <= 185: s = 95
    elif i <= 240: s = 120
    else:          s = 150

    # ── Section minimale réglementaire par usage ──────────────
    if usage == 'dc':
        s = max(s, 4.0)
    elif usage == 'regulateur':
        s = max(s, 6.0)
    # 'batterie' et 'ac' : pas de minimum supplémentaire, le courant
    # calculé (avec facteur de sécurité 1.25 déjà appliqué) décide seul.

    # ── Vérification chute de tension (3 % max) ──────────────
    # ΔU% = (ρ × 2L × I) / (s × U)  ≤ 3 %
    # → s_min = (ρ × 2L × I) / (ΔU_max × U)
    if longueur_m and longueur_m > 0 and tension_v and tension_v > 0 and i > 0:
        rho       = 0.0225   # résistivité Cu à 70°C (Ω·mm²/m)
        delta_u   = 0.03     # 3 % max (DC et AC BT)
        s_chute   = (rho * 2 * longueur_m * i) / (delta_u * tension_v)
        s         = max(s, _arrondi_section(s_chute))

    return s


def optimiser_config_sp(ppv_kwc, pan_wc, pan_voc, pan_vmp,
                         inv_vmin, inv_vmax_mppt, inv_vmax_abs,
                         tmin, tmax, pan_gamma_pct,
                         pan_icc=None, inv_imax_dc=None):
    """
    Trouve (Ns, Np) tel que Ns × Np × Pwc >= ppv_kwc.

    Stratégie corrigée : parcourir de ns_max vers ns_min.
    Un Ns élevé → Np plus faible → N total minimal → moins de câblage parallèle.
    ppv_installe >= ppv_calcule TOUJOURS.

    Np est désormais AUSSI limité par le courant DC maximal admissible en
    entrée de l'onduleur (inv_imax_dc, somme sur tous ses MPPT) : le
    courant total du champ PV (Np strings en parallèle, chacun à pan_icc,
    avec un facteur de sécurité de 1.25 conforme IEC/NEC) ne doit jamais
    dépasser cette limite. Si inv_imax_dc n'est pas fourni, cette
    contrainte est ignorée (comportement antérieur, rétrocompatible).
    """
    gamma    = pan_gamma_pct / 100
    voc_tmin = round(pan_voc * (1 + gamma * (tmin - 25)), 3)
    vmp_tmax = round(pan_vmp * (1 + gamma * (tmax - 25)), 3)   # Vmp à Tmax (tension min)
    vmp_tmin = round(pan_vmp * (1 + gamma * (tmin - 25)), 3)   # Vmp à Tmin (tension max)

    # Np max admissible par le courant DC de l'onduleur (si renseigné)
    np_max_courant = None
    if pan_icc and inv_imax_dc:
        np_max_courant = math.floor(inv_imax_dc / (pan_icc * 1.25))
        np_max_courant = max(1, np_max_courant)

    # Contraintes Ns
    ns_max_abs  = math.floor(inv_vmax_abs  / voc_tmin) if voc_tmin > 0 else 10
    ns_max_mppt = math.floor(inv_vmax_mppt / vmp_tmin) if vmp_tmin > 0 else 10
    ns_min_mppt = math.ceil(inv_vmin       / vmp_tmax) if vmp_tmax > 0 else 1

    ns_min = max(1, ns_min_mppt)
    ns_max = min(ns_max_abs, ns_max_mppt)
    if ns_max < ns_min:
        ns_max = ns_min

    ppv_w    = ppv_kwc * 1000
    meilleur = None

    # ── Parcours du PLUS GRAND Ns vers le plus petit ──────────
    # Objectif : minimiser N total = Ns × Np
    # À Ppv fixé, augmenter Ns réduit Np (et souvent N total)
    for ns in range(ns_max, ns_min - 1, -1):
        np = math.ceil(ppv_w / (ns * pan_wc))
        if np < 1:
            np = 1

        ppv_inst = round(ns * np * pan_wc / 1000, 3)

        # Garantie ppv_inst >= ppv_calc
        if ppv_inst < ppv_kwc - 0.001:
            np += 1
            ppv_inst = round(ns * np * pan_wc / 1000, 3)

        n_total = ns * np
        ecart   = ppv_inst - ppv_kwc   # toujours >= 0
        valid_tension = (ns_min_mppt <= ns <= ns_max_mppt) and (ns <= ns_max_abs)
        valid_courant = (np_max_courant is None) or (np <= np_max_courant)
        valid = valid_tension and valid_courant

        if meilleur is None:
            # Premier candidat
            meilleur = {
                'ns': ns, 'np': np,
                'ppv_inst':  ppv_inst,
                'n_total':   n_total,
                'valid':     valid,
                'valid_courant': valid_courant,
                'ecart_pct': round(ecart / ppv_kwc * 100, 1) if ppv_kwc > 0 else 0,
                'voc_tmin_str': round(voc_tmin * ns, 1),
                'vmp_tmax_str': round(vmp_tmax * ns, 1),
                'vmp_tmin_str': round(vmp_tmin * ns, 1),
            }
        else:
            # Remplacer si : (a) on passe de invalide à valide,
            #                (b) même validité et N total plus petit,
            #                (c) même validité, même N total et écart plus petit.
            mieux = (
                (valid and not meilleur['valid'])
                or (valid == meilleur['valid'] and n_total < meilleur['n_total'])
                or (valid == meilleur['valid'] and n_total == meilleur['n_total']
                    and ecart < (meilleur['ppv_inst'] - ppv_kwc))
            )
            if mieux:
                meilleur = {
                    'ns': ns, 'np': np,
                    'ppv_inst':  ppv_inst,
                    'n_total':   n_total,
                    'valid':     valid,
                    'valid_courant': valid_courant,
                    'ecart_pct': round(ecart / ppv_kwc * 100, 1) if ppv_kwc > 0 else 0,
                    'voc_tmin_str': round(voc_tmin * ns, 1),
                    'vmp_tmax_str': round(vmp_tmax * ns, 1),
                    'vmp_tmin_str': round(vmp_tmin * ns, 1),
                }

    # ── Fallback si aucune solution trouvée ───────────────────
    if meilleur is None:
        ns = max(1, ns_min)
        np = math.ceil(ppv_w / (ns * pan_wc))
        if np < 1:
            np = 1
        ppv_inst = round(ns * np * pan_wc / 1000, 3)
        if ppv_inst < ppv_kwc - 0.001:
            np += 1
            ppv_inst = round(ns * np * pan_wc / 1000, 3)
        meilleur = {
            'ns': ns, 'np': np, 'ppv_inst': ppv_inst,
            'n_total': ns * np, 'valid': False,
            'ecart_pct': round((ppv_inst - ppv_kwc) / ppv_kwc * 100, 1) if ppv_kwc > 0 else 0,
            'voc_tmin_str': round(voc_tmin * ns, 1),
            'vmp_tmax_str': round(vmp_tmax * ns, 1),
            'vmp_tmin_str': round(vmp_tmin * ns, 1),
        }

    meilleur.update({
        'voc_corr': voc_tmin, 'vmp_corr_max': vmp_tmin, 'vmp_corr_min': vmp_tmax,
        'ns_min_mppt': ns_min_mppt, 'ns_max_mppt': ns_max_mppt, 'ns_max_abs': ns_max_abs,
    })
    return meilleur


def choisir_onduleur(p_charge_w, coeff_inv, taux_solaire, ppv_kwc, n_max=4):
    """
    P_onduleur requise = P_charges(kW) × facteur_scénario × coeff_inv
    coeff_inv : choisi par l'utilisateur (1.2 / 1.3 / 1.4 / 1.5)
    facteur_scénario : taux_solaire / 100 — une puissance d'onduleur
                       différente est calculée pour chaque scénario.

    Sélection : on cherche d'abord un SEUL onduleur du catalogue
    capable de couvrir P_inv_requise (le plus proche en valeur
    absolue). Ce n'est QUE SI aucun onduleur seul du catalogue
    n'atteint cette puissance (P_inv_requise > puissance du plus
    gros modèle disponible) qu'on propose plusieurs onduleurs
    identiques montés en parallèle (leurs puissances s'additionnent) :
    on prend alors le modèle le plus puissant du catalogue et on
    augmente n jusqu'à couvrir le besoin (n borné à n_max).

    Retourne : (onduleur_sélectionné, ratio, etat, p_inv_requise, n)
    """
    catalogue = get_onduleurs()
    facteur       = taux_solaire / 100
    p_charges_kva = p_charge_w / 1000
    p_inv_requise = p_charges_kva * facteur * coeff_inv

    trie = sorted(catalogue, key=lambda x: float(x['puissance_kva']))
    p_max_catalogue = float(trie[-1]['puissance_kva']) if trie else 0

    n = 1
    if p_inv_requise > p_max_catalogue and p_max_catalogue > 0:
        # Aucun onduleur seul ne suffit → plusieurs unités du modèle
        # le plus puissant du catalogue, montées en parallèle.
        n = min(n_max, math.ceil(p_inv_requise / p_max_catalogue))

    meilleur  = None
    ecart_min = float('inf')
    for inv in trie:
        p_cumulee = float(inv['puissance_kva']) * n
        ecart = abs(p_cumulee - p_inv_requise)
        if ecart < ecart_min:
            ecart_min = ecart
            meilleur  = inv

    if meilleur is None:
        meilleur = trie[-1]
        n = 1

    p_cumulee = round(float(meilleur['puissance_kva']) * n, 2)
    ratio = round(ppv_kwc / p_cumulee, 2) if p_cumulee > 0 else 0
    etat  = ('vert'   if 0.9 <= ratio <= 1.3 else
             'orange' if 0.7 <= ratio <= 1.5 else 'rouge')

    return meilleur, ratio, etat, round(p_inv_requise, 2), n


def choisir_batterie(cap_kwh_req, bat_type):
    catalogue = get_batteries()
    modeles   = catalogue.get(bat_type, list(catalogue.values())[0])
    if not modeles: return None, -1
    trie_idx = sorted(range(len(modeles)), key=lambda i: float(modeles[i]['capacite_kwh']))
    meilleur_idx = trie_idx[0]; score_min = float('inf')
    for i in trie_idx:
        b = modeles[i]
        cap_u = float(b['capacite_kwh'])
        n     = math.ceil(cap_kwh_req / cap_u)
        score = n * 10 + (n * cap_u - cap_kwh_req)
        if score < score_min:
            score_min = score; meilleur_idx = i
    return modeles[meilleur_idx], meilleur_idx


def calc_batterie(e_pv_kwh_j, e_nuit_kwh_j, jours, taux_solaire, dod, eta_bat):
    e_stockee = min(e_pv_kwh_j * 0.55, e_nuit_kwh_j)
    if   taux_solaire == 100: j_eff = jours
    elif taux_solaire >= 75:  j_eff = max(1.0, jours * 0.75)
    elif taux_solaire >= 50:  j_eff = max(0.5, jours * 0.5)
    else:                     j_eff = max(0.5, jours * 0.3)
    cap_kwh = (e_stockee * j_eff) / (dod * eta_bat)
    cap_ah  = (e_stockee * 1000 * j_eff) / (48 * dod * eta_bat)
    return round(cap_kwh, 2), round(cap_ah, 1), round(j_eff, 1)


def _calibre_normalise(i_calc):
    """
    Retourne le calibre commercial normalisé le plus proche AU-DESSUS
    de l'intensité calculée (gamme standard fusibles/disjoncteurs).
    Ex: 12.75 A calculé → 16 A commercial.
    Le calibre retourné est TOUJOURS >= i_calc (règle de sécurité).
    """
    gamme = [1, 2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100,
             125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250]
    for cal in gamme:
        if cal >= i_calc:
            return cal
    # Au-delà de la gamme normalisée (cas extrême, très rare) :
    # on arrondit au-dessus à la dizaine pour rester >= i_calc.
    return math.ceil(i_calc / 10) * 10


# Courant admissible Iz (A) par section de câble Cu, correspondant
# exactement aux mêmes seuils que _section() (méthode de référence,
# isolant 90°C, pose libre, cuivre — cohérent avec IEC 60364-5-52).
_IZ_PAR_SECTION = {
    1.5: 13, 2.5: 18, 4: 24, 6: 32, 10: 41, 16: 57,
    25: 76, 35: 96, 50: 120, 70: 150, 95: 185, 120: 240, 150: 1000,
}


def _verifier_protection_cable(i_protection, section_mm2):
    """
    Vérifie la cohérence normative IEC 60364-4-43 / NFC 15-100 entre
    le calibre de la protection et le courant admissible (Iz) du câble :
        I_protection ≤ Iz(section)
    Si le calibre dépasse Iz, le câble n'est plus protégé contre les
    surcharges en cas de défaut — la protection ne joue plus son rôle.
    Retourne (conforme: bool, iz: float, message: str|None).
    """
    iz = _IZ_PAR_SECTION.get(section_mm2, 1000)
    if i_protection <= iz:
        return True, iz, None
    return (False, iz,
            f"⚠ Non conforme IEC 60364 : protection {i_protection}A > "
            f"Iz câble {iz}A ({section_mm2}mm²) — câble non protégé contre les surcharges")


def _parafoudre_dc(voc_string_v):
    """
    Sélectionne le calibre de tension du parafoudre DC Type 2 (SPD)
    selon la tension Voc string max attendue (IEC 60364-7-712).
    Gamme commerciale standard : 1000 / 1200 / 1500 V DC.
    Courant de décharge total typique : 40 kA (8/20 µs), Up ≤ 4 kV.
    """
    if voc_string_v is None:
        voc_string_v = 0
    if voc_string_v <= 1000:
        calibre_v = 1000
    elif voc_string_v <= 1200:
        calibre_v = 1200
    else:
        calibre_v = 1500
    return {
        'label':           f'Parafoudre DC Type 2 — {calibre_v} V DC',
        'type':             2,
        'tension_max_v':    calibre_v,
        'courant_decharge_ka': 40,
        'niveau_protection_kv': 4,
        'obligatoire':      True,
        'norme':           'IEC 60364-7-712 / UTE C 15-712-1',
        'note': ("Obligatoire entre le champ PV et l'onduleur si la distance "
                 "boîte de jonction → onduleur dépasse 10 m, ou en l'absence "
                 "de protection foudre externe (parafoudre primaire)."),
    }


def calc_cables(pan_icc, n_par, inv_kva, v_bat, ppv_inst, voc_string_v=None):
    """
    Calcule TOUTES les sections de câbles :
    - DC (chaîne et champ PV)      → section min 4 mm², usage='dc'
    - AC (sortie onduleur)          → usage='ac'
    - Batterie (charge/décharge)    → section min 16 mm², usage='batterie'
    - Régulateur MPPT               → section min 6 mm², usage='regulateur'
    Et toutes les protections associées, y compris le parafoudre DC
    (obligatoire côté PV selon IEC 60364-7-712 / UTE C 15-712-1,
    notamment si la distance boîte de jonction → onduleur dépasse 10 m).

    voc_string_v : tension Voc du string corrigée en froid (V) — utilisée
                   pour choisir le calibre de tension du parafoudre DC
                   (1000 / 1200 / 1500 V DC selon la tension max du système).
    """

    # ── Câble DC ──────────────────────────────────────────────
    i_chaine  = round(pan_icc * 1.25, 1)
    i_champ   = round(pan_icc * n_par * 1.25, 1)

    # ── Câble AC sortie onduleur ──────────────────────────────
    i_ac      = round(inv_kva * 1000 / (230 * 0.95), 1)

    # ── Câble batterie ────────────────────────────────────────
    # I_bat = P_onduleur / V_bat × 1.25
    i_bat     = round(inv_kva * 1000 / v_bat * 1.25, 1)

    # ── Câble régulateur MPPT ─────────────────────────────────
    i_reg     = round(ppv_inst * 1000 / v_bat * 1.25, 1)

    # ── Sections de câbles dimensionnées sur le courant réel calculé ──
    sec_dc  = _section(i_champ, usage='dc')
    sec_ac  = _section(i_ac * 1.25, usage='ac')
    sec_bat = _section(i_bat, usage='batterie')
    sec_reg = _section(i_reg, usage='regulateur')

    # ── Calibres normalisés des protections ────────────────────
    # Le calibre est d'abord arrondi au palier commercial supérieur
    # au courant réel, PUIS plafonné à Iz(câble) si besoin pour
    # respecter IEC 60364-4-43 (I_protection ≤ Iz). On ne redimensionne
    # jamais le câble à la hausse pour "suivre" le calibre — c'est le
    # calibre qui doit rester dans la limite du câble déjà choisi.
    cal_fus_chaine = min(_calibre_normalise(i_chaine), _IZ_PAR_SECTION.get(sec_dc, 1000))
    cal_fus_champ  = min(_calibre_normalise(i_champ),  _IZ_PAR_SECTION.get(sec_dc, 1000))
    cal_disj_ac    = min(_calibre_normalise(i_ac * 1.25), _IZ_PAR_SECTION.get(sec_ac, 1000))
    cal_disj_bat   = min(_calibre_normalise(i_bat), _IZ_PAR_SECTION.get(sec_bat, 1000))

    # ── Vérification normative IEC 60364-4-43 : I_protection ≤ Iz(câble) ──
    ok_chaine, iz_chaine, msg_chaine = _verifier_protection_cable(cal_fus_chaine, sec_dc)
    ok_champ,  iz_champ,  msg_champ  = _verifier_protection_cable(cal_fus_champ,  sec_dc)
    ok_ac,     iz_ac,     msg_ac     = _verifier_protection_cable(cal_disj_ac,    sec_ac)
    ok_bat,    iz_bat,    msg_bat    = _verifier_protection_cable(cal_disj_bat,   sec_bat)

    alertes_normes = [m for m in (msg_chaine, msg_champ, msg_ac, msg_bat) if m]
    conforme_norme = not alertes_normes

    # ── Parafoudre DC (obligatoire côté PV, IEC 60364-7-712) ──
    spd_dc = _parafoudre_dc(voc_string_v)

    return {
        'dc': {
            'label':       'Câble DC — Champ PV',
            'i_chaine_a':  i_chaine,
            'i_champ_a':   i_champ,
            'section_mm2': sec_dc,
        },
        'ac': {
            'label':       'Câble AC — Sortie onduleur',
            'i_ac_a':      i_ac,
            'section_mm2': sec_ac,
        },
        'batterie': {
            'label':       'Câble batterie',
            'i_bat_a':     i_bat,
            'section_mm2': sec_bat,
        },
        'regulateur': {
            'label':       'Câble régulateur MPPT',
            'i_reg_a':     i_reg,
            'section_mm2': sec_reg,
        },
        'parafoudre_dc': spd_dc,
        'protections': {
            # Valeurs calculées brutes (conservées pour compatibilité / calculs internes)
            'fus_chaine_a': round(pan_icc * 1.25, 1),
            'fus_champ_a':  round(pan_icc * n_par * 1.25, 1),
            'disj_ac_a':    round(i_ac * 1.25, 1),
            'disj_bat_a':   round(i_bat, 1),

            # Calibres commerciaux normalisés + courbe de déclenchement (rapport)
            'fus_chaine_calibre':  f"{cal_fus_chaine} A",
            'fus_champ_calibre':   f"{cal_fus_champ} A",
            'disj_dc_bat_calibre': f"Disjoncteur DC Type C — {cal_disj_bat} A",
            'disj_ac_calibre':     f"Disjoncteur AC Type C — {cal_disj_ac} A",
            'parafoudre_dc_label': spd_dc['label'],

            # Conformité IEC 60364-4-43 (I_protection ≤ Iz câble)
            'conformite_iec': {
                'conforme':       conforme_norme,
                'alertes':        alertes_normes,
                'fus_chaine_iz':  iz_chaine, 'fus_chaine_ok': ok_chaine,
                'fus_champ_iz':   iz_champ,  'fus_champ_ok':  ok_champ,
                'disj_ac_iz':     iz_ac,     'disj_ac_ok':    ok_ac,
                'disj_bat_iz':    iz_bat,    'disj_bat_ok':   ok_bat,
            },
        },
    }


# ════════════════════════════════════════════════════════════════
# GÉOCODAGE — Open-Meteo Geocoding API (gratuit, sans clé)
# ════════════════════════════════════════════════════════════════
def _geocoder(query):
    """
    Convertit un nom de lieu (ville, région, pays) en lat/lon.
    Utilise l'API de géocodage Open-Meteo (gratuite, sans clé API).
    """
    url = ('https://geocoding-api.open-meteo.com/v1/search?'
           + urllib.parse.urlencode({'name': query, 'count': 1, 'language': 'fr', 'format': 'json'}))
    req = urllib.request.Request(url, headers={'User-Agent': 'SolarDimPro/1.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))

    resultats = data.get('results') or []
    if not resultats:
        raise ValueError(f"Lieu introuvable : {query}")

    r = resultats[0]
    nom_parts = [r.get('name', '')]
    if r.get('admin1'): nom_parts.append(r['admin1'])
    if r.get('country'): nom_parts.append(r['country'])

    return {
        'lat': float(r['latitude']),
        'lon': float(r['longitude']),
        'nom': ', '.join(p for p in nom_parts if p),
    }


# ════════════════════════════════════════════════════════════════
# MÉTÉO — NASA POWER API (gratuite, sans clé)
# Fournit : irradiation horizontale (GHI / HSP) et température
# ════════════════════════════════════════════════════════════════
def _meteo_nasa(lat, lon):
    """
    Récupère les moyennes climatologiques (20 ans) depuis NASA POWER :
    - ALLSKY_SFC_SW_DWN : irradiation globale horizontale (kWh/m²/j) → HSP
    - T2M               : température moyenne à 2m (°C)
    Endpoint 'climatology' : pas besoin de plage de dates, renvoie
    directement les moyennes mensuelles + annuelle (clé 'ANN').
    """
    params = {
        'parameters': 'ALLSKY_SFC_SW_DWN,T2M',
        'community': 'RE',
        'longitude': lon,
        'latitude':  lat,
        'format':    'JSON',
    }
    url = 'https://power.larc.nasa.gov/api/temporal/climatology/point?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': 'SolarDimPro/1.0'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode('utf-8'))

    props = data.get('properties', {}).get('parameter', {})
    ghi   = props.get('ALLSKY_SFC_SW_DWN', {})
    temp  = props.get('T2M', {})

    if not ghi or not temp:
        raise ValueError("Données NASA POWER indisponibles pour ce point")

    # 'ANN' = moyenne annuelle ; fallback sur la moyenne des 12 mois si absente
    def _moyenne_annuelle(d):
        if 'ANN' in d:
            return float(d['ANN'])
        mois = [float(v) for k, v in d.items() if k != 'ANN']
        return sum(mois) / len(mois) if mois else 0.0

    irr_ghi  = round(_moyenne_annuelle(ghi), 2)   # kWh/m²/j ≈ HSP (irradiation horizontale)
    temp_amb = round(_moyenne_annuelle(temp), 1)  # °C

    return {
        'hsp':      irr_ghi,
        'irr_ghi':  irr_ghi,
        'temp_amb': temp_amb,
        'source':   'NASA POWER (climatologie 20 ans)',
    }


# ════════════════════════════════════════════════════════════════
# ROUTES GÉOCODAGE / MÉTÉO
# ════════════════════════════════════════════════════════════════
@app.route('/geocode')
def geocode_route():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'error': 'Paramètre q manquant'}), 400
    try:
        return jsonify(_geocoder(q))
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': f"Erreur géocodage : {e}"}), 500


@app.route('/meteo')
def meteo_route():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    if lat is None or lon is None:
        return jsonify({'error': 'Paramètres lat/lon manquants'}), 400
    try:
        lat_f, lon_f = float(lat), float(lon)
        return jsonify(_meteo_nasa(lat_f, lon_f))
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': f"Erreur météo NASA : {e}"}), 500


# ════════════════════════════════════════════════════════════════
# ROUTES CATALOGUES
# ════════════════════════════════════════════════════════════════
@app.route('/catalogues/panneaux')
def panneaux():
    return jsonify(get_panneaux())

@app.route('/catalogues/onduleurs')
def onduleurs_route():
    return jsonify(get_onduleurs())

@app.route('/catalogues/batteries')
def batteries_route():
    return jsonify(get_batteries())


# ════════════════════════════════════════════════════════════════
# PRÉ-CALCUL
# ════════════════════════════════════════════════════════════════
@app.route('/precalcul', methods=['POST'])
def precalcul():
    d = request.get_json()
    if not d: return jsonify({'error': 'Données manquantes'}), 400
    try:
        e_brute, p_max = _calc_energie(d)
        hsp       = float(d.get('hsp', 5.5))
        jours     = float(d.get('jours_autonomie', 2))
        bat_t     = d.get('bat_type', 'LiFePO4')
        coeff_inv = float(d.get('coeff_inv', 1.3))

        dod_map   = {'LiFePO4':0.90,'AGM':0.50,'GEL':0.70,'OPzV':0.80}
        eta_b_map = {'LiFePO4':0.95,'AGM':0.85,'GEL':0.87,'OPzV':0.88}
        dod       = dod_map.get(bat_t, 0.80)
        eta_bat   = eta_b_map.get(bat_t, 0.90)
        e_nuit    = e_brute * 0.50

        res = {}
        for taux in [100, 75, 50, 30]:
            e_pv   = round(e_brute * taux/100, 3)
            ppv    = calc_ppv(e_pv, hsp)
            inv, ratio, etat, p_req, n_inv = choisir_onduleur(p_max, coeff_inv, taux, ppv)
            cap, _, j_eff = calc_batterie(e_pv, e_nuit, jours, taux, dod, eta_bat)
            bat, _bat_idx = choisir_batterie(cap, bat_t)
            n_bat  = math.ceil(cap / float(bat['capacite_kwh'])) if bat else 0
            inv_label = f"{inv['marque']} {inv['modele']} — {inv['puissance_kva']} kVA"
            if n_inv > 1:
                inv_label = f"{n_inv} × {inv_label}"
            res[str(taux)] = {
                'ppv_kwc':   ppv,
                'inv_label': inv_label,
                'bat_label': (f"{bat['marque']} {bat['modele']} × {n_bat} = "
                              f"{round(n_bat*float(bat['capacite_kwh']),1)} kWh") if bat else '—',
            }

        return jsonify({
            'e_brute_kwh_j': round(e_brute, 3),
            'p_charges_kw':  round(p_max/1000, 2),
            'ppv_100_kwc': res['100']['ppv_kwc'], 'ppv_75_kwc': res['75']['ppv_kwc'],
            'ppv_50_kwc':  res['50']['ppv_kwc'],  'ppv_30_kwc': res['30']['ppv_kwc'],
            'inv_rec_100': res['100']['inv_label'],'inv_rec_75': res['75']['inv_label'],
            'inv_rec_50':  res['50']['inv_label'], 'inv_rec_30': res['30']['inv_label'],
            'bat_rec_100': res['100']['bat_label'],'bat_rec_75': res['75']['bat_label'],
            'bat_rec_50':  res['50']['bat_label'], 'bat_rec_30': res['30']['bat_label'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# CALCUL 4 SCÉNARIOS
# ════════════════════════════════════════════════════════════════
@app.route('/calculer', methods=['POST'])
def calculer():
    d = request.get_json()
    if not d: return jsonify({'error': 'Données manquantes'}), 400
    try:
        scenarios = [_calc_scenario(d, t) for t in [100, 75, 50, 30]]
        return jsonify({'scenarios': scenarios})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# PROJETS — persistance dans la base SQLite (table `projets`)
# Pas d'authentification pour l'instant : user_id reste NULL.
# Le payload frontend (nom_projet, nom_client, ..., scenarios) est
# mappé sur les colonnes ; le tableau `scenarios` complet (résultats
# des 4 taux) est stocké tel quel en JSON dans data_result.
# ════════════════════════════════════════════════════════════════
def _projet_row_to_dict(row):
    """Convertit une ligne SQLite de la table projets en dict prêt
    à être renvoyé au frontend, sous la forme attendue par calcul.js
    (scenarios à plat, pas data_result imbriqué)."""
    d = dict(row)
    data_result = json.loads(d.pop('data_result') or '{}')
    json.loads(d.pop('data_input') or '{}')  # conservé en base, pas renvoyé tel quel
    d['scenarios'] = data_result.get('scenarios', [])
    return d

@app.route('/projets', methods=['GET'])
def lister_projets():
    conn = get_db()
    rows = conn.execute(
        'SELECT id, nom_projet, nom_client, nom_site, type_projet, '
        'statut, data_result, created_at, updated_at FROM projets ORDER BY updated_at DESC'
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        try:
            scenarios = json.loads(d.pop('data_result') or '{}').get('scenarios', [])
            s0 = scenarios[0] if scenarios else {}
            d['ppv_installe_kwc']    = s0.get('generateur_pv', {}).get('ppv_installe_kwc', 0)
            d['capacite_inst_kwh']   = s0.get('stockage', {}).get('capacite_inst_kwh', 0)
        except (json.JSONDecodeError, TypeError):
            d.pop('data_result', None)
            d['ppv_installe_kwc']  = 0
            d['capacite_inst_kwh'] = 0
        out.append(d)
    return jsonify(out)

@app.route('/projets/<int:projet_id>', methods=['GET'])
def obtenir_projet(projet_id):
    conn = get_db()
    row = conn.execute('SELECT * FROM projets WHERE id = ?', (projet_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Projet introuvable'}), 404
    return jsonify(_projet_row_to_dict(row))

@app.route('/projets', methods=['POST'])
def sauvegarder_projet():
    """Crée un nouveau projet (pas d'id dans le body) ou met à jour
    un projet existant (id présent et trouvé en base)."""
    d = request.get_json()
    if not d:
        return jsonify({'error': 'Données manquantes'}), 400

    now = datetime.utcnow().isoformat()
    projet_id = d.get('id')

    data_input  = json.dumps(d.get('params_calcul', {}), ensure_ascii=False)
    data_result = json.dumps({'scenarios': d.get('scenarios', [])}, ensure_ascii=False)

    conn = get_db()
    if projet_id:
        existe = conn.execute('SELECT id FROM projets WHERE id = ?', (projet_id,)).fetchone()
    else:
        existe = None

    champs = {
        'nom_projet':     d.get('nom_projet', ''),
        'nom_site':       d.get('nom_site', ''),
        'nom_client':     d.get('nom_client', ''),
        'contact':        d.get('contact', ''),
        'adresse':        d.get('adresse', ''),
        'ville':          d.get('ville', ''),
        'pays':           d.get('pays', ''),
        'ingenieur':      d.get('ingenieur', ''),
        'ref_projet':     d.get('ref_projet', ''),
        'type_projet':    d.get('type_projet', ''),
        'type_systeme':   d.get('type_systeme', ''),
        'source_appoint': d.get('source_appoint', ''),
        'statut':         d.get('statut', 'brouillon'),
        'data_input':     data_input,
        'data_result':    data_result,
    }

    if existe:
        conn.execute(
            'UPDATE projets SET ' + ', '.join(f'{k} = ?' for k in champs) +
            ', updated_at = ? WHERE id = ?',
            list(champs.values()) + [now, projet_id]
        )
        conn.commit()
        result_id = projet_id
    else:
        champs['user_id']    = None
        champs['created_at'] = now
        champs['updated_at'] = now
        cols = ', '.join(champs.keys())
        qs   = ', '.join('?' for _ in champs)
        cur  = conn.execute(f'INSERT INTO projets ({cols}) VALUES ({qs})', list(champs.values()))
        conn.commit()
        result_id = cur.lastrowid

    row = conn.execute('SELECT * FROM projets WHERE id = ?', (result_id,)).fetchone()
    conn.close()
    return jsonify(_projet_row_to_dict(row))

@app.route('/projets/<int:projet_id>', methods=['DELETE'])
def supprimer_projet(projet_id):
    conn = get_db()
    conn.execute('DELETE FROM projets WHERE id = ?', (projet_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


def _calculer_tri(investissement, flux_annuel, duree_ans, degradation_pct=0.5):
    """
    Calcule le vrai Taux de Rentabilité Interne (TRI / IRR) : le taux
    d'actualisation r qui annule la VAN sur la durée du projet.
        0 = -I + Σ [flux_t / (1+r)^t]   pour t = 1..duree_ans
    flux_t tient compte de la dégradation de production PV (panneaux
    perdent en efficacité avec le temps, donc les économies diminuent
    légèrement chaque année).
    Résolution par dichotomie (bissection) — robuste, pas besoin de
    dérivée, converge toujours sur l'intervalle testé.
    Retourne le TRI en % (ex: 12.4 pour 12.4%), ou None si pas de
    solution dans la plage testée (investissement jamais rentabilisé).
    """
    if investissement <= 0 or flux_annuel <= 0:
        return None

    def van_pour_taux(r):
        van = -investissement
        flux_t = flux_annuel
        for t in range(1, duree_ans + 1):
            van += flux_t / ((1 + r) ** t)
            flux_t *= (1 - degradation_pct / 100)  # dégradation production
        return van

    # Recherche par dichotomie entre -50% et +200% de taux annuel
    r_bas, r_haut = -0.50, 2.00
    van_bas  = van_pour_taux(r_bas)
    van_haut = van_pour_taux(r_haut)

    # Si la VAN ne change jamais de signe sur l'intervalle, pas de TRI réel
    if van_bas * van_haut > 0:
        return None

    for _ in range(100):  # 100 itérations → précision largement suffisante
        r_mid   = (r_bas + r_haut) / 2
        van_mid = van_pour_taux(r_mid)
        if abs(van_mid) < 1:  # convergence (à 1 FCFA près)
            break
        if van_bas * van_mid < 0:
            r_haut = r_mid
        else:
            r_bas = r_mid
            van_bas = van_mid

    return round(r_mid * 100, 2)  # en %


def _calculer_lcoe(investissement, opex_annuel, prod_an_kwh, taux_actualisation_pct,
                    duree_ans=20, degradation_pct=0.5):
    """
    Calcule le LCOE (Levelized Cost of Energy) selon la formule standard
    actualisée, en FCFA/kWh :
        LCOE = [CAPEX + Σ OPEX_t/(1+r)^t] / [Σ E_t/(1+r)^t]
    La production E_t décroît chaque année selon la dégradation PV
    (panneaux perdent en efficacité, ~0.5%/an typiquement).
    Les coûts et l'énergie sont tous deux actualisés au même taux r,
    ce qui est la pratique standard pour rendre le LCOE comparable
    dans le temps (sinon on compare des FCFA d'années différentes).
    """
    if prod_an_kwh <= 0:
        return 0

    r = taux_actualisation_pct / 100
    cout_total_actualise   = investissement
    energie_totale_actualisee = 0.0
    prod_t = prod_an_kwh

    for t in range(1, duree_ans + 1):
        cout_total_actualise      += opex_annuel / ((1 + r) ** t)
        energie_totale_actualisee += prod_t / ((1 + r) ** t)
        prod_t *= (1 - degradation_pct / 100)

    if energie_totale_actualisee <= 0:
        return 0

    return round(cout_total_actualise / energie_totale_actualisee, 2)


def _calc_scenario(d, taux):
    facteur  = taux / 100.0
    appoint  = d.get('source_appoint', 'reseau')

    hsp      = float(d.get('hsp', 5.5))
    pr       = float(d.get('pr_pct', 80))
    tmin     = float(d.get('temp_min', 15))
    tmax     = float(d.get('temp_max', 70))
    temp_amb = float(d.get('temp_amb', 30))

    pan_wc    = float(d.get('pan_puissance_wc', 550))
    pan_voc   = float(d.get('pan_voc', 49.5))
    pan_vmp   = float(d.get('pan_vmp', 41.2))
    pan_icc   = float(d.get('pan_icc', 10.2))
    pan_gamma = float(d.get('pan_coeff_temp', -0.35))

    bat_type  = d.get('bat_type', 'LiFePO4')
    v_bat     = float(d.get('bat_tension_v', 48))
    jours     = float(d.get('jours_autonomie', 2))
    coeff_inv = float(d.get('coeff_inv', 1.3))

    # Prix par scénario : priorité aux clés suffixées (ex: prix_panneau_100),
    # fallback sur l'ancien champ unique (prix_panneau) pour compatibilité.
    prix_pan   = float(d.get(f'prix_panneau_{taux}',  d.get('prix_panneau', 0)))
    prix_inv_u = float(d.get(f'prix_onduleur_{taux}', d.get('prix_onduleur', 0)))
    prix_bat_u = float(d.get(f'prix_batterie_{taux}', d.get('prix_batterie', 0)))
    prix_gen  = float(d.get(f'prix_groupe_{taux}',       d.get('prix_groupe', 0)))
    prix_cab  = float(d.get(f'prix_cables_{taux}',       d.get('prix_cables', 0)))
    prix_str  = float(d.get(f'prix_structure_{taux}',    d.get('prix_structure', 0)))
    prix_inst = float(d.get(f'prix_installation_{taux}', d.get('prix_installation', 0)))
    prix_div  = float(d.get(f'prix_divers_{taux}',       d.get('prix_divers', 0)))
    remise    = float(d.get('remise_pct', 0)) / 100
    tarif     = float(d.get('tarif_kwh', 110))
    taux_act  = float(d.get('taux_actualisation', 5)) / 100

    # ── 1. Énergie ───────────────────────────────────────────
    e_brute, p_max_w = _calc_energie(d)
    e_pv      = round(e_brute * facteur, 4)
    e_appoint = round(e_brute * (1 - facteur), 4)
    e_nuit    = round(e_brute * 0.50, 4)

    # ── 2. Puissance PV calculée ─────────────────────────────
    ppv_calc = calc_ppv(e_pv, hsp)

    # ── 3. Onduleur ──────────────────────────────────────────
    # Si l'utilisateur a forcé un onduleur pour ce scénario (après
    # détection d'un problème de dimensionnement, ou simplement par
    # choix manuel), on l'utilise tel quel à la place du choix
    # automatique, avec la quantité qu'il a choisie (n onduleurs
    # identiques montés en parallèle : leurs puissances s'additionnent).
    # Tout le reste du dimensionnement de ce scénario (config S×P,
    # câbles, ratio, prix) est ensuite recalculé à partir de cela.
    #
    # En mode automatique : un seul onduleur est choisi par défaut ;
    # plusieurs onduleurs en parallèle ne sont proposés que si aucun
    # modèle seul du catalogue ne couvre la puissance requise
    # (voir choisir_onduleur).
    inv_force_id = d.get(f'onduleur_force_{taux}')
    inv_force_auto = False
    n_inv = 1
    if inv_force_id:
        catalogue_inv = get_onduleurs()
        inv_trouve = next(
            (o for o in catalogue_inv if str(o.get('id', o.get('modele'))) == str(inv_force_id)),
            None
        )
        if inv_trouve:
            inv_sel       = inv_trouve
            n_inv         = max(1, int(float(d.get(f'onduleur_force_qty_{taux}', 1))))
            inv_kva       = float(inv_sel['puissance_kva'])
            inv_kva_total = round(inv_kva * n_inv, 2)
            ratio_inv     = round(ppv_calc / inv_kva_total, 2) if inv_kva_total > 0 else 0
            etat_inv      = ('vert'   if 0.9 <= ratio_inv <= 1.3 else
                              'orange' if 0.7 <= ratio_inv <= 1.5 else 'rouge')
            p_inv_req     = round((p_max_w/1000) * facteur * coeff_inv, 2)
        else:
            inv_force_id = None  # id inconnu, fallback auto

    if not inv_force_id:
        inv_sel, ratio_inv, etat_inv, p_inv_req, n_inv = choisir_onduleur(
            p_max_w, coeff_inv, taux, ppv_calc)
        inv_kva       = float(inv_sel['puissance_kva'])
        inv_kva_total = round(inv_kva * n_inv, 2)
    else:
        inv_force_auto = True

    inv_marque = inv_sel.get('marque', '')
    inv_modele = inv_sel.get('modele', '')
    inv_eff    = float(inv_sel.get('rendement', 96))
    inv_vmin   = float(inv_sel.get('vmppt_min', 120))
    inv_vmax_m = float(inv_sel.get('vmppt_max', 450))
    inv_vmax_a = float(inv_sel.get('vmax', 500))
    inv_imax_dc_unitaire = float(inv_sel.get('imax_dc', 0)) or None
    prix_inv_unitaire = prix_inv_u if prix_inv_u > 0 else float(
        inv_sel.get('prix_fcfa', _prix_inv_defaut(inv_kva)))
    prix_inv   = round(prix_inv_unitaire * n_inv)

    # ── 4. Config S×P : ppv_inst >= ppv_calc TOUJOURS ────────
    # Np est limité par le courant DC max cumulé de l'onduleur (ou des
    # n_inv onduleurs en parallèle) : Np × pan_icc × 1.25 <= imax_dc × n_inv.
    # Si le catalogue ne renseigne pas imax_dc pour ce modèle, cette
    # contrainte est ignorée (rétrocompatible avec les anciens catalogues).
    inv_imax_dc_total = (inv_imax_dc_unitaire * n_inv) if inv_imax_dc_unitaire else None
    config   = optimiser_config_sp(
        ppv_calc, pan_wc, pan_voc, pan_vmp,
        inv_vmin, inv_vmax_m, inv_vmax_a,
        tmin, tmax, pan_gamma,
        pan_icc=pan_icc, inv_imax_dc=inv_imax_dc_total)

    nserie   = config['ns']
    npar     = config['np']
    n_total  = config['n_total']
    ppv_inst = config['ppv_inst']   # >= ppv_calc toujours
    serie_ok = config['valid']

    # Vérification finale
    assert ppv_inst >= ppv_calc - 0.001, f"ppv_inst={ppv_inst} < ppv_calc={ppv_calc}"

    prod_an = round(ppv_inst * hsp * (pr/100) * 365, 0)

    # ── 5. Câbles COMPLETS (DC, AC, batterie, régulateur) ────
    # inv_kva_total = puissance cumulée si plusieurs onduleurs en
    # parallèle ; c'est elle qui détermine le courant AC et batterie
    # total du système (somme des courants de chaque onduleur).
    cables = calc_cables(pan_icc, npar, inv_kva_total, v_bat, ppv_inst,
                          voc_string_v=config['voc_tmin_str'])

    # ── 6. Batterie ──────────────────────────────────────────
    # Si l'utilisateur a forcé un modèle de batterie pour ce scénario
    # (choix manuel sur le tableau de bord), on l'utilise tel quel à
    # la place du choix automatique, avec la quantité qu'il a choisie.
    # Identifiant du forçage : "type:index" (ex: "LiFePO4:2"), le type
    # pouvant différer de bat_type (technologie par défaut des autres
    # scénarios) si l'utilisateur veut tester une autre techno ici.
    dod_map   = {'LiFePO4':0.90,'AGM':0.50,'GEL':0.70,'OPzV':0.80}
    eta_b_map = {'LiFePO4':0.95,'AGM':0.85,'GEL':0.87,'OPzV':0.88}

    bat_force_id  = d.get(f'batterie_force_{taux}')
    bat_force_auto = False
    bat_type_eff  = bat_type
    bat_sel       = None
    bat_idx       = -1

    if bat_force_id:
        try:
            f_type, f_idx = bat_force_id.split(':')
            f_idx = int(f_idx)
            catalogue_bat = get_batteries()
            modeles_bat   = catalogue_bat.get(f_type, [])
            if 0 <= f_idx < len(modeles_bat):
                bat_sel       = modeles_bat[f_idx]
                bat_idx       = f_idx
                bat_type_eff  = f_type
                bat_force_auto = True
        except (ValueError, AttributeError):
            bat_sel = None

    dod_bat = dod_map.get(bat_type_eff, 0.80)
    eta_bat = eta_b_map.get(bat_type_eff, 0.90)

    cap_kwh_req, cap_ah_req, jours_eff = calc_batterie(
        e_pv, e_nuit, jours, taux, dod_bat, eta_bat)

    if bat_sel is None:
        bat_sel, bat_idx = choisir_batterie(cap_kwh_req, bat_type_eff)

    bat_kwh_u  = float(bat_sel['capacite_kwh']) if bat_sel else 4.8
    bat_marque = bat_sel.get('marque', '—') if bat_sel else '—'
    bat_modele = bat_sel.get('modele', '—') if bat_sel else '—'
    bat_id     = f'{bat_type_eff}:{bat_idx}' if bat_sel else ''
    prix_bat_unitaire = prix_bat_u if prix_bat_u > 0 else float(
        bat_sel.get('prix_fcfa', 0) if bat_sel else 0)

    if bat_force_auto:
        n_bat = max(1, int(float(d.get(f'batterie_force_qty_{taux}', 1))))
    else:
        n_bat = math.ceil(cap_kwh_req / bat_kwh_u) if bat_kwh_u > 0 else 0

    cap_inst  = round(n_bat * bat_kwh_u, 1)
    auto_h    = round(cap_inst * dod_bat * eta_bat / (e_brute/24), 1) if e_brute > 0 else 0
    prix_bat  = prix_bat_unitaire  # prix UNITAIRE — cout_bat = n_bat * prix_bat plus loin

    # ── 7. Groupe ─────────────────────────────────────────────
    gen_result = None
    if appoint == 'groupe':
        fac_sim    = float(d.get('facteur_simult', 0.8))
        eta_ge     = float(d.get('eta_ge', 0.85))
        p_ge       = round((p_max_w/1000*(1-facteur)*fac_sim)/eta_ge, 2) if p_max_w > 0 else 0
        gen_result = {
            'puissance_kw':        p_ge,
            'energie_jour_kwh':    round(e_appoint, 2),
            'pourcentage_appoint': round((1-facteur)*100),
            'modele':              d.get('gen_modele','—'),
            'carburant':           d.get('gen_fuel','—'),
        }

    # ── 8. Budget ─────────────────────────────────────────────
    cout_pan  = n_total * prix_pan
    cout_inv  = prix_inv
    cout_bat  = n_bat   * prix_bat
    cout_gen  = prix_gen if appoint == 'groupe' else 0
    cout_cab  = prix_cab
    cout_str  = prix_str
    cout_inst = prix_inst
    cout_div  = prix_div
    total_ht  = (cout_pan+cout_inv+cout_bat+cout_gen+
                 cout_cab+cout_str+cout_inst+cout_div)
    total_net = round(total_ht * (1 - remise))

    # ── 9. Rentabilité ────────────────────────────────────────
    DEGRADATION_PV_PCT = 0.5   # %/an, valeur standard industrie
    DUREE_PROJET_ANS   = 20    # durée de vie standard panneaux PV

    save_an = round(prod_an * tarif)
    opex_an = round(total_net * 0.012)
    flux    = save_an - opex_an

    # Temps de retour simple (payback period) — PAS un TRI financier.
    # Nommé clairement pour éviter toute confusion avec le vrai TRI (IRR).
    temps_retour_ans = round(total_net / max(flux, 1), 1) if flux > 0 else None

    # Vrai TRI (Internal Rate of Return) — taux qui annule la VAN,
    # calculé par résolution numérique, tenant compte de la dégradation PV.
    tri_pct = _calculer_tri(total_net, flux, DUREE_PROJET_ANS, DEGRADATION_PV_PCT)

    # VAN actualisée sur la durée du projet, avec dégradation production
    van = -total_net
    flux_t = flux
    for y in range(1, DUREE_PROJET_ANS + 1):
        van += flux_t / (1 + taux_act) ** y
        flux_t *= (1 - DEGRADATION_PV_PCT / 100)
    van = round(van)

    # LCOE actualisé (CAPEX + OPEX actualisés / énergie actualisée),
    # avec dégradation de production PV — formule standard IRENA/NREL.
    lcoe = _calculer_lcoe(total_net, opex_an, prod_an, taux_act * 100,
                          DUREE_PROJET_ANS, DEGRADATION_PV_PCT)

    co2 = round(prod_an * 0.6, 0)

    prod_jour  = round(ppv_inst * hsp * (pr/100), 3)
    couverture = round(prod_jour / e_brute * 100, 1) if e_brute > 0 else 0

    return {
        'taux_solaire':   taux,
        'source_appoint': appoint,

        'energie': {
            'e_brute_kwh_j':      round(e_brute, 3),
            'e_pv_kwh_j':         e_pv,
            'e_appoint_kwh_j':    e_appoint,
            'puissance_totale_w': p_max_w,
            'prod_jour_kwh':      prod_jour,
            'couverture_pct':     couverture,
        },

        'generateur_pv': {
            'ppv_calcule_kwc':  ppv_calc,
            'ppv_installe_kwc': ppv_inst,
            'n_panneaux':       n_total,
            'n_serie':          nserie,
            'n_parallele':      npar,
            'nserie_max':       config['ns_max_abs'],
            'nserie_mppt_min':  config['ns_min_mppt'],
            'nserie_mppt_max':  config['ns_max_mppt'],
            'serie_ok':         serie_ok,
            'prod_annuelle_kwh':prod_an,
            'eta_systeme':      65,
            'ecart_pct':        config['ecart_pct'],
        },

        'correction_thermique': {
            'voc_corr_v':    config['voc_corr'],
            'vmp_corr_min_v':config['vmp_corr_min'],
            'vmp_corr_max_v':config['vmp_corr_max'],
            'tmin': tmin, 'tmax': tmax,
            'vstr_voc':     config['voc_tmin_str'],
            'vstr_vmp_min': config['vmp_tmax_str'],
            'vstr_vmp_max': config['vmp_tmin_str'],
        },

        'onduleur': {
            'id':            inv_sel.get('id', inv_modele),
            'marque':        inv_marque,
            'modele':        inv_modele,
            'puissance_kva': inv_kva,
            'n_unites':      n_inv,
            'puissance_kva_totale': inv_kva_total,
            'rendement':     inv_eff,
            'ratio':         ratio_inv,
            'etat':          etat_inv,
            'prix_fcfa':     prix_inv,
            'prix_unitaire_fcfa': prix_inv_unitaire,
            'p_inv_requise': p_inv_req,
            'p_charges_kw':  round(p_max_w/1000, 2),
            'coeff_inv':     coeff_inv,
            'choix_manuel':  inv_force_auto,
        },

        # Câbles et protections COMPLETS
        'cables':      cables,
        'protections': cables['protections'],

        'stockage': {
            'id':               bat_id,
            'type':             bat_type_eff,
            'marque':           bat_marque,
            'modele':           bat_modele,
            'jours_autonomie':  jours_eff,
            'capacite_req_kwh': cap_kwh_req,
            'capacite_req_ah':  cap_ah_req,
            'capacite_u_kwh':   bat_kwh_u,
            'n_modules':        n_bat,
            'capacite_inst_kwh':cap_inst,
            'dod_pct':          round(dod_bat*100),
            'autonomie_heures': auto_h,
            'prix_module':      prix_bat,
            'cable_section_mm2':cables['batterie']['section_mm2'],
            'cable_courant_a':  cables['batterie']['i_bat_a'],
            'choix_manuel':     bat_force_auto,
        },

        'groupe': gen_result,

        'budget': {
            'panneaux':    cout_pan,
            'onduleurs':   cout_inv,
            'batteries':   cout_bat,
            'groupe':      cout_gen,
            'cables':      cout_cab,
            'structure':   cout_str,
            'installation':cout_inst,
            'divers':      cout_div,
            'total_ht':    total_ht,
            'remise_pct':  remise*100,
            'total_net':   total_net,
        },

        'rentabilite': {
            'prod_annuelle_kwh':    prod_an,
            'economies_annuelles':  save_an,
            'opex_annuel':          opex_an,
            'flux_net':             flux,
            'temps_retour_ans':     temps_retour_ans,  # payback period (années), PAS un taux
            'tri_pct':              tri_pct,            # vrai TRI (IRR), en %
            'van_20ans':            van,
            'lcoe_fcfa_kwh':        lcoe,
            'co2_kg_an':            co2,
        },

        'coherence': {
            'ppv_calc_kwc':   ppv_calc,
            'ppv_inst_kwc':   ppv_inst,
            'ecart_pct':      config['ecart_pct'],
            'couverture_pct': couverture,
            'autonomie_h':    auto_h,
        },

        'params': {
            'hsp': hsp, 'irr_ghi': d.get('irr_ghi','—'),
            'temp_amb': temp_amb, 'temp_min': tmin, 'temp_max': tmax,
            'eta_pct': 65, 'pr_pct': pr, 'jours': jours, 'tarif': tarif,
            'pan_marque': d.get('pan_marque',''), 'pan_modele': d.get('pan_modele',''),
            'pan_wc': pan_wc, 'pan_voc': pan_voc, 'pan_vmp': pan_vmp,
            'pan_icc': pan_icc, 'pan_gamma': pan_gamma,
            'inv_marque': inv_marque, 'inv_modele': inv_modele, 'inv_kva': inv_kva,
            'inv_n': n_inv, 'inv_kva_total': inv_kva_total,
            'bat_type': bat_type, 'bat_marque': bat_marque, 'bat_modele': bat_modele,
            'bat_kwh_u': bat_kwh_u, 'bat_v': v_bat, 'bat_dod': round(dod_bat*100),
            'gen_modele': d.get('gen_modele','—'), 'gen_fuel': d.get('gen_fuel','—'),
            'remise': remise*100, 'taux_act': d.get('taux_actualisation',5),
            'prix_pan': prix_pan, 'prix_inv': prix_inv, 'prix_bat': prix_bat,
            'coeff_inv': coeff_inv,
        },
    }


def _calc_energie(d):
    mode    = d.get('mode','charges')
    charges = d.get('charges',[])
    hsp     = float(d.get('hsp',5.5))
    if mode == 'charges':
        wh = sum(float(c['puissance_w'])*int(c['quantite'])*float(c['duree_h']) for c in charges)
        w  = sum(float(c['puissance_w'])*int(c['quantite']) for c in charges)
        return wh/1000, w
    elif mode == 'wh':
        kwh = float(d.get('energie_wh',0))/1000
        return kwh, kwh*1000/hsp
    else:
        wc = float(d.get('puissance_crete_w',0))
        return wc*hsp/1000, wc


if __name__ == '__main__':
    print("="*55)
    print("  SolarDim Pro API — http://localhost:8000")
    print("="*55)
    try:
        pan = get_panneaux()
        inv = get_onduleurs()
        bat = get_batteries()
        print(f"  Panneaux  : {len(pan)} modèles")
        print(f"  Onduleurs : {len(inv)} modèles")
        print(f"  Batteries : {sum(len(v) for v in bat.values())} modèles")
    except Exception as e:
        print(f"  ERREUR catalogues : {e}")
    print("="*55)
    print()
    print("TEST ppv_inst >= ppv_calc :")
    e_test=10.0; hsp_t=5.5
    for t in [100,75,50,30]:
        e_pv=e_test*t/100
        ppv_c=calc_ppv(e_pv,hsp_t)
        cfg=optimiser_config_sp(ppv_c,550,49.5,41.2,120,450,500,15,70,-0.35)
        ok = '✓' if cfg['ppv_inst'] >= ppv_c - 0.001 else '✗ ERREUR'
        print(f"  {t}%: ppv_calc={ppv_c:.3f}kWc | ppv_inst={cfg['ppv_inst']:.3f}kWc | "
              f"{cfg['ns']}S×{cfg['np']}P={cfg['n_total']}pan | écart=+{cfg['ecart_pct']}% {ok}")
    print()
    print("TEST sections câbles :")
    for usage, i_test in [('dc', 15), ('dc', 25), ('batterie', 20), ('batterie', 80), ('ac', 30), ('regulateur', 12)]:
        s = _section(i_test, usage=usage)
        print(f"  {usage:12s} I={i_test:3d}A → {s} mm²")
    print()
    port = int(os.environ.get('PORT', 8000))
    app.run(debug=os.environ.get('FLASK_DEBUG', '0') == '1', host='0.0.0.0', port=port)