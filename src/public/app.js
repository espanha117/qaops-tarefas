const API_BASE = '/api/tasks';

const STATUSES = ['todo', 'doing', 'done'];
const STATUS_LABELS = { todo: 'A Fazer', doing: 'Em Andamento', done: 'Concluído' };
const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
// Quantas concluidas aparecem antes do "Ver anteriores"
const DONE_VISIBLE = 8;

const columns = {
  todo: document.getElementById('col-todo'),
  doing: document.getElementById('col-doing'),
  done: document.getElementById('col-done'),
};
const counts = {
  todo: document.getElementById('count-todo'),
  doing: document.getElementById('count-doing'),
  done: document.getElementById('count-done'),
};

const currentUserEl = document.getElementById('current-user');
const currentUserAvatar = document.getElementById('current-user-avatar');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search');
const adminFilters = document.getElementById('admin-filters');
const filterAssignee = document.getElementById('filter-assignee');
const filterPriority = document.getElementById('filter-priority');
const clearFiltersBtn = document.getElementById('clear-filters');
// Valor especial do filtro para tarefas sem responsavel
const NO_ASSIGNEE = '__none__';

const taskDialog = document.getElementById('task-dialog');
const taskForm = document.getElementById('task-form');
const taskError = document.getElementById('task-error');
const taskDeleteBtn = document.getElementById('task-delete-btn');
const taskSubmitBtn = document.getElementById('task-submit-btn');
const taskStatusField = document.getElementById('task-status-field');
const fields = {
  title: document.getElementById('task-title'),
  description: document.getElementById('task-description'),
  dueDate: document.getElementById('task-due-date'),
  dueTime: document.getElementById('task-due-time'),
  priority: document.getElementById('task-priority'),
  status: document.getElementById('task-status'),
  assignee: document.getElementById('task-assignee'),
};
const assigneeOptions = document.getElementById('assignee-options');

const manageUsersBtn = document.getElementById('manage-users-btn');
const usersDialog = document.getElementById('users-dialog');
const closeUsersDialogBtn = document.getElementById('close-users-dialog');
const newUserForm = document.getElementById('new-user-form');
const newUserError = document.getElementById('new-user-error');
const usersList = document.getElementById('users-list');

let currentUser = null;
let allTasks = [];
let editingTaskId = null;
let showAllDone = false;

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

function svgIcon(pathData, size = 12) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

const ICON_USER = 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10m0 2c-5.33 0-8 2.67-8 5v3h16v-3c0-2.33-2.67-5-8-5';
const ICON_CALENDAR = 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 16H5V10h14z';
const ICON_OWNER = 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6m0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13m8 0c-.29 0-.62.02-.97.05A4.2 4.2 0 0 1 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5';

// due_date pode vir como "AAAA-MM-DD" (sem hora) ou "AAAA-MM-DDTHH:MM".
// Lido como horario local, sem passar por new Date(string) (que trata a
// data pura como UTC e mostraria o dia anterior no Brasil).
function parseDue(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  if (timePart) {
    const [hh, mm] = timePart.split(':').map(Number);
    return { date: new Date(y, m - 1, d, hh || 0, mm || 0), hasTime: true, datePart, timePart: timePart.slice(0, 5) };
  }
  return { date: new Date(y, m - 1, d, 23, 59, 59), hasTime: false, datePart, timePart: '' };
}

