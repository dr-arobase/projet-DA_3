import { api, initPage, showNotification } from './app.js';

await initPage();

const form = document.getElementById('criminal-form');
const message = document.getElementById('message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  button.classList.add('is-loading');
  for (const el of form.querySelectorAll('[data-error]')) el.textContent = '';
  for (const el of form.querySelectorAll('.is-danger.input, .is-danger.textarea')) el.classList.remove('is-danger');

  try {
    const { criminal } = await api('/api/criminals', {
      method: 'POST',
      body: Object.fromEntries(new FormData(form)),
    });
    window.location.assign(`/criminals?created=${criminal.id}`);
  } catch (err) {
    button.classList.remove('is-loading');
    showNotification(message, 'is-danger', err.message);
    // Le serveur valide les champs : on affiche chaque erreur sous son champ.
    for (const [name, text] of Object.entries(err.body?.errors ?? {})) {
      form.querySelector(`[data-error="${name}"]`).textContent = text;
      form.elements[name]?.classList.add('is-danger');
    }
  }
});
