import { llm } from "./llm";
import { add, multiply, echo, add_todos, get_todos, complete_todo, clear_todos } from "./tools";
import { makeAgent } from "./agent-factory";
import { makeSupervisor } from "./supervisor";

const math = makeAgent({
  name: "math_expert",
  llm,
  tools: [add, multiply],
  system: "You are a math expert. Use one tool at a time.",
});
const writer = makeAgent({
  name: "writer",
  llm,
  tools: [echo],
  system: "You write crisp, structured answers.",
});
const todoAgent = makeAgent({
  name: "todo_agent",
  llm,
  tools: [add_todos, get_todos, complete_todo, clear_todos],
  system: `You are a task planning assistant. Your ONLY job is to manage todo items using tools.

Rules:
- When the user gives you a goal or project, break it down into concrete, actionable todo items and call add_todos.
- When adding todos, parse any natural language dates ("tomorrow", "next Friday", "in 3 days") into ISO dates (YYYY-MM-DD) for the dueDate field. Today is ${new Date().toISOString().slice(0, 10)}.
- When the user asks to see/show/list todos, call get_todos.
- When the user asks to complete/finish/done a task, call complete_todo with the task description or ID.
- When the user asks to clear/delete all todos, call clear_todos.
- You MUST call a tool for every request. Never respond with only free text.
- Format todo lists as numbered markdown. Include due dates when present (e.g. "📅 due 2026-04-15").`,
});

export const supervisorApp = makeSupervisor({
  agents: [math, writer, todoAgent],
  llm,
  outputMode: "last_message",
  supervisorName: "supervisor",
  prompt:
    "You are a routing supervisor. Your job is to delegate tasks to the right agent — NEVER answer directly.\n\n" +
    "Routing rules:\n" +
    "- Any request involving planning, organizing, task lists, todos, events, or projects → delegate to todo_agent\n" +
    "- Math calculations → delegate to math_expert\n" +
    "- Writing or summarizing text → delegate to writer\n" +
    "- If unsure, default to todo_agent\n\n" +
    "IMPORTANT: Do NOT answer the user yourself. Always hand off to an agent.",
});
