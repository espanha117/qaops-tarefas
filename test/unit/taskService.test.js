import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db.js';
import { createTaskService, ValidationError, NotFoundError, ForbiddenError } from '../../src/services/taskService.js';
import { createAuthService } from '../../src/services/authService.js';

let db;
let taskService;
let alice;
let bob;
let admin;

beforeEach(() => {
  db = createDb(':memory:');
  taskService = createTaskService(db);
  const authService = createAuthService(db);
  alice = authService.createUser({ username: 'alice', password: 'senha123', role: 'comum' });
  bob = authService.createUser({ username: 'bob', password: 'senha123', role: 'comum' });
  admin = authService.createUser({ username: 'root', password: 'senha123', role: 'admin' });
});

describe('create', () => {
  it('rejeita titulo vazio', () => {
    expect(() => taskService.create({ title: '   ' }, alice)).toThrow(ValidationError);
  });

  it('rejeita status invalido', () => {
    expect(() => taskService.create({ title: 'Tarefa', status: 'invalido' }, alice)).toThrow(ValidationError);
  });

  it('rejeita due_date invalida', () => {
    expect(() => taskService.create({ title: 'Tarefa', due_date: 'nao-e-data' }, alice)).toThrow(ValidationError);
  });

  it('cria tarefa valida com status padrao todo, dona do usuario que criou', () => {
    const task = taskService.create({ title: 'Comprar insumos' }, alice);
    expect(task.status).toBe('todo');
    expect(task.completed_at).toBeNull();
    expect(task.owner_id).toBe(alice.id);
    expect(task.owner_username).toBe('alice');
  });
});

describe('update - transicao de status', () => {
  it('preenche completed_at ao mover para done', () => {
    const task = taskService.create({ title: 'Fechar pedido' }, alice);
    const updated = taskService.update(task.id, { status: 'done' }, alice);
    expect(updated.status).toBe('done');
    expect(updated.completed_at).not.toBeNull();
  });

  it('limpa completed_at ao reabrir tarefa concluida', () => {
    const task = taskService.create({ title: 'Fechar pedido', status: 'done' }, alice);
    const reopened = taskService.update(task.id, { status: 'todo' }, alice);
    expect(reopened.completed_at).toBeNull();
  });

  it('lanca NotFoundError ao atualizar id inexistente', () => {
    expect(() => taskService.update(9999, { status: 'done' }, alice)).toThrow(NotFoundError);
  });
});

describe('update - validacoes de patch', () => {
  it('rejeita title vazio no patch', () => {
    const task = taskService.create({ title: 'Original' }, alice);
    expect(() => taskService.update(task.id, { title: '   ' }, alice)).toThrow(ValidationError);
  });

  it('rejeita title acima de 200 caracteres no patch', () => {
    const task = taskService.create({ title: 'Original' }, alice);
    expect(() => taskService.update(task.id, { title: 'a'.repeat(201) }, alice)).toThrow(ValidationError);
  });

  it('rejeita status invalido no patch', () => {
    const task = taskService.create({ title: 'Original' }, alice);
    expect(() => taskService.update(task.id, { status: 'invalido' }, alice)).toThrow(ValidationError);
  });

  it('rejeita priority invalida no patch', () => {
    const task = taskService.create({ title: 'Original' }, alice);
    expect(() => taskService.update(task.id, { priority: 'invalida' }, alice)).toThrow(ValidationError);
  });

  it('aceita priority valida no patch', () => {
    const task = taskService.create({ title: 'Original' }, alice);
    const updated = taskService.update(task.id, { priority: 'high' }, alice);
    expect(updated.priority).toBe('high');
  });

  it('rejeita due_date invalida no patch', () => {
    const task = taskService.create({ title: 'Original' }, alice);
    expect(() => taskService.update(task.id, { due_date: 'nao-e-data' }, alice)).toThrow(ValidationError);
  });

  it('aceita due_date nula no patch (remove prazo)', () => {
    const task = taskService.create({ title: 'Original', due_date: '2026-12-01' }, alice);
    const updated = taskService.update(task.id, { due_date: null }, alice);
    expect(updated.due_date).toBeNull();
  });

  it('atualiza description e assignee no patch', () => {
    const task = taskService.create({ title: 'Original' }, alice);
    const updated = taskService.update(task.id, { description: 'Detalhes', assignee: 'Maria' }, alice);
    expect(updated.description).toBe('Detalhes');
    expect(updated.assignee).toBe('Maria');
  });
});

