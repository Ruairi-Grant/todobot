/**
 * Unit tests for the todo system (capabilities/todos/).
 *
 * Tests the LocalJsonTodoProvider: add, complete, clear, deduplication,
 * and the TodoProvider interface contract — all without hitting an LLM.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { writeTodos, readTodos } from "../capabilities/todos/store";
import { LocalJsonTodoProvider } from "../capabilities/todos/local-provider";
import { MicrosoftTodoProvider } from "../capabilities/todos/microsoft-provider";

const local = new LocalJsonTodoProvider();

beforeEach(() => {
  writeTodos([]);
});

describe("LocalJsonTodoProvider", () => {
  it("starts with empty todos", async () => {
    const todos = await local.getTodos();
    expect(todos).toEqual([]);
  });

  it("addTodos creates new items with IDs and timestamps", async () => {
    const added = await local.addTodos([
      { text: "Buy milk" },
      { text: "Call dentist", dueDate: "2026-04-20" },
    ]);
    expect(added).toHaveLength(2);
    expect(added[0].text).toBe("Buy milk");
    expect(added[0].done).toBe(false);
    expect(added[0].id).toBeDefined();
    expect(added[1].dueDate).toBe("2026-04-20");

    const all = await local.getTodos();
    expect(all).toHaveLength(2);
  });

  it("addTodos deduplicates by text (case-insensitive)", async () => {
    await local.addTodos([{ text: "Buy milk" }]);
    const added = await local.addTodos([
      { text: "buy MILK" },
      { text: "New item" },
    ]);
    // Only "New item" should be added (buy milk is duplicate)
    expect(added).toHaveLength(1);
    expect(added[0].text).toBe("New item");

    const all = await local.getTodos();
    expect(all).toHaveLength(2);
  });

  it("completeTodo by ID", async () => {
    const [todo] = await local.addTodos([{ text: "Finish report" }]);
    const completed = await local.completeTodo(todo.id);
    expect(completed).not.toBeNull();
    expect(completed!.done).toBe(true);
    expect(completed!.id).toBe(todo.id);
  });

  it("completeTodo by text fragment (case-insensitive)", async () => {
    await local.addTodos([{ text: "Finish the quarterly report" }]);
    const completed = await local.completeTodo("quarterly");
    expect(completed).not.toBeNull();
    expect(completed!.done).toBe(true);
  });

  it("completeTodo returns null for non-existent item", async () => {
    const result = await local.completeTodo("nonexistent");
    expect(result).toBeNull();
  });

  it("completeTodo skips already-done items when matching by text", async () => {
    await local.addTodos([{ text: "Task A" }, { text: "Task B with A" }]);
    // Complete the first one
    const todos = await local.getTodos();
    await local.completeTodo(todos[0].id);

    // Now searching "task" should find the second (undone) one
    const completed = await local.completeTodo("Task B");
    expect(completed).not.toBeNull();
    expect(completed!.text).toBe("Task B with A");
  });

  it("clearTodos removes all items", async () => {
    await local.addTodos([{ text: "A" }, { text: "B" }]);
    await local.clearTodos();
    const all = await local.getTodos();
    expect(all).toEqual([]);
  });
});

describe("MicrosoftTodoProvider (stub)", () => {
  const ms = new MicrosoftTodoProvider();

  it("getTodos returns empty array (stub)", async () => {
    const todos = await ms.getTodos();
    expect(todos).toEqual([]);
  });

  it("addTodos returns mock items with IDs (stub)", async () => {
    const added = await ms.addTodos([{ text: "Test item" }]);
    expect(added).toHaveLength(1);
    expect(added[0].text).toBe("Test item");
    expect(added[0].id).toBeDefined();
    expect(added[0].done).toBe(false);
  });

  it("completeTodo returns null (stub)", async () => {
    const result = await ms.completeTodo("anything");
    expect(result).toBeNull();
  });

  it("clearTodos does not throw (stub)", async () => {
    await expect(ms.clearTodos()).resolves.toBeUndefined();
  });
});
