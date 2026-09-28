import { api, initPage } from './app.js';

const user = await initPage();
document.getElementById('welcome').textContent = `Bonjour ${user.first_name}`;

// Nombre de dossiers par statut, calculé par la base (champ total de la liste).
for (const el of document.querySelectorAll('[data-status]')) {
  const { total } = await api(`/api/criminals?limit=1&status=${el.dataset.status}`);
  el.textContent = total;
}
