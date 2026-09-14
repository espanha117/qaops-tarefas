const API_BASE = '/api/tasks';

const columns = {
  todo: document.getElementById('col-todo'),
  doing: document.getElementById('col-doing'),
  done: document.getElementById('col-done'),
};

const form = document.getElementById('new-task-form');

async function fetchTasks() {
  const res = await fetch(API_BASE);
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
  await fetch(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  fetchTasks();
}

async function deleteTask(id) {
  await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  fetchTasks();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = document.getElementById('title').value;
  const assignee = document.getElementById('assignee').value;
  const priority = document.getElementById('priority').value;
  const due_date = document.getElementById('due_date').value || null;

  const res = await fetch(API_BASE, {
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

fetchTasks();
