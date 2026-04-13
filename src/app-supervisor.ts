import { llm } from "./llm";
import { add, multiply, echo, add_todos, get_todos, get_todos_summary, complete_todo, clear_todos } from "./tools";
import { create_calendar_event, list_calendar_events, delete_calendar_event, find_free_slots, get_calendar_summary } from "./calendar/tools";
import {
  create_task, get_tasks, get_task_detail, update_task,
  add_subtasks_tool, complete_subtask_tool,
  propose_action, confirm_action, reject_action,
} from "./task-tools";
import { makeAgent } from "./agent-factory";
import { makeSupervisor } from "./supervisor";
import { TIMEZONE } from "./env";

// TODO: is this agent used for anything?
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

// TODO: this prompt needs to be updated
// TODO: is this used, seems to be mixing concerns with the supervisor
const plannerAgent = makeAgent({
  name: "planner_agent",
  llm,
  tools: [
    // Task management (primary)
    create_task, get_tasks, get_task_detail, update_task,
    add_subtasks_tool, complete_subtask_tool,
    propose_action, confirm_action, reject_action,
    // Todo tools (quick items & backward compat)
    // TODO: we should get rid of this backward compat if it is no longer used/in the project plan
    add_todos, get_todos, get_todos_summary, complete_todo, clear_todos,
    // Calendar tools (read-only are direct; writes go through propose_action for tasks)
    create_calendar_event, list_calendar_events, delete_calendar_event, find_free_slots, get_calendar_summary,
  ],
  system: `You are a personal planner assistant that manages tasks, todos, and Google Calendar events.
Today is ${new Date().toISOString().slice(0, 10)}. The user's timezone is ${TIMEZONE}.

═══ TASK SYSTEM (PRIMARY) ═══
You manage rich, stateful TASKS that evolve over time. Tasks have subtasks, lifecycle status, and proposed actions.

When the user gives a goal or project:
1. Call create_task with a title, goal, broken-down subtasks, and any missing_info the user hasn't provided yet.
2. If the task has missing_info, ask the user for clarification. When they answer, call update_task to clear missing_info and update context.
3. When a task is ready and involves a side-effect (calendar event, todo creation), call propose_action instead of directly creating it. Then ask the user to confirm.
4. When the user approves, call confirm_action to execute the proposed action.
5. If the user rejects, call reject_action.

Task lifecycle: draft → ready → in_progress → done (or blocked)
- "draft" = missing info, not actionable yet
- "ready" = all info gathered, can start
- "in_progress" = work underway
- "done" = auto-set when all subtasks completed, or set manually

Use get_tasks to show the user their tasks. Use get_task_detail for a single task's full status.
Use complete_subtask to mark subtask progress. Use add_subtasks to break work down further.
Use update_task to add context, notes, or change status.

═══ QUICK TODOS (BACKWARD COMPAT) ═══
For simple, one-off items that don't need task tracking ("add milk to my list", "remind me to call Bob"):
- Use add_todos directly — no need to create a full task.
- Parse natural language dates ("tomorrow", "next Friday", "in 3 days") into ISO dates (YYYY-MM-DD).
- When listing todos, prefer get_todos_summary with status and due_within_days filters.
  Examples: "what's due this week" → get_todos_summary({ status: "pending", due_within_days: 7 })
- Use raw get_todos only when you need to search by ID.
- To complete a todo, call complete_todo. To clear all, call clear_todos.

═══ CALENDAR RULES ═══
- Parse natural language into structured calendar data before calling tools:
  "gym tomorrow at 7pm" → title: "Gym", start: tomorrow 19:00, end: tomorrow 20:00
- If no end time given, default to 1 hour after start. If no date given, assume today.
- ALWAYS pass timezone="${TIMEZONE}" when calling create_calendar_event.
- For task-related events: use propose_action (type: "calendar_event") instead of calling create_calendar_event directly.
- For quick standalone events (not part of a task): you may call create_calendar_event directly.
- Prefer get_calendar_summary for schedule queries. Use list_calendar_events only when you need event IDs.
- Call find_free_slots to check availability.

═══ MULTI-TASK REQUESTS ═══
- If the user asks for multiple things in one message, handle ALL of them in a single turn.
- Never skip part of a multi-part request.

═══ GENERAL ═══
- You may respond with text only when asking clarifying questions or relaying information.
- Format output clearly with markdown: numbered lists, bold headers, emojis for status.`,
});

export const supervisorApp = makeSupervisor({
  agents: [math, writer, plannerAgent],
  llm,
  outputMode: "last_message",
  supervisorName: "supervisor",
  prompt:
    "You are a routing supervisor. Your job is to delegate tasks to the right agent — NEVER answer directly.\n\n" +
    "Routing rules:\n" +
    "- Todos, calendar, scheduling, planning, organizing, task lists, projects, appointments, availability, reminders → delegate to planner_agent\n" +
    "- Math calculations → delegate to math_expert\n" +
    "- Writing or summarizing text → delegate to writer\n" +
    "- If unsure, default to planner_agent\n\n" +
    "IMPORTANT: Do NOT answer the user yourself. Always hand off to an agent.\n" +
    "When relaying the agent's response back to the user, include the agent's full formatted output — do NOT summarize or paraphrase it.",
});
