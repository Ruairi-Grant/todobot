import { linkEventToTask, linkTodoToTask } from "./store";

export type ActionExecutor = (params: Record<string, unknown>) => Promise<string>;

export type ActionRegistry = Record<string, ActionExecutor>;

export async function executeAction(
  taskId: string,
  action: { type: string; params: Record<string, unknown> },
  registry: ActionRegistry,
): Promise<string> {
  const executor = registry[action.type];
  if (!executor) {
    return JSON.stringify({
      error: `Unknown action type "${action.type}". Cannot auto-execute.`,
      action,
    });
  }

  const result = await executor(action.params);

  // Link results back to the task based on type
  try {
    const parsed = JSON.parse(result);
    if (action.type === "calendar_event" && parsed.id) {
      linkEventToTask(taskId, parsed.id);
    } else if (action.type === "todo" && Array.isArray(parsed)) {
      for (const t of parsed) {
        if (t.id) linkTodoToTask(taskId, t.id);
      }
    }
  } catch {
    // result may not be JSON — that's fine
  }

  return result;
}
