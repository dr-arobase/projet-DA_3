import {
  api, ApiError, avatar, formatDateTime, h, initPage, showNotification, statusTag, STATUS_LABELS,
} from './app.js';

const user = await initPage();

const id = window.location.pathname.split('/').pop();
const profile = document.getElementById('profile');
const message = document.getElementById('message');
const canRemove = user.role === 'superviseur' || user.role === 'direction';

function field(label, value) {
  return h('div', { className: 'mb-3' },
    h('p', { className: 'heading' }, label),
    h('p', { className: 'pre-line' }, value || '—'));
}

function statusForm(criminal) {
  const select = h('select', { name: 'status', ariaLabel: 'Nouveau statut' },
    Object.entries(STATUS_LABELS).map(([value, label]) =>
      h('option', { value, selected: value === criminal.status }, label)));
  const button = h('button', { className: 'button is-link is-fullwidth', type: 'submit' }, 'Mettre à jour le statut');
  const form = h('form', { className: 'field is-grouped is-grouped-mobile' },
    h('div', { className: 'control is-expanded' }, h('div', { className: 'select is-fullwidth' }, select)),
    h('div', { className: 'control' }, button));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.classList.add('is-loading');
    try {
      await api(`/api/criminals/${id}`, { method: 'PATCH', body: { status: select.value, version: criminal.version } });
      await load();
      showNotification(message, 'is-success', `Statut mis à jour : ${STATUS_LABELS[select.value]}.`);
    } catch (err) {
      button.classList.remove('is-loading');
      if (err.status === 409) {
        const reload = h('button', { className: 'button is-small ml-2' }, 'Recharger le dossier');
        reload.addEventListener('click', () => { message.replaceChildren(); load(); });
        message.replaceChildren(h('div', { className: 'notification is-warning', role: 'alert' },
          `${err.message} Statut actuel : ${STATUS_LABELS[err.body.current.status]}.`, reload));
      } else {
        showNotification(message, 'is-danger', err.message);
      }
    }
  });
  return form;
}

function removeButton(criminal) {
  const button = h('button', { className: 'button is-danger is-outlined is-fullwidth' }, 'Retirer ce dossier du registre');
  button.addEventListener('click', async () => {
    const confirmed = window.confirm(
      `Retirer définitivement le dossier de ${criminal.first_name} ${criminal.last_name} ? Cette action est irréversible.`);
    if (!confirmed) return;
    try {
      await api(`/api/criminals/${id}`, { method: 'DELETE' });
      window.location.assign('/criminals?removed=1');
    } catch (err) {
      showNotification(message, 'is-danger', err.message);
    }
  });
  return button;
}

function render(criminal) {
  document.title = `${criminal.first_name} ${criminal.last_name} — CrimeTracker`;

  const history = h('ul', {},
    criminal.status_history.map((entry) =>
      h('li', { className: 'mb-2' },
        statusTag(entry.status), ' ',
        `${formatDateTime(entry.changed_at)} — par ${entry.changed_by_name}`)));

  profile.replaceChildren(h('div', {},
    h('div', { className: 'box' },
      h('div', { className: 'is-flex is-align-items-center mb-4', style: 'gap: 1rem' },
        avatar(criminal, 96),
        h('div', {},
          h('h1', { className: 'title is-4 mb-2' }, `${criminal.first_name} ${criminal.last_name}`),
          statusTag(criminal.status))),
      h('div', { className: 'columns' },
        h('div', { className: 'column' },
          field('Date de naissance', criminal.date_of_birth),
          field('Nationalité', criminal.nationality),
          field('Ajouté par', `${criminal.added_by_name}, le ${formatDateTime(criminal.added_at)}`)),
        h('div', { className: 'column' },
          field('Crimes reprochés', criminal.crimes),
          field('Description', criminal.description)))),
    h('div', { className: 'box' },
      h('h2', { className: 'title is-5' }, 'Changer le statut'),
      statusForm(criminal)),
    h('div', { className: 'box' },
      h('h2', { className: 'title is-5' }, 'Historique du statut'),
      history),
    canRemove ? removeButton(criminal) : null));
}

async function load() {
  try {
    render(await api(`/api/criminals/${id}`));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      profile.replaceChildren(h('div', { className: 'notification is-danger' },
        h('p', { className: 'has-text-weight-bold' }, 'Dossier introuvable'),
        h('p', {}, 'Ce dossier n\'existe pas ou a été retiré du registre.')));
    } else {
      showNotification(message, 'is-danger', err.message);
    }
  }
}

load();