function formatDue(due) {
  const pad = (n) => String(n).padStart(2, '0');
  const d = due.date;
  const day = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return due.hasTime ? `${day} as ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

function isOverdue(task) {
  const due = parseDue(task.due_date);
  return Boolean(due) && task.status !== 'done' && due.date < new Date();
}

async function loadCurrentUser() {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (!res.ok) {
    goToLogin();
    return;
  }
  currentUser = await res.json();
  currentUserEl.textContent = currentUser.username;
  currentUserAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
  manageUsersBtn.hidden = currentUser.role !== 'admin';
  adminFilters.hidden = currentUser.role !== 'admin';

  await Promise.all([fetchTasks(), loadAssigneeOptions()]);
}

async function loadAssigneeOptions() {
  const names = new Set([currentUser.username]);
  if (currentUser.role === 'admin') {
    const res = await api('/api/users');
    if (res.ok) (await res.json()).forEach((u) => names.add(u.username));
  }
  assigneeOptions.innerHTML = '';
  names.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    assigneeOptions.appendChild(opt);
  });
}

async function fetchTasks() {
  const res = await api(API_BASE);
  allTasks = await res.json();
  render();
}

function render() {
  if (currentUser?.role === 'admin') updateAssigneeFilterOptions();
  renderSummary(filteredTasks());
  renderBoard();
}

// Filtros de responsavel/prioridade: so aparecem para admin, que ve as
// tarefas de todos. O resumo e o quadro mostram apenas o que passou no filtro.
function filteredTasks() {
  if (currentUser?.role !== 'admin') return allTasks;
  const assignee = filterAssignee.value;
  const priority = filterPriority.value;
  return allTasks.filter((t) => {
    if (priority && t.priority !== priority) return false;
    if (assignee === NO_ASSIGNEE) return !t.assignee;
    if (assignee && t.assignee !== assignee) return false;
    return true;
  });
}

function updateAssigneeFilterOptions() {
  const selected = filterAssignee.value;
  const names = [...new Set(allTasks.map((t) => t.assignee).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );
  const hasUnassigned = allTasks.some((t) => !t.assignee);

  filterAssignee.innerHTML = '';
  const addOption = (value, label) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    filterAssignee.appendChild(opt);
  };
  addOption('', 'Todos os responsáveis');
  names.forEach((name) => addOption(name, name));
  if (hasUnassigned) addOption(NO_ASSIGNEE, 'Sem responsável');

  // Mantem a escolha atual se ela ainda existir
  const stillExists = [...filterAssignee.options].some((o) => o.value === selected);
  filterAssignee.value = stillExists ? selected : '';
  syncFilterState();
}

function syncFilterState() {
  filterAssignee.classList.toggle('is-set', Boolean(filterAssignee.value));
  filterPriority.classList.toggle('is-set', Boolean(filterPriority.value));
  clearFiltersBtn.hidden = !filterAssignee.value && !filterPriority.value;
}

function onFilterChange() {
  syncFilterState();
  renderSummary(filteredTasks());
  renderBoard();
}

function renderSummary(tasks) {
  const total = tasks.length;
  const byStatus = { todo: 0, doing: 0, done: 0 };
  tasks.forEach((t) => {
    byStatus[t.status] += 1;
  });
  const overdue = tasks.filter(isOverdue).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-done-pct').textContent = total ? `${Math.round((byStatus.done / total) * 100)}%` : '0%';
  document.getElementById('stat-overdue').textContent = overdue;
  document.getElementById('stat-overdue-box').classList.toggle('is-active', overdue > 0);

  const bar = document.getElementById('dist-bar');
  const legend = document.getElementById('dist-legend');
  bar.innerHTML = '';
  legend.innerHTML = '';

  if (!total) {
    const empty = document.createElement('div');
    empty.className = 'dist-empty';
    bar.appendChild(empty);
  }

  STATUSES.forEach((status) => {
    const n = byStatus[status];
    const pct = total ? Math.round((n / total) * 100) : 0;
    if (n > 0) {
      const seg = document.createElement('div');
      seg.className = `dist-seg seg-${status}`;
      seg.style.flexGrow = n;
      seg.dataset.tip = `${STATUS_LABELS[status]}: ${n} (${pct}%)`;
      bar.appendChild(seg);
    }
    const li = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = `swatch seg-${status}`;
    const label = document.createElement('span');
    label.textContent = `${STATUS_LABELS[status]} `;
    const value = document.createElement('strong');
    value.textContent = n;
    li.append(swatch, label, value);
    legend.appendChild(li);
  });
  bar.setAttribute(
    'aria-label',
    STATUSES.map((s) => `${STATUS_LABELS[s]}: ${byStatus[s]}`).join(', ')
  );
}

function renderBoard() {
  const term = searchInput.value.trim().toLowerCase();
  const base = filteredTasks();
  const visible = term ? base.filter((t) => t.title.toLowerCase().includes(term)) : base;
  const filtering = Boolean(term) || base.length !== allTasks.length;

  STATUSES.forEach((status) => {
    const col = columns[status];
    col.innerHTML = '';
    let list = visible.filter((t) => t.status === status);
    counts[status].textContent = list.length;

    if (status === 'done') {
      list.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
    } else {
      // Prazo mais proximo primeiro; sem prazo vai para o fim
      list.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    }

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = filtering ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa';
      col.appendChild(empty);
      return;
    }

    let hidden = 0;
    if (status === 'done' && !showAllDone && list.length > DONE_VISIBLE) {
      hidden = list.length - DONE_VISIBLE;
      list = list.slice(0, DONE_VISIBLE);
    }

    list.forEach((task) => col.appendChild(buildCard(task)));

    if (hidden > 0) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'show-more';
      more.textContent = `Ver anteriores (${hidden})`;
      more.addEventListener('click', () => {
        showAllDone = true;
        renderBoard();
      });
      col.appendChild(more);
    }
  });
}

function buildCard(task) {
  const card = document.createElement('article');
  card.className = 'card';
  if (task.priority === 'high' && task.status !== 'done') card.classList.add('card-high');
  if (isOverdue(task)) card.classList.add('card-overdue');
  card.tabIndex = 0;
  card.draggable = true;
  card.dataset.id = task.id;

  const tags = document.createElement('div');
  tags.className = 'card-tags';
  const prio = document.createElement('span');
  prio.className = `tag tag-${task.priority}`;
  prio.textContent = PRIORITY_LABELS[task.priority];
  tags.appendChild(prio);
  if (isOverdue(task)) {
    const late = document.createElement('span');
    late.className = 'tag tag-late';
    late.textContent = 'Atrasada';
    tags.appendChild(late);
  }

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = task.title;

  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const left = document.createElement('div');
  left.className = 'meta-left';
  if (task.assignee) {
    const who = document.createElement('span');
    who.append(svgIcon(ICON_USER), document.createTextNode(task.assignee));
    left.appendChild(who);
  }
  if (currentUser?.role === 'admin' && task.owner_username && task.owner_username !== task.assignee) {
    const owner = document.createElement('span');
    owner.title = 'Criada por';
    owner.append(svgIcon(ICON_OWNER), document.createTextNode(task.owner_username));
    left.appendChild(owner);
  }

  meta.appendChild(left);

  const due = parseDue(task.due_date);
  if (due) {
    const when = document.createElement('span');
    when.className = 'meta-due';
    when.append(svgIcon(ICON_CALENDAR), document.createTextNode(formatDue(due)));
    meta.appendChild(when);
  }

  card.append(tags, title, meta);

  card.addEventListener('click', () => openTaskDialog(task));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') openTaskDialog(task);
  });
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  return card;
}

// Arrastar e soltar entre colunas muda o status
document.querySelectorAll('.column').forEach((column) => {
  column.addEventListener('dragover', (e) => {
    e.preventDefault();
    column.classList.add('drop-target');
  });
  column.addEventListener('dragleave', (e) => {
    if (!column.contains(e.relatedTarget)) column.classList.remove('drop-target');
  });
  column.addEventListener('drop', async (e) => {
    e.preventDefault();
    column.classList.remove('drop-target');
    const id = Number(e.dataTransfer.getData('text/plain'));
    const status = column.dataset.status;
    const task = allTasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    await updateTask(id, { status });
  });
});

async function updateTask(id, patch) {
  const res = await api(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert(body.error || 'Erro ao atualizar tarefa.');
  }
  await fetchTasks();
  return res;
}

function openTaskDialog(task = null) {
  editingTaskId = task ? task.id : null;
  taskForm.reset();
  taskError.hidden = true;

  const isEdit = Boolean(task);
  document.getElementById('task-dialog-title').textContent = isEdit ? 'Editar tarefa' : 'Nova tarefa';
  document.getElementById('task-dialog-subtitle').textContent = isEdit
    ? 'Altere os campos e salve.'
    : 'Preencha os campos e crie a tarefa.';
  taskSubmitBtn.textContent = isEdit ? 'Salvar' : 'Criar tarefa';
  taskDeleteBtn.hidden = !isEdit;
  taskStatusField.hidden = !isEdit;

  if (isEdit) {
    fields.title.value = task.title;
    fields.description.value = task.description || '';
    const due = parseDue(task.due_date);
    fields.dueDate.value = due ? due.datePart : '';
    fields.dueTime.value = due ? due.timePart : '';
    fields.priority.value = task.priority;
    fields.status.value = task.status;
    fields.assignee.value = task.assignee || '';
  } else {
    fields.assignee.value = currentUser?.username || '';
  }

  taskDialog.showModal();
  fields.title.focus();
}

function closeTaskDialog() {
  taskDialog.close();
  editingTaskId = null;
}

function showTaskError(message) {
  taskError.textContent = message;
  taskError.hidden = false;
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  taskError.hidden = true;

  const title = fields.title.value.trim();
  if (!title) {
    showTaskError('Informe o título da tarefa.');
    fields.title.focus();
    return;
  }
  if (fields.dueTime.value && !fields.dueDate.value) {
    showTaskError('Informe a data do prazo (o horário sozinho não basta).');
    fields.dueDate.focus();
    return;
  }

  let due_date = null;
  if (fields.dueDate.value) {
    due_date = fields.dueTime.value ? `${fields.dueDate.value}T${fields.dueTime.value}` : fields.dueDate.value;
  }

  const payload = {
    title,
    description: fields.description.value.trim(),
    due_date,
    priority: fields.priority.value,
    assignee: fields.assignee.value.trim(),
  };

  let res;
  if (editingTaskId) {
    payload.status = fields.status.value;
    res = await api(`${API_BASE}/${editingTaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    res = await api(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    showTaskError(body.error || 'Erro ao salvar tarefa.');
    return;
  }

  closeTaskDialog();
  await fetchTasks();
});

