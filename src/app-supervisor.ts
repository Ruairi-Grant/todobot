import { llm } from "./llm";
import { add, multiply, echo, add_todos, get_todos, complete_todo, clear_todos } from "./tools";
import { create_calendar_event, list_calendar_events, delete_calendar_event } from "./calendar/tools";
import { makeAgent } from "./agent-factory";
import { makeSupervisor } from "./supervisor";
import { TIMEZONE } from "./env";

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
const calendarAgent = makeAgent({
  name: "calendar_agent",
  llm,
  tools: [create_calendar_event, list_calendar_events, delete_calendar_event],
  system: `You are a calendar assistant. Your ONLY job is to manage Google Calendar events using tools.

Before calling any tool, you MUST parse the user's natural language into structured data:
- "gym tomorrow at 7pm" → title: "Gym", start: tomorrow 19:00, end: tomorrow 20:00
- "meeting with Bob on Friday 2-3pm" → title: "Meeting with Bob", start: Friday 14:00, end: Friday 15:00
- "lunch at noon" → title: "Lunch", start: today 12:00, end: today 13:00
- If no end time given, default to 1 hour after start.
- If no date given, assume today.
- Today is ${new Date().toISOString().slice(0, 10)}.
- The user's timezone is ${TIMEZONE}. ALWAYS pass timezone="${TIMEZONE}" when calling create_calendar_event.

Rules:
- "what's my day", "my schedule", "what do I have" → call list_calendar_events
- "schedule", "add", "book", "plan", "set up" an event → call create_calendar_event
- "cancel", "delete", "remove" an event → call delete_calendar_event (need event_id from list first)
- You MUST call a tool for every request. Never respond with only free text.
- Format event lists clearly with times, titles, and locations.
- ALWAYS include timezone="${TIMEZONE}" in create_calendar_event calls.`,
});

export const supervisorApp = makeSupervisor({
  agents: [math, writer, todoAgent, calendarAgent],
  llm,
  outputMode: "last_message",
  supervisorName: "supervisor",
  prompt:
    "You are a routing supervisor. Your job is to delegate tasks to the right agent — NEVER answer directly.\n\n" +
    "Routing rules:\n" +
    '- Scheduling, calendar, "what\'s my day", "book", "schedule", "add event", meetings, appointments → delegate to calendar_agent\n' +
    "- Planning, organizing, task lists, todos, projects, breaking down goals → delegate to todo_agent\n" +
    "- Math calculations → delegate to math_expert\n" +
    "- Writing or summarizing text → delegate to writer\n" +
    "- If unsure, default to todo_agent\n\n" +
    "IMPORTANT: Do NOT answer the user yourself. Always hand off to an agent.",
});
