import type { Todo } from "./store";

export interface TodoProvider {
  getTodos(): Promise<Todo[]>;
  addTodos(items: { text: string; dueDate?: string }[]): Promise<Todo[]>;
  completeTodo(idOrText: string): Promise<Todo | null>;
  clearTodos(): Promise<void>;
}
