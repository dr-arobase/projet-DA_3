import { api, avatar, h, initPage, showNotification, statusTag } from './app.js';

await initPage();

const form = document.getElementById('filters');
const list = document.getElementById('list');
const message = document.getElementById('message');
const prev = document.getElementById('prev');
const next = document.getElementById('next');
const pageInfo = document.getElementById('page-info');

// L'état (page, recherche, statut) vit dans l'adresse : on peut la partager ou revenir en arrière.
const params = new URLSearchParams(window.location.search);
form.q.value = params.get('q') ?? '';
form.status.value = params.get('status') ?? '';
let page = Number(params.get('page')) || 1;

if (params.has('created')) showNotification(message, 'is-success', 'Le dossier a été ajouté au registre.');
if (params.has('removed')) showNotification(message, 'is-success', 'Le dossier a été retiré du registre.');

function row(criminal) {
  return h('a', { className: 'criminal-row', href: `/criminals/${criminal.id}` },
    avatar(criminal, 48),
    h('span', { className: 'name has-text-weight-semibold' }, `${criminal.last_name.toUpperCase()}, ${criminal.first_name}`),
    statusTag(criminal.status));
}

async function load() {
  const query = new URLSearchParams({ page, limit: 10 });
  if (form.q.value.trim()) query.set('q', form.q.value.trim());
  if (form.status.value) query.set('status', form.status.value);

  const shown = new URLSearchParams(query);
  shown.delete('limit');
  history.replaceState(null, '', `/criminals?${shown}`);

  const result = await api(`/api/criminals?${query}`);

  if (result.total === 0) {
    const filtered = query.has('q') || query.has('status');
    list.replaceChildren(h('p', { className: 'p-4 has-text-centered' },
      filtered ? 'Aucun dossier ne correspond à votre recherche.' : 'Le registre est vide.'));
  } else if (result.data.length === 0) {
    // Page au-delà de la dernière (ex. après un retrait) : on revient à la dernière page.
    page = result.totalPages;
    return load();
  } else {
    list.replaceChildren(...result.data.map(row));
  }

  pageInfo.textContent = result.total === 0 ? '' : `Page ${result.page} sur ${result.totalPages} · ${result.total} dossier(s)`;
  prev.disabled = page <= 1;
  next.disabled = page >= result.totalPages;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  page = 1;
  load();
});
prev.addEventListener('click', () => { page -= 1; load(); });
next.addEventListener('click', () => { page += 1; load(); });

load();
