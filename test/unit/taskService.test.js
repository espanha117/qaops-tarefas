import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db.js';
import { createTaskService, ValidationError, NotFoundError } from '../../src/services/taskService.js';

let db;
let taskService;

beforeEach(() => {
  db = createDb(':memory:');
  taskService = createTaskService(db);
});

describe('create', () => {
  it('rejeita titulo vazio', () => {
    expect(() => taskService.create({ title: '   ' })).toThrow(ValidationError);
  });

  it('rejeita status invalido', () => {
    expect(() => taskService.create({ title: 'Tarefa', status: 'invalido' })).toThrow(ValidationError);
  });

  it('rejeita due_date invalida', () => {
    expect(() => taskService.create({ title: 'Tarefa', due_date: 'nao-e-data' })).toThrow(ValidationError);
  });

  it('cria tarefa valida com status padrao todo', () => {
    const task = taskService.create({ title: 'Comprar insumos' });
    expect(task.status).toBe('todo');
    expect(task.completed_at).toBeNull();
  });
});

describe('update - transicao de status', () => {
  it('preenche completed_at ao mover para done', () => {
    const task = taskService.create({ title: 'Fechar pedido' });
    const updated = taskService.update(task.id, { status: 'done' });
    expect(updated.status).toBe('done');
    expect(updated.completed_at).not.toBeNull();
  });

  it('limpa completed_at ao reabrir tarefa concluida', () => {
    const task = taskService.create({ title: 'Fechar pedido', status: 'done' });
    const reopened = taskService.update(task.id, { status: 'todo' });
    expect(reopened.completed_at).toBeNull();
  });

  it('lanca NotFoundError ao atualizar id inexistente', () => {
    expect(() => taskService.update(9999, { status: 'done' })).toThrow(NotFoundError);
  });
});

describe('update - validacoes de patch', () => {
  it('rejeita title vazio no patch', () => {
    const task = taskService.create({ title: 'Original' });
    expect(() => taskService.update(task.id, { title: '   ' })).toThrow(ValidationError);
  });

  it('rejeita title acima de 200 caracteres no patch', () => {
    const task = taskService.create({ title: 'Original' });
    expect(() => taskService.update(task.id, { title: 'a'.repeat(201) })).toThrow(ValidationError);
  });

  it('rejeita status invalido no patch', () => {
    const task = taskService.create({ title: 'Original' });
    expect(() => taskService.update(task.id, { status: 'invalido' })).toThrow(ValidationError);
  });

  it('rejeita priority invalida no patch', () => {
    const task = taskService.create({ title: 'Original' });
    expect(() => taskService.update(task.id, { priority: 'invalida' })).toThrow(ValidationError);
  });

  it('aceita priority valida no patch', () => {
    const task = taskService.create({ title: 'Original' });
    const updated = taskService.update(task.id, { priority: 'high' });
    expect(updated.priority).toBe('high');
  });

  it('rejeita due_date invalida no patch', () => {
    const task = taskService.create({ title: 'Original' });
    expect(() => taskService.update(task.id, { due_date: 'nao-e-data' })).toThrow(ValidationError);
  });

  it('aceita due_date nula no patch (remove prazo)', () => {
    const task = taskService.create({ title: 'Original', due_date: '2026-12-01' });
    const updated = taskService.update(task.id, { due_date: null });
    expect(updated.due_date).toBeNull();
  });

  it('atualiza description e assignee no patch', () => {
    const task = taskService.create({ title: 'Original' });
    const updated = taskService.update(task.id, { description: 'Detalhes', assignee: 'Maria' });
    expect(updated.description).toBe('Detalhes');
    expect(updated.assignee).toBe('Maria');
  });
});

describe('list', () => {
  it('filtra por status valido', () => {
    taskService.create({ title: 'A fazer' });
    taskService.create({ title: 'Concluida', status: 'done' });
    const done = taskService.list({ status: 'done' });
    expect(done).toHaveLength(1);
    expect(done[0].title).toBe('Concluida');
  });

  it('rejeita filtro de status invalido', () => {
    expect(() => taskService.list({ status: 'invalido' })).toThrow(ValidationError);
  });

  it('sem filtro retorna todas as tarefas', () => {
    taskService.create({ title: 'Uma' });
    taskService.create({ title: 'Duas' });
    expect(taskService.list()).toHaveLength(2);
  });
});

describe('remove', () => {
  it('remove tarefa existente e some do get', () => {
    const task = taskService.create({ title: 'Descartar' });
    taskService.remove(task.id);
    expect(() => taskService.getById(task.id)).toThrow(NotFoundError);
  });
});
