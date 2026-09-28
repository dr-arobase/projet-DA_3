import { api, ApiError, showNotification } from './app.js';

const form = document.getElementById('login-form');
const message = document.getElementById('message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.classList.add('is-loading');

  try {
    await api('/auth/login', {
      method: 'POST',
      body: { badge_number: form.badge_number.value, password: form.password.value },
    });
    window.location.assign('/');
  } catch (err) {
    const text = err instanceof ApiError ? err.message : 'Le serveur est injoignable. Réessayez.';
    showNotification(message, 'is-danger', text);
    form.password.value = '';
    button.classList.remove('is-loading');
  }
});
