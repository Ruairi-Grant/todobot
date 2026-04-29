import { v4 as uuid } from "uuid";
import { readTodos, writeTodos, type Todo } from "./store";
import type { TodoProvider } from "./provider";

export class LocalJsonTodoProvider implements TodoProvider {
  async getTodos(): Promise<Todo[]> {
    return readTodos();
  }

  async addTodos(items: { text: string; dueDate?: string }[]): Promise<Todo[]> {
    const existing = readTodos();
    const now = new Date().toISOString();
    const existingTexts = new Set(existing.map((t) => t.text.toLowerCase()));
    const newTodos: Todo[] = items
      .filter((item) => !existingTexts.has(item.text.toLowerCase()))
      .map((item) => ({
        id: uuid(),
        text: item.text,
        done: false,
        ...(item.dueDate ? { dueDate: item.dueDate } : {}),
        createdAt: now,
      }));
    const all = [...existing, ...newTodos];
    writeTodos(all);
    return newTodos;
  }

  async completeTodo(idOrText: string): Promise<Todo | null> {
    const todos = readTodos();
    let todo = todos.find((t) => t.id === idOrText);
    if (!todo) {
      const query = idOrText.toLowerCase();
      todo = todos.find((t) => !t.done && t.text.toLowerCase().includes(query));
    }
    if (!todo) return null;
    todo.done = true;
    writeTodos(todos);
    return todo;
  }

  async clearTodos(): Promise<void> {
    writeTodos([]);
  }
}
