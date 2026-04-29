/**
 * Unit tests for the task store (capabilities/tasks/store.ts).
 *
 * Tests CRUD operations, subtask completion, proposed actions, follow-ups,
 * and auto-status transitions — all without hitting an LLM.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  readTasks,
  writeTasks,
  createTask,
  getTask,
  updateTask,
  addSubtasks,
  completeSubtask,
  addProposedAction,
  resolveAction,
  linkTodoToTask,
  linkEventToTask,
  addFollowUps,
  resolveFollowUp,
} from "../capabilities/tasks/store";

beforeEach(() => {
  writeTasks([]);
});

describe("Task Store — CRUD", () => {
  it("creates a task in 'ready' status when no missing_info", () => {
    const task = createTask({ title: "Test", goal: "Do the thing" });
    expect(task.title).toBe("Test");
    expect(task.status).toBe("ready");
    expect(task.missing_info).toEqual([]);
    expect(readTasks()).toHaveLength(1);
  });

  it("creates a task in 'draft' status when missing_info is provided", () => {
    const task = createTask({
      title: "Draft task",
      goal: "Needs info",
      missing_info: ["date", "budget"],
    });
    expect(task.status).toBe("draft");
    expect(task.missing_info).toEqual(["date", "budget"]);
  });

  it("creates subtasks with unique IDs", () => {
    const task = createTask({
      title: "With subs",
      goal: "G",
      subtasks: [{ text: "Step 1" }, { text: "Step 2" }],
    });
    expect(task.subtasks).toHaveLength(2);
    expect(task.subtasks[0].id).not.toBe(task.subtasks[1].id);
    expect(task.subtasks.every((s) => !s.done)).toBe(true);
  });

  it("getTask returns undefined for non-existent ID", () => {
    expect(getTask("nonexistent")).toBeUndefined();
  });

  it("updateTask modifies fields and updates timestamp", () => {
    const task = createTask({ title: "Old", goal: "G" });
    const updated = updateTask(task.id, { title: "New", status: "in_progress" });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("New");
    expect(updated!.status).toBe("in_progress");
    expect(updated!.updated_at).not.toBe(task.updated_at);
  });

  it("updateTask returns null for non-existent task", () => {
    expect(updateTask("nope", { title: "X" })).toBeNull();
  });
});

describe("Task Store — Subtasks", () => {
  it("addSubtasks appends to existing subtasks", () => {
    const task = createTask({ title: "T", goal: "G", subtasks: [{ text: "A" }] });
    const updated = addSubtasks(task.id, [{ text: "B" }, { text: "C" }]);
    expect(updated!.subtasks).toHaveLength(3);
  });

  it("completeSubtask marks a subtask done", () => {
    const task = createTask({ title: "T", goal: "G", subtasks: [{ text: "A" }, { text: "B" }] });
    const updated = completeSubtask(task.id, task.subtasks[0].id);
    expect(updated!.subtasks[0].done).toBe(true);
    expect(updated!.subtasks[1].done).toBe(false);
    expect(updated!.status).not.toBe("done");
  });

  it("auto-transitions task to 'done' when all subtasks completed", () => {
    const task = createTask({ title: "T", goal: "G", subtasks: [{ text: "A" }, { text: "B" }] });
    completeSubtask(task.id, task.subtasks[0].id);
    const updated = completeSubtask(task.id, task.subtasks[1].id);
    expect(updated!.status).toBe("done");
  });

  it("completeSubtask returns null for invalid IDs", () => {
    expect(completeSubtask("bad-task", "bad-sub")).toBeNull();
    const task = createTask({ title: "T", goal: "G", subtasks: [{ text: "A" }] });
    expect(completeSubtask(task.id, "bad-sub")).toBeNull();
  });
});

describe("Task Store — Proposed Actions", () => {
  it("adds a proposed action with 'pending' status", () => {
    const task = createTask({ title: "T", goal: "G" });
    const action = addProposedAction(task.id, {
      type: "calendar_event",
      description: "Book venue",
      params: { title: "Venue booking" },
    });
    expect(action).not.toBeNull();
    expect(action!.status).toBe("pending");
    expect(getTask(task.id)!.proposed_actions).toHaveLength(1);
  });

  it("resolveAction marks action as approved or rejected", () => {
    const task = createTask({ title: "T", goal: "G" });
    const action = addProposedAction(task.id, { type: "todo", description: "D", params: {} });
    const result = resolveAction(task.id, action!.id, "rejected");
    expect(result!.action.status).toBe("rejected");
  });
});

describe("Task Store — Follow-ups", () => {
  it("adds expected follow-ups to a task", () => {
    const task = createTask({ title: "T", goal: "G" });
    const updated = addFollowUps(task.id, [
      { prompt: "Confirm venue", timing: "by Friday" },
      { prompt: "Send invites" },
    ]);
    expect(updated!.expected_follow_ups).toHaveLength(2);
    expect(updated!.expected_follow_ups[0].status).toBe("pending");
    expect(updated!.expected_follow_ups[0].timing).toBe("by Friday");
    expect(updated!.expected_follow_ups[1].timing).toBeUndefined();
  });

  it("resolveFollowUp marks as completed", () => {
    const task = createTask({ title: "T", goal: "G" });
    const withFollowUp = addFollowUps(task.id, [{ prompt: "Check budget" }]);
    const fId = withFollowUp!.expected_follow_ups[0].id;
    const updated = resolveFollowUp(task.id, fId, "completed");
    expect(updated!.expected_follow_ups[0].status).toBe("completed");
  });

  it("resolveFollowUp marks as skipped", () => {
    const task = createTask({ title: "T", goal: "G" });
    const withFollowUp = addFollowUps(task.id, [{ prompt: "Optional step" }]);
    const fId = withFollowUp!.expected_follow_ups[0].id;
    const updated = resolveFollowUp(task.id, fId, "skipped");
    expect(updated!.expected_follow_ups[0].status).toBe("skipped");
  });

  it("returns null for invalid task or follow-up ID", () => {
    expect(resolveFollowUp("bad", "bad", "completed")).toBeNull();
    const task = createTask({ title: "T", goal: "G" });
    expect(resolveFollowUp(task.id, "bad-follow-up", "completed")).toBeNull();
  });
});

describe("Task Store — Linking", () => {
  it("links a todo ID to a task (deduplicates)", () => {
    const task = createTask({ title: "T", goal: "G" });
    linkTodoToTask(task.id, "todo-1");
    linkTodoToTask(task.id, "todo-1"); // duplicate
    linkTodoToTask(task.id, "todo-2");
    expect(getTask(task.id)!.linked_todo_ids).toEqual(["todo-1", "todo-2"]);
  });

  it("links an event ID to a task (deduplicates)", () => {
    const task = createTask({ title: "T", goal: "G" });
    linkEventToTask(task.id, "evt-1");
    linkEventToTask(task.id, "evt-1");
    expect(getTask(task.id)!.linked_event_ids).toEqual(["evt-1"]);
  });
});
