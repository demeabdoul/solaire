# Déployer SolarDim Pro sur Render

## 1. Structure du repo (déjà prête dans ce dossier)

```
.
├── render.yaml
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── catalogues/
│       ├── panneaux.json      ✓ tes vraies données (13 modèles)
│       ├── onduleurs.json     ✓ tes vraies données (22 modèles)
│       └── batteries.json     ✓ tes vraies données (19 modèles, 4 technologies)
└── frontend/
    ├── pages/app.html
    ├── js/  (app.js, calcul.js, wizard.js, rapport.js, config.js)
    └── css/ (layout.css, components.css, rapport.css)
```

Les catalogues sont déjà tes vrais fichiers — j'ai vérifié qu'ils se chargent et qu'un calcul complet fonctionne avec (testé avec gunicorn, le serveur réel utilisé en prod).

## 2. Mettre le projet sur GitHub

```bash
cd solardim-pro          # le dossier qui contient render.yaml
git init
git add .
git commit -m "Premier déploiement SolarDim Pro"
git branch -M main
git remote add origin https://github.com/TON_COMPTE/solardim-pro.git
git push -u origin main
```

## 3. Créer les services sur Render

### Option A — Automatique avec render.yaml (recommandé)
1. Va sur [render.com](https://render.com) → **New** → **Blueprint**
2. Connecte ton repo GitHub `solardim-pro`
3. Render détecte `render.yaml` et propose de créer les 2 services (`solardim-backend` + `solardim-frontend`) automatiquement
4. Clique **Apply**

### Option B — Manuel (si tu préfères tout configurer à la main)
**Backend :**
1. **New** → **Web Service** → connecte ton repo
2. Root Directory : `backend`
3. Runtime : `Python 3`
4. Build Command : `pip install -r requirements.txt`
5. Start Command : `gunicorn main:app`
6. Ajoute un **disque persistant** (Settings → Disks) monté sur le dossier `backend` — **indispensable**, sinon `solardim.db` repart vide à chaque redéploiement (voir section 5)

**Frontend :**
1. **New** → **Static Site** → même repo
2. Root Directory : `frontend`
3. Build Command : (laisser vide)
4. Publish Directory : `.`

## 4. Connecter le frontend au backend

Une fois le backend déployé, Render te donne une URL du type :
```
https://solardim-backend.onrender.com
```

Ouvre `frontend/js/config.js` et remplace la valeur de production :
```js
const API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : 'https://solardim-backend.onrender.com';   // ← mets TA vraie URL ici
```

Commit + push ce changement, Render redéploie automatiquement le frontend.

## 5. ⚠️ Le point le plus important : le disque persistant

Render redémarre ton service backend régulièrement (déploiements, mise en veille des plans gratuits, etc.). **Par défaut, le système de fichiers est éphémère** : à chaque redémarrage, tout fichier créé après le déploiement (dont `solardim.db`) est perdu et recréé vide.

C'est exactement le souci qu'on a diagnostiqué en local. Pour que tes projets sauvegardés survivent dans le temps sur Render, il faut un **disque persistant** :
- Dashboard Render → ton service backend → **Disks** → **Add Disk**
- Mount Path : le dossier où vit `main.py` (ex: `/opt/render/project/src/backend`)
- Au premier démarrage avec un disque vide, le message de log `[DB] Fichier ABSENT — un nouveau fichier VIDE va être créé ici` apparaîtra une fois (normal, c'est la création initiale) — ensuite les données persisteront entre les redéploiements.

Le plan **gratuit** de Render ne propose pas toujours de disque persistant selon l'offre en cours — vérifie sur le dashboard si l'option est disponible pour ton plan ; sinon il faudra passer sur un plan payant, ou migrer vers une base hébergée séparément (Render Postgres, etc.) pour une vraie persistance gratuite.

## 6. Vérifier que tout fonctionne

Une fois les deux services en ligne :
1. Ouvre l'URL du frontend
2. Crée un projet test, lance un calcul
3. Va voir les logs du backend sur Render (`Logs` dans le dashboard) — tu devrais voir la ligne `[DB] Chemin utilisé : ...` et `[DB] Fichier existant — données conservées` (après le premier démarrage)
4. Recharge la page projets — le projet test doit toujours être là

## Notes

- CORS est ouvert à tous les domaines (`CORS(app)` dans `main.py`) — fonctionnera sans configuration supplémentaire entre frontend et backend Render, mais à resserrer plus tard si besoin de sécurité.
- Le `debug` Flask est désactivé par défaut en production (`FLASK_DEBUG` non défini) — ne pas l'activer sur Render.
