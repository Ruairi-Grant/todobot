import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
  readTasks,
  getTask,
  createTask,
  updateTask as updateTaskData,
  addSubtasks,
  completeSubtask,
  addProposedAction,
  resolveAction,
  linkEventToTask,
  linkTodoToTask,
  type Task,
  type TaskStatus,
} from "./tasks";
import { create_calendar_event } from "./calendar/tools";
import { add_todos } from "./tools";
// TODO: this is somewhere that mixes propmts with code, not sure if this is great for extensibility
// seperation between this and todos and tasks is not clear
// or maybe just move this to a dir for just tools, and have a renames tools.ts beside it

// ── create_task ─────────────────────────────────────────────
export const create_task = tool(
  async (input) => {
    const task = createTask({
      title: input.title,
      goal: input.goal,
      subtasks: input.subtasks,
      missing_info: input.missing_info,
    });
    return JSON.stringify(task);
  },
  {
    name: "create_task",
    description:
      "Create a new task from a user goal. Break the goal into subtasks and identify any missing information needed before the task is actionable. " +
      'If missing_info is provided, the task starts as "draft"; otherwise it starts as "ready".',
    schema: z.object({
      title: z.string().min(1).describe("Short task title"),
      goal: z.string().min(1).describe("What the user wants to achieve"),
      subtasks: z
        .array(z.object({ text: z.string().min(1).describe("Subtask description") }))
        .optional()
        .describe("Actionable steps to complete this task"),
      missing_info: z
        .array(z.string())
        .optional()
        .describe("Information still needed from the user before this task can proceed"),
    }),
  }
);

// ── get_tasks ───────────────────────────────────────────────
export const get_tasks = tool(
  async (input) => {
    let tasks = readTasks();

    if (input.status && input.status !== "all") {
      tasks = tasks.filter((t) => t.status === input.status);
    }

    if (tasks.length === 0) return "No matching tasks found.";

    const statusIcon: Record<TaskStatus, string> = {
      draft: "📝",
      ready: "🟢",
      in_progress: "🔄",
      blocked: "🚫",
      done: "✅",
    };

    const lines = tasks.map((t, i) => {
      const icon = statusIcon[t.status];
      const subtaskProgress =
        t.subtasks.length > 0
          ? ` [${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}]`
          : "";
      const pending = t.proposed_actions.filter((a) => a.status === "pending").length;
      const pendingTag = pending > 0 ? ` ⚡${pending} pending action(s)` : "";
      const missingTag = t.missing_info.length > 0 ? ` ❓needs info` : "";
      return `${i + 1}. ${icon} **${t.title}**${subtaskProgress}${pendingTag}${missingTag}\n   _${t.goal}_\n   ID: \`${t.id}\``;
    });

    return [`**${tasks.length} task(s):**`, "", ...lines].join("\n");
  },
  {
    name: "get_tasks",
    description:
      "List tasks filtered by status. Returns formatted markdown. Use this for user-facing task queries. " +
      'Pass status="all" or omit for all tasks.',
    schema: z.object({
      status: z
        .enum(["all", "draft", "ready", "in_progress", "blocked", "done"])
        .optional()
        .describe("Filter by task status. Defaults to all."),
    }),
  }
);

