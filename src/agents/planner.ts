import type { ChatOpenAI } from "@langchain/openai";
import { makeAgent } from "../core/agent-factory";
import { buildPlannerPrompt } from "../capabilities/tasks/prompt";

// Task tools
import {
  create_task, get_tasks, get_task_detail, update_task,
  add_subtasks_tool, complete_subtask_tool,
  propose_action, confirm_action, reject_action,
  add_follow_ups, complete_follow_up, skip_follow_up,
  setActionRegistry,
} from "../capabilities/tasks/tools";

// Todo tools
import {
  add_todos, get_todos, get_todos_summary, complete_todo, clear_todos,
} from "../capabilities/todos/tools";

// Calendar tools
import {
  create_calendar_event, list_calendar_events,
  delete_calendar_event, find_free_slots, get_calendar_summary,
} from "../capabilities/calendar/tools";

// Wire the action registry so tasks can execute calendar/todo actions
// without importing those capabilities directly
setActionRegistry({
  calendar_event: async (params) => {
    const raw = await create_calendar_event.invoke(params as any);
    return typeof raw === "string" ? raw : String(raw.content);
  },
  todo: async (params) => {
    const raw = await add_todos.invoke(params as any);
    return typeof raw === "string" ? raw : String(raw.content);
  },
});

export function createPlannerAgent(llm: ChatOpenAI) {
  return makeAgent({
    name: "planner_agent",
    llm,
    tools: [
      // Task management
      create_task, get_tasks, get_task_detail, update_task,
      add_subtasks_tool, complete_subtask_tool,
      propose_action, confirm_action, reject_action,
      add_follow_ups, complete_follow_up, skip_follow_up,
      // Quick todos
      add_todos, get_todos, get_todos_summary, complete_todo, clear_todos,
      // Calendar
      create_calendar_event, list_calendar_events,
      delete_calendar_event, find_free_slots, get_calendar_summary,
    ],
    system: buildPlannerPrompt(),
  });
}