describe('list - visibilidade por dono', () => {
  it('usuario comum ve apenas suas proprias tarefas', () => {
    taskService.create({ title: 'Tarefa da Alice' }, alice);
    taskService.create({ title: 'Tarefa do Bob' }, bob);

    const aliceView = taskService.list({}, alice);
    expect(aliceView).toHaveLength(1);
    expect(aliceView[0].title).toBe('Tarefa da Alice');
  });

  it('admin ve tarefas de todos os usuarios', () => {
    taskService.create({ title: 'Tarefa da Alice' }, alice);
    taskService.create({ title: 'Tarefa do Bob' }, bob);

    expect(taskService.list({}, admin)).toHaveLength(2);
  });

  it('filtra por status valido dentro do escopo do usuario', () => {
    taskService.create({ title: 'A fazer' }, alice);
    taskService.create({ title: 'Concluida', status: 'done' }, alice);
    taskService.create({ title: 'Concluida do Bob', status: 'done' }, bob);

    const done = taskService.list({ status: 'done' }, alice);
    expect(done).toHaveLength(1);
    expect(done[0].title).toBe('Concluida');
  });

  it('rejeita filtro de status invalido', () => {
    expect(() => taskService.list({ status: 'invalido' }, alice)).toThrow(ValidationError);
  });
});

describe('getById - controle de acesso', () => {
  it('dono acessa a propria tarefa', () => {
    const task = taskService.create({ title: 'Minha tarefa' }, alice);
    expect(taskService.getById(task.id, alice).id).toBe(task.id);
  });

  it('admin acessa tarefa de qualquer usuario', () => {
    const task = taskService.create({ title: 'Tarefa da Alice' }, alice);
    expect(taskService.getById(task.id, admin).id).toBe(task.id);
  });

  it('lanca ForbiddenError quando usuario comum acessa tarefa de outro usuario', () => {
    const task = taskService.create({ title: 'Tarefa da Alice' }, alice);
    expect(() => taskService.getById(task.id, bob)).toThrow(ForbiddenError);
  });

  it('lanca NotFoundError para id inexistente', () => {
    expect(() => taskService.getById(9999, alice)).toThrow(NotFoundError);
  });
});

describe('update/remove - controle de acesso', () => {
  it('lanca ForbiddenError ao tentar atualizar tarefa de outro usuario', () => {
    const task = taskService.create({ title: 'Tarefa da Alice' }, alice);
    expect(() => taskService.update(task.id, { status: 'done' }, bob)).toThrow(ForbiddenError);
  });

  it('lanca ForbiddenError ao tentar remover tarefa de outro usuario', () => {
    const task = taskService.create({ title: 'Tarefa da Alice' }, alice);
    expect(() => taskService.remove(task.id, bob)).toThrow(ForbiddenError);
  });

  it('admin pode remover tarefa de qualquer usuario', () => {
    const task = taskService.create({ title: 'Tarefa da Alice' }, alice);
    taskService.remove(task.id, admin);
    expect(() => taskService.getById(task.id, admin)).toThrow(NotFoundError);
  });
});

describe('remove', () => {
  it('remove tarefa existente e some do get', () => {
    const task = taskService.create({ title: 'Descartar' }, alice);
    taskService.remove(task.id, alice);
    expect(() => taskService.getById(task.id, alice)).toThrow(NotFoundError);
  });
});