// ── get_task_detail ─────────────────────────────────────────
export const get_task_detail = tool(
  async (input) => {
    const task = getTask(input.task_id);
    if (!task) return JSON.stringify({ error: "Task not found" });

    const statusIcon: Record<TaskStatus, string> = {
      draft: "📝",
      ready: "🟢",
      in_progress: "🔄",
      blocked: "🚫",
      done: "✅",
    };

    const lines: string[] = [
      `## ${statusIcon[task.status]} ${task.title}`,
      `**Goal:** ${task.goal}`,
      `**Status:** ${task.status}`,
      "",
    ];

    if (task.subtasks.length > 0) {
      lines.push("**Subtasks:**");
      for (const s of task.subtasks) {
        lines.push(`  ${s.done ? "✅" : "⬜"} ${s.text} (\`${s.id}\`)`);
      }
      lines.push("");
    }

    if (task.missing_info.length > 0) {
      lines.push("**Missing info:**");
      for (const m of task.missing_info) {
        lines.push(`  ❓ ${m}`);
      }
      lines.push("");
    }

    const pendingActions = task.proposed_actions.filter((a) => a.status === "pending");
    if (pendingActions.length > 0) {
      lines.push("**Pending actions (awaiting approval):**");
      for (const a of pendingActions) {
        lines.push(`  ⚡ ${a.description} [${a.type}] (\`${a.id}\`)`);
      }
      lines.push("");
    }

    if (task.context) {
      lines.push(`**Context:** ${task.context}`);
      lines.push("");
    }

    lines.push(`_Created: ${task.created_at} | Updated: ${task.updated_at}_`);
    return lines.join("\n");
  },
  {
    name: "get_task_detail",
    description:
      "Get full details of a single task including subtasks, missing info, proposed actions, and linked items.",
    schema: z.object({
      task_id: z.string().describe("The task ID"),
    }),
  }
);

// ── update_task ─────────────────────────────────────────────
export const update_task = tool(
  async (input) => {
    const updates: Record<string, unknown> = {};
    if (input.title) updates.title = input.title;
    if (input.goal) updates.goal = input.goal;
    if (input.status) updates.status = input.status;
    if (input.context) updates.context = input.context;
    if (input.missing_info) updates.missing_info = input.missing_info;

    const task = updateTaskData(input.task_id, updates);
    if (!task) return JSON.stringify({ error: "Task not found" });
    return JSON.stringify(task);
  },
  {
    name: "update_task",
    description:
      "Update fields on an existing task. Use this to change status, add context/notes, update missing_info, or modify title/goal.",
    schema: z.object({
      task_id: z.string().describe("The task ID to update"),
      title: z.string().optional().describe("New title"),
      goal: z.string().optional().describe("Updated goal"),
      status: z
        .enum(["draft", "ready", "in_progress", "blocked", "done"])
        .optional()
        .describe("New status"),
      context: z.string().optional().describe("Notes or context to set on the task"),
      missing_info: z
        .array(z.string())
        .optional()
        .describe("Updated list of missing information (replaces existing)"),
    }),
  }
);

// ── add_subtasks ────────────────────────────────────────────
export const add_subtasks_tool = tool(
  async (input) => {
    const task = addSubtasks(input.task_id, input.subtasks);
    if (!task) return JSON.stringify({ error: "Task not found" });
    return JSON.stringify(task.subtasks);
  },
  {
    name: "add_subtasks",
    description: "Add new subtasks to an existing task.",
    schema: z.object({
      task_id: z.string().describe("The task ID"),
      subtasks: z
        .array(z.object({ text: z.string().min(1).describe("Subtask description") }))
        .min(1)
        .describe("Subtasks to add"),
    }),
  }
);

// ── complete_subtask ────────────────────────────────────────
export const complete_subtask_tool = tool(
  async (input) => {
    const task = completeSubtask(input.task_id, input.subtask_id);
    if (!task) return JSON.stringify({ error: "Task or subtask not found" });

    const done = task.subtasks.filter((s) => s.done).length;
    const total = task.subtasks.length;
    const result: Record<string, unknown> = {
      subtask_completed: input.subtask_id,
      progress: `${done}/${total}`,
      task_status: task.status,
    };
    if (task.status === "done") {
      result.message = "All subtasks done — task automatically marked as done!";
    }
    return JSON.stringify(result);
  },
  {
    name: "complete_subtask",
    description:
      "Mark a subtask as completed. If all subtasks are done, the task is automatically marked as done.",
    schema: z.object({
      task_id: z.string().describe("The task ID"),
      subtask_id: z.string().describe("The subtask ID to complete"),
    }),
  }
);

