import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { v4 as uuid } from "uuid";

// ── Interfaces ──────────────────────────────────────────────

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface ProposedAction {
  id: string;
  type: "calendar_event" | "todo" | "other";
  description: string;
  params: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
}

export interface FollowUp {
  id: string;
  prompt: string;
  timing?: string;
  status: "pending" | "completed" | "skipped";
}

export type TaskStatus = "draft" | "ready" | "in_progress" | "blocked" | "done";

export interface Task {
  id: string;
  title: string;
  goal: string;
  status: TaskStatus;
  subtasks: Subtask[];
  missing_info: string[];
  context: string;
  proposed_actions: ProposedAction[];
  expected_follow_ups: FollowUp[];
  linked_todo_ids: string[];
  linked_event_ids: string[];
  created_at: string;
  updated_at: string;
}

// ── Persistence ─────────────────────────────────────────────

const TASKS_FILE = join(process.cwd(), "tasks.json");

export function readTasks(): Task[] {
  if (!existsSync(TASKS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(TASKS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function writeTasks(tasks: Task[]): void {
  writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  console.log(`[tasks] wrote ${tasks.length} items to ${TASKS_FILE}`);
}

// ── CRUD helpers ────────────────────────────────────────────

export function getTask(id: string): Task | undefined {
  return readTasks().find((t) => t.id === id);
}

export function createTask(fields: {
  title: string;
  goal: string;
  subtasks?: { text: string }[];
  missing_info?: string[];
}): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: uuid(),
    title: fields.title,
    goal: fields.goal,
    status: fields.missing_info?.length ? "draft" : "ready",
    subtasks: (fields.subtasks ?? []).map((s) => ({ id: uuid(), text: s.text, done: false })),
    missing_info: fields.missing_info ?? [],
    context: "",
    proposed_actions: [],
    expected_follow_ups: [],
    linked_todo_ids: [],
    linked_event_ids: [],
    created_at: now,
    updated_at: now,
  };
  const tasks = readTasks();
  tasks.push(task);
  writeTasks(tasks);
  console.log(`[tasks] created task ${task.id}: ${task.title}`);
  return task;
}

export function updateTask(
  id: string,
  updates: Partial<Pick<Task, "title" | "goal" | "status" | "context" | "missing_info">>,
): Task | null {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  Object.assign(task, updates, { updated_at: new Date().toISOString() });
  writeTasks(tasks);
  console.log(`[tasks] updated task ${task.id}`);
  return task;
}

export function addSubtasks(taskId: string, subtasks: { text: string }[]): Task | null {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  for (const s of subtasks) {
    task.subtasks.push({ id: uuid(), text: s.text, done: false });
  }
  task.updated_at = new Date().toISOString();
  writeTasks(tasks);
  return task;
}

export function completeSubtask(taskId: string, subtaskId: string): Task | null {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const sub = task.subtasks.find((s) => s.id === subtaskId);
  if (!sub) return null;
  sub.done = true;
  if (task.subtasks.length > 0 && task.subtasks.every((s) => s.done)) {
    task.status = "done";
  }
  task.updated_at = new Date().toISOString();
  writeTasks(tasks);
  console.log(`[tasks] completed subtask ${subtaskId} on task ${taskId}`);
  return task;
}

export function addProposedAction(
  taskId: string,
  action: Omit<ProposedAction, "id" | "status">,
): ProposedAction | null {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const proposed: ProposedAction = { ...action, id: uuid(), status: "pending" };
  task.proposed_actions.push(proposed);
  task.updated_at = new Date().toISOString();
  writeTasks(tasks);
  console.log(`[tasks] proposed action ${proposed.id} on task ${taskId}: ${proposed.description}`);
  return proposed;
}

export function resolveAction(
  taskId: string,
  actionId: string,
  resolution: "approved" | "rejected",
): { task: Task; action: ProposedAction } | null {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const action = task.proposed_actions.find((a) => a.id === actionId);
  if (!action) return null;
  action.status = resolution;
  task.updated_at = new Date().toISOString();
  writeTasks(tasks);
  console.log(`[tasks] action ${actionId} ${resolution} on task ${taskId}`);
  return { task, action };
}

export function linkTodoToTask(taskId: string, todoId: string): void {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  if (!task.linked_todo_ids.includes(todoId)) {
    task.linked_todo_ids.push(todoId);
    task.updated_at = new Date().toISOString();
    writeTasks(tasks);
  }
}

export function linkEventToTask(taskId: string, eventId: string): void {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  if (!task.linked_event_ids.includes(eventId)) {
    task.linked_event_ids.push(eventId);
    task.updated_at = new Date().toISOString();
    writeTasks(tasks);
  }
}

// ── Follow-up helpers ───────────────────────────────────────

export function addFollowUps(
  taskId: string,
  followUps: { prompt: string; timing?: string }[],
): Task | null {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  for (const f of followUps) {
    task.expected_follow_ups.push({
      id: uuid(),
      prompt: f.prompt,
      timing: f.timing,
      status: "pending",
    });
  }
  task.updated_at = new Date().toISOString();
  writeTasks(tasks);
  return task;
}

export function resolveFollowUp(
  taskId: string,
  followUpId: string,
  resolution: "completed" | "skipped",
): Task | null {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const followUp = task.expected_follow_ups.find((f) => f.id === followUpId);
  if (!followUp) return null;
  followUp.status = resolution;
  task.updated_at = new Date().toISOString();
  writeTasks(tasks);
  console.log(`[tasks] follow-up ${followUpId} ${resolution} on task ${taskId}`);
  return task;
}
