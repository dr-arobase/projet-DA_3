/**
 * Module partagé par toutes les pages : appels à l'API, barre de navigation,
 * affichage des statuts. Le texte venant de l'API est toujours inséré avec
 * textContent (jamais innerHTML) : aucune injection HTML possible.
 */

export const STATUS_LABELS = { recherche: 'Recherché', capture: 'Capturé', libere: 'Libéré' };
const STATUS_COLORS = { recherche: 'is-danger', capture: 'is-success', libere: 'is-info' };
const ROLE_LABELS = { policier: 'Policier', superviseur: 'Superviseur', direction: 'Direction' };

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `Erreur ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** Appelle l'API en JSON. Une session expirée renvoie à l'écran de connexion. */
export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status === 401 && path !== '/auth/login') {
    window.location.assign('/login');
  }
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

/** Crée un élément : h('p', { className: 'x' }, 'texte', autreElement). */
export function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  for (const child of children.flat()) {
    if (child !== null && child !== undefined && child !== false) el.append(child);
  }
  return el;
}

export function statusTag(status) {
  return h('span', { className: `tag ${STATUS_COLORS[status] ?? ''}` }, STATUS_LABELS[status] ?? status);
}

/** Vignette : la photo si elle existe, sinon les initiales. */
export function avatar(criminal, size = 64) {
  const figure = h('figure', { className: 'avatar' });
  figure.style.width = figure.style.height = `${size}px`;
  const initials = h('span', { className: 'avatar-initials' },
    `${criminal.first_name[0] ?? ''}${criminal.last_name[0] ?? ''}`.toUpperCase());
  if (criminal.photo_url) {
    const img = h('img', { src: criminal.photo_url, alt: `Photo de ${criminal.first_name} ${criminal.last_name}` });
    img.addEventListener('error', () => img.replaceWith(initials));
    figure.append(img);
  } else {
    figure.append(initials);
  }
  return figure;
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Message dans un conteneur : type = is-danger, is-success, is-warning, is-info. */
export function showNotification(container, type, message) {
  container.replaceChildren(h('div', { className: `notification ${type}`, role: 'alert' }, message));
}

/** Charge le compte connecté et dessine la barre de navigation. */
export async function initPage() {
  const { user } = await api('/auth/me');

  const burger = h('a', { className: 'navbar-burger', role: 'button', ariaLabel: 'menu', ariaExpanded: 'false' },
    h('span', { ariaHidden: 'true' }), h('span', { ariaHidden: 'true' }),
    h('span', { ariaHidden: 'true' }), h('span', { ariaHidden: 'true' }));
  const menu = h('div', { className: 'navbar-menu' },
    h('div', { className: 'navbar-start' },
      h('a', { className: 'navbar-item', href: '/' }, 'Tableau de bord'),
      h('a', { className: 'navbar-item', href: '/criminals' }, 'Registre'),
      h('a', { className: 'navbar-item', href: '/criminals/new' }, 'Ajouter un dossier')),
    h('div', { className: 'navbar-end' },
      h('div', { className: 'navbar-item' },
        `${user.first_name} ${user.last_name} · ${ROLE_LABELS[user.role] ?? user.role}`),
      h('div', { className: 'navbar-item' },
        h('button', { className: 'button is-light is-small', id: 'logout' }, 'Se déconnecter'))));

  burger.addEventListener('click', () => {
    const open = burger.classList.toggle('is-active');
    menu.classList.toggle('is-active', open);
    burger.ariaExpanded = String(open);
  });

  document.getElementById('navbar').replaceChildren(
    h('div', { className: 'navbar-brand' },
      h('a', { className: 'navbar-item has-text-weight-bold', href: '/' }, 'CrimeTracker'), burger),
    menu);

  document.getElementById('logout').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  });

  return user;
}
