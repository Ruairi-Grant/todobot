import { v4 as uuid } from "uuid";
import type { Todo } from "./store";
import type { TodoProvider } from "./provider";

export class MicrosoftTodoProvider implements TodoProvider {
  async getTodos(): Promise<Todo[]> {
    console.log("[microsoft-todo] getTodos() — stub: returning empty list");
    // TODO: implement with Microsoft Graph API when Azure AD app registration is ready
    // GET https://graph.microsoft.com/v1.0/me/todo/lists/{listId}/tasks
    return [];
  }

  async addTodos(items: { text: string; dueDate?: string }[]): Promise<Todo[]> {
    console.log("[microsoft-todo] addTodos() — stub:", items);
    // TODO: implement with Microsoft Graph API
    // POST https://graph.microsoft.com/v1.0/me/todo/lists/{listId}/tasks
    return items.map((item) => ({
      id: uuid(),
      text: item.text,
      done: false,
      ...(item.dueDate ? { dueDate: item.dueDate } : {}),
      createdAt: new Date().toISOString(),
    }));
  }

  async completeTodo(idOrText: string): Promise<Todo | null> {
    console.log("[microsoft-todo] completeTodo() — stub:", idOrText);
    // TODO: implement with Microsoft Graph API
    // PATCH https://graph.microsoft.com/v1.0/me/todo/lists/{listId}/tasks/{taskId}
    return null;
  }

  async clearTodos(): Promise<void> {
    console.log("[microsoft-todo] clearTodos() — stub");
    // TODO: implement with Microsoft Graph API
  }
}
