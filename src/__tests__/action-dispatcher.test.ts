/**
 * Unit tests for the action dispatcher (capabilities/tasks/actions.ts).
 *
 * Tests that the action registry pattern correctly routes actions
 * to the right executor and links results back to tasks.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { writeTasks, createTask, getTask } from "../capabilities/tasks/store";
import { executeAction, type ActionRegistry } from "../capabilities/tasks/actions";

beforeEach(() => {
  writeTasks([]);
});

describe("Action Dispatcher", () => {
  it("executes a calendar_event action and links the event ID", async () => {
    const task = createTask({ title: "Party", goal: "Plan party" });
    const registry: ActionRegistry = {
      calendar_event: async () => JSON.stringify({ id: "evt-123", title: "Party" }),
    };

    const result = await executeAction(
      task.id,
      { type: "calendar_event", params: { title: "Party" } },
      registry,
    );

    const parsed = JSON.parse(result);
    expect(parsed.id).toBe("evt-123");

    const updated = getTask(task.id)!;
    expect(updated.linked_event_ids).toContain("evt-123");
  });

  it("executes a todo action and links the todo IDs", async () => {
    const task = createTask({ title: "Shopping", goal: "Buy things" });
    const registry: ActionRegistry = {
      todo: async () => JSON.stringify([{ id: "todo-1" }, { id: "todo-2" }]),
    };

    await executeAction(
      task.id,
      { type: "todo", params: { todos: [{ text: "Milk" }, { text: "Bread" }] } },
      registry,
    );

    const updated = getTask(task.id)!;
    expect(updated.linked_todo_ids).toContain("todo-1");
    expect(updated.linked_todo_ids).toContain("todo-2");
  });

  it("returns error for unknown action type", async () => {
    const task = createTask({ title: "T", goal: "G" });
    const result = await executeAction(
      task.id,
      { type: "email", params: {} },
      {},
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("Unknown action type");
  });

  it("handles non-JSON results gracefully (no linking crash)", async () => {
    const task = createTask({ title: "T", goal: "G" });
    const registry: ActionRegistry = {
      calendar_event: async () => "Event created successfully",
    };

    const result = await executeAction(
      task.id,
      { type: "calendar_event", params: {} },
      registry,
    );

    expect(result).toBe("Event created successfully");
    // No crash, and no linking (since result isn't JSON with id)
    expect(getTask(task.id)!.linked_event_ids).toEqual([]);
  });
});