// ── propose_action ──────────────────────────────────────────
export const propose_action = tool(
  async (input) => {
    const proposed = addProposedAction(input.task_id, {
      type: input.action_type,
      description: input.description,
      params: input.params,
    });
    if (!proposed) return JSON.stringify({ error: "Task not found" });
    return JSON.stringify({
      proposed_action_id: proposed.id,
      description: proposed.description,
      message:
        "Action proposed — ask the user to confirm before executing. " +
        `Say something like: "I'd like to ${proposed.description}. Shall I go ahead?"`,
    });
  },
  {
    name: "propose_action",
    description:
      "Propose a side-effect action (calendar event, todo creation, etc.) that requires user confirmation before execution. " +
      "Use this instead of directly calling create_calendar_event or add_todos when the action is part of a task. " +
      "The action will be stored as pending on the task until the user approves or rejects it.",
    schema: z.object({
      task_id: z.string().describe("The task this action belongs to"),
      action_type: z
        .enum(["calendar_event", "todo", "other"])
        .describe("Type of action to propose"),
      description: z
        .string()
        .describe('Human-readable description of what will happen (e.g. "Create calendar event: Team meeting on Friday 2-3pm")'),
      params: z
        .record(z.unknown())
        .describe(
          "Parameters for the action. For calendar_event: { title, start_time, end_time, timezone?, ... }. For todo: { todos: [{ text, dueDate? }] }."
        ),
    }),
  }
);

// ── confirm_action ──────────────────────────────────────────
export const confirm_action = tool(
  async (input) => {
    const task = getTask(input.task_id);
    if (!task) return JSON.stringify({ error: "Task not found" });

    const action = task.proposed_actions.find((a) => a.id === input.action_id);
    if (!action) return JSON.stringify({ error: "Action not found" });
    if (action.status !== "pending") {
      return JSON.stringify({ error: `Action already ${action.status}` });
    }

    // Execute the actual tool based on action type
    let result: string;
    try {
      if (action.type === "calendar_event") {
        const rawResult = await create_calendar_event.invoke(action.params as any);
        result = typeof rawResult === "string" ? rawResult : String(rawResult.content);
        // Try to extract event ID and link it
        try {
          const parsed = JSON.parse(result);
          if (parsed.id) linkEventToTask(input.task_id, parsed.id);
        } catch { /* result may not be JSON */ }
      } else if (action.type === "todo") {
        const rawResult = await add_todos.invoke(action.params as any);
        result = typeof rawResult === "string" ? rawResult : String(rawResult.content);
        // Try to link created todo IDs
        try {
          const parsed = JSON.parse(result);
          if (Array.isArray(parsed)) {
            for (const t of parsed) {
              if (t.id) linkTodoToTask(input.task_id, t.id);
            }
          }
        } catch { /* result may not be JSON */ }
      } else {
        return JSON.stringify({
          error: "Unknown action type. Cannot auto-execute.",
          action,
        });
      }
    } catch (err: unknown) {
      return JSON.stringify({
        error: "Failed to execute action",
        details: err instanceof Error ? err.message : String(err),
      });
    }

    // Mark as approved
    resolveAction(input.task_id, input.action_id, "approved");

    return JSON.stringify({
      executed: true,
      action_type: action.type,
      result,
    });
  },
  {
    name: "confirm_action",
    description:
      "Execute a previously proposed action after user confirmation. " +
      "This will call the appropriate tool (create_calendar_event, add_todos, etc.) with the stored parameters and link the result back to the task.",
    schema: z.object({
      task_id: z.string().describe("The task ID"),
      action_id: z.string().describe("The proposed action ID to execute"),
    }),
  }
);

// ── reject_action ───────────────────────────────────────────
export const reject_action = tool(
  async (input) => {
    const result = resolveAction(input.task_id, input.action_id, "rejected");
    if (!result) return JSON.stringify({ error: "Task or action not found" });
    return JSON.stringify({ rejected: true, action_id: input.action_id });
  },
  {
    name: "reject_action",
    description: "Reject a previously proposed action. The action will not be executed.",
    schema: z.object({
      task_id: z.string().describe("The task ID"),
      action_id: z.string().describe("The proposed action ID to reject"),
    }),
  }
);
