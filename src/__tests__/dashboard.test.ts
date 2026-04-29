/**
 * Unit tests for the HTML dashboard (entrypoints/dashboard.ts).
 *
 * Tests that the dashboard renders tasks and todos correctly,
 * handles empty states, and escapes HTML to prevent XSS.
 */
import { describe, it, expect } from "vitest";
import { buildDashboardHtml } from "../entrypoints/dashboard";
import type { Task } from "../capabilities/tasks/store";
import type { Todo } from "../capabilities/todos/store";

const now = new Date().toISOString();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test Task",
    goal: "Do the thing",
    status: "ready",
    subtasks: [],
    missing_info: [],
    context: "",
    proposed_actions: [],
    expected_follow_ups: [],
    linked_todo_ids: [],
    linked_event_ids: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "todo-1",
    text: "Buy milk",
    done: false,
    createdAt: now,
    ...overrides,
  };
}

describe("Dashboard HTML", () => {
  it("renders empty state when no tasks or todos", () => {
    const html = buildDashboardHtml([], []);
    expect(html).toContain("TODObot Dashboard");
    expect(html).toContain("0 task(s)");
    expect(html).toContain("0 todo(s)");
    expect(html).toContain("No tasks yet");
  });

  it("renders task cards with correct status badges", () => {
    const tasks = [
      makeTask({ status: "in_progress", title: "Active Task" }),
      makeTask({ id: "task-2", status: "done", title: "Done Task" }),
    ];
    const html = buildDashboardHtml(tasks, []);
    expect(html).toContain("Active Task");
    expect(html).toContain("Done Task");
    expect(html).toContain("status-in_progress");
    expect(html).toContain("status-done");
  });

  it("renders subtasks with progress", () => {
    const task = makeTask({
      subtasks: [
        { id: "s1", text: "Step 1", done: true },
        { id: "s2", text: "Step 2", done: false },
      ],
    });
    const html = buildDashboardHtml([task], []);
    expect(html).toContain("Subtasks (1/2)");
    expect(html).toContain("Step 1");
    expect(html).toContain("Step 2");
  });

  it("renders expected follow-ups", () => {
    const task = makeTask({
      expected_follow_ups: [
        { id: "f1", prompt: "Confirm venue", timing: "by Friday", status: "pending" },
        { id: "f2", prompt: "Already done", status: "completed" },
      ],
    });
    const html = buildDashboardHtml([task], []);
    expect(html).toContain("Confirm venue");
    expect(html).toContain("by Friday");
    // Completed follow-ups should NOT appear (only pending shown)
    expect(html).not.toContain("Already done");
  });

  it("renders pending and completed todos separately", () => {
    const todos = [
      makeTodo({ text: "Pending item", done: false }),
      makeTodo({ id: "todo-2", text: "Done item", done: true }),
    ];
    const html = buildDashboardHtml([], todos);
    expect(html).toContain("Pending item");
    expect(html).toContain("Done item");
    expect(html).toContain("Pending (1)");
    expect(html).toContain("Completed (1)");
  });

  it("escapes HTML in task titles to prevent XSS", () => {
    const task = makeTask({ title: '<script>alert("xss")</script>' });
    const html = buildDashboardHtml([task], []);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in todo text", () => {
    const todo = makeTodo({ text: '<img src=x onerror=alert(1)>' });
    const html = buildDashboardHtml([], [todo]);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("includes auto-refresh meta tag", () => {
    const html = buildDashboardHtml([], []);
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('content="30"');
  });
});
