const form = document.getElementById('register-form');
const errorEl = document.getElementById('register-error');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.hidden = true;

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (password !== confirmPassword) {
    errorEl.textContent = 'As senhas nao coincidem.';
    errorEl.hidden = false;
    return;
  }

  const res = await fetch('/api/auth/register', {
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
  errorEl.textContent = body.error || 'Nao foi possivel criar a conta.';
  errorEl.hidden = false;
});
