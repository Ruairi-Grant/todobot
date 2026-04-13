import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { v4 as uuid } from "uuid";
import { readTodos, writeTodos, type Todo } from "./todos";

// ── Original starter-kit tools ──────────────────────────────
export const add = tool(async (a) => a.a + a.b, {
  name: "add",
  description: "Add two numbers",
  schema: z.object({ a: z.number(), b: z.number() }),
});
export const multiply = tool(async (a) => a.a * a.b, {
  name: "multiply",
  description: "Multiply two numbers",
  schema: z.object({ a: z.number(), b: z.number() }),
});
export const echo = tool(async (a) => a.text, {
  name: "echo",
  description: "Echo text",
  schema: z.object({ text: z.string() }),
});

// ── Todo tools ──────────────────────────────────────────────
export const get_todos = tool(
  async () => {
    const todos = readTodos();
    console.log("[tool:get_todos]", JSON.stringify(todos));
    return JSON.stringify(todos);
  },
  {
    name: "get_todos",
    description: "Get all current todo items as raw JSON. Prefer get_todos_summary for user-facing queries.",
    schema: z.object({}),
  }
);

export const get_todos_summary = tool(
  // TODO: understand this function
  // TODO: are we returning all todos, or just a subset, what is the best behaviour here?
  async (input) => {
    const todos = readTodos();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = todos;

    // TODO: are status and t.done interdependant, is there a seperation of converns
    // Filter by done status
    if (input.status === "pending") filtered = filtered.filter((t) => !t.done);
    else if (input.status === "done") filtered = filtered.filter((t) => t.done);

    // Filter by date range
    if (input.due_within_days !== undefined) {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() + input.due_within_days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);
      filtered = filtered.filter(
        (t) => t.dueDate && t.dueDate.slice(0, 10) >= todayStr && t.dueDate.slice(0, 10) <= cutoffStr,
      );
    }

    // Sort by due date
    filtered.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    // Format as markdown
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
      "Get a filtered, formatted summary of todos. Use this for user-facing queries like 'what's due this week', 'show pending todos', etc. Returns pre-formatted markdown — relay it directly to the user.",
    schema: z.object({
      status: z
        .enum(["all", "pending", "done"])
        .optional()
        .describe("Filter by status. Defaults to all."),
      due_within_days: z
        .number()
        .optional()
        .describe("Only show todos due within this many days from today. E.g. 7 for 'next week', 1 for 'tomorrow'."),
    }),
  }
);

export const add_todos = tool(
  async (input) => {
    const existing = readTodos();
    const now = new Date().toISOString();
    // Deduplicate: skip items whose text already exists
    // TODO: why are duplicates happening, is this a dangerouts fallback covering bad llm behaviour
    const existingTexts = new Set(existing.map((t) => t.text.toLowerCase()));
    const newTodos: Todo[] = input.todos
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
    console.log("[tool:add_todos]", { input: input.todos, added: newTodos.length, total: all.length });
    return JSON.stringify(newTodos);
  },
  {
    name: "add_todos",
    description:
      "Add new todo items. Each item has a text description and an optional dueDate (ISO 8601 date string, e.g. 2026-04-15). Parse natural language dates like 'tomorrow', 'next Friday', 'in 3 days' into ISO dates before calling.",
    schema: z.object({
      todos: z
        .array(
          z.object({
            text: z.string().min(1).describe("Todo item description"),
            dueDate: z
              .string()
              .optional()
              .describe("Due date as ISO 8601 date string (YYYY-MM-DD). Parse natural language dates before calling."),
          })
        )
        .min(1)
        .describe("List of todo items to add"),
    }),
  }
);

export const complete_todo = tool(
  async (input) => {
    const todos = readTodos();
    // Match by ID first, then fall back to case-insensitive text substring match
    let todo = todos.find((t) => t.id === input.id_or_text);
    if (!todo) {
      const query = input.id_or_text.toLowerCase();
      todo = todos.find(
        (t) => !t.done && t.text.toLowerCase().includes(query)
      );
    }
    if (!todo) return JSON.stringify({ error: "Todo not found" });
    todo.done = true;
    writeTodos(todos);
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

export const clear_todos = tool(
  async () => {
    writeTodos([]);
    console.log("[tool:clear_todos] all todos cleared");
    return JSON.stringify({ cleared: true });
  },
  {
    name: "clear_todos",
    description: "Remove all todo items",
    schema: z.object({}),
  }
);
