import { ValidationError, NotFoundError, ForbiddenError } from '../errors.js';

export { ValidationError, NotFoundError, ForbiddenError };

const STATUSES = ['todo', 'doing', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

function isValidIsoDate(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function validateCreatePayload(payload) {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (!title) {
    throw new ValidationError('title e obrigatorio e nao pode ser vazio.');
  }
  if (title.length > 200) {
    throw new ValidationError('title deve ter no maximo 200 caracteres.');
  }

  const status = payload.status ?? 'todo';
  if (!STATUSES.includes(status)) {
    throw new ValidationError(`status deve ser um de: ${STATUSES.join(', ')}.`);
  }

  const priority = payload.priority ?? 'medium';
  if (!PRIORITIES.includes(priority)) {
    throw new ValidationError(`priority deve ser um de: ${PRIORITIES.join(', ')}.`);
  }

  if (payload.due_date != null && !isValidIsoDate(payload.due_date)) {
    throw new ValidationError('due_date deve ser uma data valida (ISO 8601).');
  }

  return {
    title,
    description: payload.description ?? null,
    status,
    priority,
    assignee: payload.assignee ?? null,
    due_date: payload.due_date ?? null,
  };
}

function validatePatchPayload(payload) {
  const patch = {};

  if (payload.title !== undefined) {
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) {
      throw new ValidationError('title nao pode ser vazio.');
    }
    if (title.length > 200) {
      throw new ValidationError('title deve ter no maximo 200 caracteres.');
    }
    patch.title = title;
  }

  if (payload.status !== undefined) {
    if (!STATUSES.includes(payload.status)) {
      throw new ValidationError(`status deve ser um de: ${STATUSES.join(', ')}.`);
    }
    patch.status = payload.status;
  }

  if (payload.priority !== undefined) {
    if (!PRIORITIES.includes(payload.priority)) {
      throw new ValidationError(`priority deve ser um de: ${PRIORITIES.join(', ')}.`);
    }
    patch.priority = payload.priority;
  }

  if (payload.due_date !== undefined) {
    if (payload.due_date !== null && !isValidIsoDate(payload.due_date)) {
      throw new ValidationError('due_date deve ser uma data valida (ISO 8601).');
    }
    patch.due_date = payload.due_date;
  }

  if (payload.description !== undefined) {
    patch.description = payload.description;
  }

  if (payload.assignee !== undefined) {
    patch.assignee = payload.assignee;
  }

  return patch;
}

function isAdmin(user) {
  return user?.role === 'admin';
}

export function createTaskService(db) {
  // getById nao aplica controle de acesso - uso interno, quando a autorizacao
  // ja foi decidida pelo chamador (ex.: create, apos inserir a linha).
  function getRawById(id) {
    const row = db
      .prepare(
        `SELECT tasks.*, users.username AS owner_username
         FROM tasks LEFT JOIN users ON users.id = tasks.owner_id
         WHERE tasks.id = ?`
      )
      .get(id);
    if (!row) {
      throw new NotFoundError(`Tarefa ${id} nao encontrada.`);
    }
    return row;
  }

  function getById(id, user) {
    const row = getRawById(id);
    if (!isAdmin(user) && row.owner_id !== user.id) {
      throw new ForbiddenError('Voce nao tem acesso a esta tarefa.');
    }
    return row;
  }

  function list({ status } = {}, user) {
    if (status !== undefined && !STATUSES.includes(status)) {
      throw new ValidationError(`status deve ser um de: ${STATUSES.join(', ')}.`);
    }

    const conditions = [];
    const params = {};
    if (status !== undefined) {
      conditions.push('tasks.status = @status');
      params.status = status;
    }
    if (!isAdmin(user)) {
      conditions.push('tasks.owner_id = @owner_id');
      params.owner_id = user.id;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return db
      .prepare(
        `SELECT tasks.*, users.username AS owner_username
         FROM tasks LEFT JOIN users ON users.id = tasks.owner_id
         ${where} ORDER BY tasks.id`
      )
      .all(params);
  }

  function create(payload, user) {
    const data = validateCreatePayload(payload);
    const createdAt = new Date().toISOString();
    const completedAt = data.status === 'done' ? createdAt : null;

    const result = db
      .prepare(
        `INSERT INTO tasks (title, description, status, priority, assignee, due_date, owner_id, created_at, completed_at)
         VALUES (@title, @description, @status, @priority, @assignee, @due_date, @owner_id, @created_at, @completed_at)`
      )
      .run({ ...data, owner_id: user.id, created_at: createdAt, completed_at: completedAt });

    return getRawById(result.lastInsertRowid);
  }

  function update(id, payload, user) {
    const existing = getById(id, user);
    const patch = validatePatchPayload(payload);

    const nextStatus = patch.status ?? existing.status;
    let completedAt = existing.completed_at;
    if (nextStatus === 'done' && existing.status !== 'done') {
      completedAt = new Date().toISOString();
    } else if (nextStatus !== 'done') {
      completedAt = null;
    }

    const merged = {
      title: patch.title ?? existing.title,
      description: patch.description ?? existing.description,
      status: nextStatus,
      priority: patch.priority ?? existing.priority,
      assignee: patch.assignee ?? existing.assignee,
      due_date: patch.due_date !== undefined ? patch.due_date : existing.due_date,
      completed_at: completedAt,
    };

    db.prepare(
      `UPDATE tasks SET title = @title, description = @description, status = @status,
       priority = @priority, assignee = @assignee, due_date = @due_date, completed_at = @completed_at
       WHERE id = @id`
    ).run({ ...merged, id });

    return getRawById(id);
  }

  function remove(id, user) {
    getById(id, user);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }

  return { list, getById, create, update, remove };
}
