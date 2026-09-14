const API_BASE = '/api/tasks';

const columns = {
  todo: document.getElementById('col-todo'),
  doing: document.getElementById('col-doing'),
  done: document.getElementById('col-done'),
};

const form = document.getElementById('new-task-form');
const currentUserEl = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');
const manageUsersBtn = document.getElementById('manage-users-btn');
const usersDialog = document.getElementById('users-dialog');
const closeUsersDialogBtn = document.getElementById('close-users-dialog');
const newUserForm = document.getElementById('new-user-form');
const newUserError = document.getElementById('new-user-error');
const usersList = document.getElementById('users-list');

let currentUser = null;

function goToLogin() {
  window.location.href = '/login.html';
}

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...options });
  if (res.status === 401) {
    goToLogin();
    throw new Error('Nao autenticado.');
  }
  return res;
}

async function loadCurrentUser() {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (!res.ok) {
    goToLogin();
    return;
  }
  currentUser = await res.json();
  currentUserEl.textContent = `${currentUser.username} (${currentUser.role})`;
  manageUsersBtn.hidden = currentUser.role !== 'admin';

  await fetchTasks();
}

async function fetchTasks() {
  const res = await api(API_BASE);
  const tasks = await res.json();
  render(tasks);
}

function render(tasks) {
  Object.values(columns).forEach((col) => {
    col.innerHTML = '';
  });

  tasks.forEach((task) => {
    const card = document.createElement('div');
    card.className = `card priority-${task.priority}`;

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = task.title;

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const bits = [];
    if (task.assignee) bits.push(task.assignee);
    if (task.due_date) bits.push(`prazo: ${task.due_date.slice(0, 10)}`);
    if (currentUser?.role === 'admin' && task.owner_username) bits.push(`de: ${task.owner_username}`);
    meta.textContent = bits.join(' • ');

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const nextStatus = { todo: 'doing', doing: 'done', done: 'todo' }[task.status];
    const nextLabel = { todo: 'Iniciar', doing: 'Concluir', done: 'Reabrir' }[task.status];

    const moveBtn = document.createElement('button');
    moveBtn.textContent = nextLabel;
    moveBtn.addEventListener('click', () => updateTask(task.id, { status: nextStatus }));

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.className = 'danger';
    delBtn.addEventListener('click', () => deleteTask(task.id));

    actions.append(moveBtn, delBtn);
    card.append(title, meta, actions);
    columns[task.status].appendChild(card);
  });
}

async function updateTask(id, patch) {
  await api(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  fetchTasks();
}

async function deleteTask(id) {
  await api(`${API_BASE}/${id}`, { method: 'DELETE' });
  fetchTasks();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = document.getElementById('title').value;
  const assignee = document.getElementById('assignee').value;
  const priority = document.getElementById('priority').value;
  const due_date = document.getElementById('due_date').value || null;

  const res = await api(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, assignee, priority, due_date }),
  });

  if (res.ok) {
    form.reset();
    fetchTasks();
  } else {
    const body = await res.json();
    alert(body.error || 'Erro ao criar tarefa.');
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  goToLogin();
});

manageUsersBtn.addEventListener('click', async () => {
  newUserError.hidden = true;
  newUserForm.reset();
  await loadUsers();
  usersDialog.showModal();
});

closeUsersDialogBtn.addEventListener('click', () => {
  usersDialog.close();
});

async function loadUsers() {
  const res = await api('/api/users');
  const users = await res.json();
  usersList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.textContent = `${user.username} — ${user.role}`;
    usersList.appendChild(li);
  });
}

newUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  newUserError.hidden = true;

  const username = document.getElementById('new-username').value;
  const password = document.getElementById('new-password').value;
  const role = document.getElementById('new-role').value;

  const res = await api('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  });

  if (res.ok) {
    newUserForm.reset();
    await loadUsers();
  } else {
    const body = await res.json();
    newUserError.textContent = body.error || 'Erro ao criar usuario.';
    newUserError.hidden = false;
  }
});

loadCurrentUser();