taskDeleteBtn.addEventListener('click', async () => {
  if (!editingTaskId) return;
  if (!confirm('Excluir esta tarefa?')) return;
  await api(`${API_BASE}/${editingTaskId}`, { method: 'DELETE' });
  closeTaskDialog();
  await fetchTasks();
});

document.getElementById('new-task-btn').addEventListener('click', () => openTaskDialog());
document.getElementById('task-dialog-close').addEventListener('click', closeTaskDialog);
document.getElementById('task-cancel-btn').addEventListener('click', closeTaskDialog);
// Clique fora do modal (no backdrop) fecha
taskDialog.addEventListener('click', (e) => {
  if (e.target === taskDialog) closeTaskDialog();
});

searchInput.addEventListener('input', renderBoard);
filterAssignee.addEventListener('change', onFilterChange);
filterPriority.addEventListener('change', onFilterChange);
clearFiltersBtn.addEventListener('click', () => {
  filterAssignee.value = '';
  filterPriority.value = '';
  onFilterChange();
});

// Tooltip da barra de distribuicao
const distBar = document.getElementById('dist-bar');
const distTooltip = document.getElementById('dist-tooltip');
distBar.addEventListener('mousemove', (e) => {
  const seg = e.target.closest('.dist-seg');
  if (!seg) {
    distTooltip.hidden = true;
    return;
  }
  distTooltip.textContent = seg.dataset.tip;
  distTooltip.hidden = false;
  distTooltip.style.left = `${e.clientX + 12}px`;
  distTooltip.style.top = `${e.clientY + 12}px`;
});
distBar.addEventListener('mouseleave', () => {
  distTooltip.hidden = true;
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
    const name = document.createElement('span');
    name.textContent = user.username;
    const role = document.createElement('span');
    role.className = `tag ${user.role === 'admin' ? 'tag-high' : 'tag-low'}`;
    role.textContent = user.role;
    li.append(name, role);
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
    await Promise.all([loadUsers(), loadAssigneeOptions()]);
  } else {
    const body = await res.json();
    newUserError.textContent = body.error || 'Erro ao criar usuário.';
    newUserError.hidden = false;
  }
});

loadCurrentUser();
