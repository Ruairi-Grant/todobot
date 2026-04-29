import { z } from "zod";
import { tool } from "@langchain/core/tools";
import type { TodoProvider } from "./provider";
import { LocalJsonTodoProvider } from "./local-provider";
import { MicrosoftTodoProvider } from "./microsoft-provider";

const TODO_PROVIDER = process.env.TODO_PROVIDER ?? "local";

function getProvider(): TodoProvider {
  switch (TODO_PROVIDER) {
    case "microsoft":
      return new MicrosoftTodoProvider();
    default:
      return new LocalJsonTodoProvider();
  }
}

const provider = getProvider();

// ── get_todos ───────────────────────────────────────────────
export const get_todos = tool(
  async () => {
    const todos = await provider.getTodos();
    console.log("[tool:get_todos]", JSON.stringify(todos));
    return JSON.stringify(todos);
  },
  {
    name: "get_todos",
    description: "Get all current todo items as raw JSON. Prefer get_todos_summary for user-facing queries.",
    schema: z.object({}),
  }
);

// ── get_todos_summary ───────────────────────────────────────
export const get_todos_summary = tool(
  async (input) => {
    const todos = await provider.getTodos();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = todos;

    if (input.status === "pending") filtered = filtered.filter((t) => !t.done);
    else if (input.status === "done") filtered = filtered.filter((t) => t.done);

    if (input.due_within_days !== undefined) {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() + input.due_within_days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);
      filtered = filtered.filter(
        (t) => t.dueDate && t.dueDate.slice(0, 10) >= todayStr && t.dueDate.slice(0, 10) <= cutoffStr,
      );
    }

    filtered.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    if (filtered.length === 0) return "No matching todos found.";

    const lines = filtered.map((t, i) => {
      const check = t.done ? "✅" : "⬜";
      const due = t.dueDate ? ` 📅 ${t.dueDate.slice(0, 10)}` : "";
      return `${i + 1}. ${check} ${t.text}${due}`;
    });

    const header = `**${filtered.length} todo(s)** (of ${todos.length} total):`;
    const result = [header, "", ...lines].join("\n");
    console.log(`[tool:get_todos_summary] status=${input.status ?? "all"} due_within=${input.due_within_days ?? "any"} → ${filtered.length} items`);
    return result;
  },
  {
    name: "get_todos_summary",
    description:
      "Get a filtered, formatted summary of todos. Use this for user-facing queries like 'what's due this week', 'show pending todos', etc.",
    schema: z.object({
      status: z
        .enum(["all", "pending", "done"])
        .optional()
        .describe("Filter by status. Defaults to all."),
      due_within_days: z
        .number()
        .optional()
        .describe("Only show todos due within this many days from today."),
    }),
  }
);

// ── add_todos ───────────────────────────────────────────────
export const add_todos = tool(
  async (input) => {
    const newTodos = await provider.addTodos(input.todos);
    console.log("[tool:add_todos]", { input: input.todos, added: newTodos.length });
    return JSON.stringify(newTodos);
  },
  {
    name: "add_todos",
    description:
      "Add new todo items. Each item has a text description and an optional dueDate (ISO 8601 date string, e.g. 2026-04-15).",
    schema: z.object({
      todos: z
        .array(
          z.object({
            text: z.string().min(1).describe("Todo item description"),
            dueDate: z
              .string()
              .optional()
              .describe("Due date as ISO 8601 date string (YYYY-MM-DD)."),
          })
        )
        .min(1)
        .describe("List of todo items to add"),
    }),
  }
);

// ── complete_todo ───────────────────────────────────────────
export const complete_todo = tool(
  async (input) => {
    const todo = await provider.completeTodo(input.id_or_text);
    if (!todo) return JSON.stringify({ error: "Todo not found" });
    console.log("[tool:complete_todo]", todo.id, todo.text);
    return JSON.stringify(todo);
  },
  {
    name: "complete_todo",
    description:
      "Mark a todo item as completed. You can pass the todo's ID or a text fragment that matches its description.",
    schema: z.object({
      id_or_text: z
        .string()
        .describe("The ID of the todo, or a text fragment matching the todo description"),
    }),
  }
);

// ── clear_todos ─────────────────────────────────────────────
export const clear_todos = tool(
  async () => {
    await provider.clearTodos();
    console.log("[tool:clear_todos] all todos cleared");
    return JSON.stringify({ cleared: true });
  },
  {
    name: "clear_todos",
    description: "Remove all todo items",
    schema: z.object({}),
  }
);
