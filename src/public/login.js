const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');

async function redirectIfAlreadyLoggedIn() {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (res.ok) {
    window.location.href = '/';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.hidden = true;

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ username, password }),
  });

  if (res.ok) {
    window.location.href = '/';
    return;
  }

  const body = await res.json().catch(() => ({}));
  errorEl.textContent = body.error || 'Nao foi possivel entrar.';
  errorEl.hidden = false;
});

redirectIfAlreadyLoggedIn();
