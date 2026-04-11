import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  dueDate?: string;
  createdAt: string;
}

const TODOS_FILE = join(process.cwd(), "todos.json");

export function readTodos(): Todo[] {
  if (!existsSync(TODOS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(TODOS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function writeTodos(todos: Todo[]): void {
  writeFileSync(TODOS_FILE, JSON.stringify(todos, null, 2));
  console.log(`[todos] wrote ${todos.length} items to ${TODOS_FILE}`);
}
