// URL de l'API backend Flask.
// En local (localhost / 127.0.0.1) → backend local sur le port 8000.
// En production (déployé sur Render) → URL du service backend Render.
//
// ⚠️ À FAIRE après ton premier déploiement du backend sur Render :
// remplace la valeur ci-dessous par l'URL réelle donnée par Render
// pour ton service backend (visible dans le dashboard Render, du
// type https://solardim-backend.onrender.com — SANS slash final).
const API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : 'https://solardim-backend.onrender.com';
