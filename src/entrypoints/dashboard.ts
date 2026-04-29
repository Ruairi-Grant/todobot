import type { Task } from "../capabilities/tasks/store";
import type { Todo } from "../capabilities/todos/store";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDashboardHtml(tasks: Task[], todos: Todo[]): string {
  const statusOrder: Record<string, number> = {
    in_progress: 0, ready: 1, draft: 2, blocked: 3, done: 4,
  };
  const sortedTasks = [...tasks].sort(
    (a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
  );

  const statusIcon: Record<string, string> = {
    draft: "📝", ready: "🟢", in_progress: "🔄", blocked: "🚫", done: "✅",
  };

  const pendingTodos = todos.filter((t) => !t.done);
  const completedTodos = todos.filter((t) => t.done);

  const taskCards = sortedTasks.map((task) => {
    const subtaskHtml = task.subtasks.length > 0
      ? `<div class="subtasks">
          <strong>Subtasks (${task.subtasks.filter(s => s.done).length}/${task.subtasks.length}):</strong>
          <ul>${task.subtasks.map(s =>
            `<li class="${s.done ? 'done' : ''}">${s.done ? '✅' : '⬜'} ${escapeHtml(s.text)}</li>`
          ).join('')}</ul>
        </div>`
      : '';

    const missingHtml = task.missing_info.length > 0
      ? `<div class="missing"><strong>Missing info:</strong><ul>${task.missing_info.map(m =>
          `<li>❓ ${escapeHtml(m)}</li>`
        ).join('')}</ul></div>`
      : '';

    const pendingActions = task.proposed_actions.filter(a => a.status === 'pending');
    const actionsHtml = pendingActions.length > 0
      ? `<div class="actions"><strong>Pending actions:</strong><ul>${pendingActions.map(a =>
          `<li>⚡ ${escapeHtml(a.description)} <span class="tag">${a.type}</span></li>`
        ).join('')}</ul></div>`
      : '';

    const pendingFollowUps = task.expected_follow_ups.filter(f => f.status === 'pending');
    const followUpsHtml = pendingFollowUps.length > 0
      ? `<div class="follow-ups"><strong>Expected follow-ups:</strong><ul>${pendingFollowUps.map(f =>
          `<li>🔮 ${escapeHtml(f.prompt)}${f.timing ? ` <span class="timing">(${escapeHtml(f.timing)})</span>` : ''}</li>`
        ).join('')}</ul></div>`
      : '';

    return `
      <div class="card task-card status-${task.status}">
        <div class="card-header">
          <span class="status-icon">${statusIcon[task.status] ?? '❔'}</span>
          <h3>${escapeHtml(task.title)}</h3>
          <span class="status-badge">${task.status}</span>
        </div>
        <p class="goal">${escapeHtml(task.goal)}</p>
        ${subtaskHtml}
        ${missingHtml}
        ${actionsHtml}
        ${followUpsHtml}
        ${task.context ? `<p class="context"><em>${escapeHtml(task.context)}</em></p>` : ''}
        <div class="meta">Created: ${task.created_at.slice(0, 10)} | Updated: ${task.updated_at.slice(0, 10)}</div>
      </div>`;
  }).join('\n');

  const todoListHtml = (items: Todo[], label: string) => {
    if (items.length === 0) return `<p class="empty">${label}: none</p>`;
    return `<div class="todo-section">
      <h3>${label} (${items.length})</h3>
      <ul>${items.map(t => {
        const due = t.dueDate ? ` <span class="due">📅 ${t.dueDate.slice(0, 10)}</span>` : '';
        return `<li class="${t.done ? 'done' : ''}">${t.done ? '✅' : '⬜'} ${escapeHtml(t.text)}${due}</li>`;
      }).join('')}</ul>
    </div>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TODObot Dashboard</title>
  <meta http-equiv="refresh" content="30">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; max-width: 1200px; margin: 0 auto; }
    h1 { color: #f0f6fc; margin-bottom: 8px; }
    h2 { color: #f0f6fc; margin: 32px 0 16px; border-bottom: 1px solid #21262d; padding-bottom: 8px; }
    h3 { color: #f0f6fc; margin: 0; }
    .subtitle { color: #8b949e; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 16px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
    .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .status-icon { font-size: 1.2em; }
    .status-badge { margin-left: auto; font-size: 0.75em; padding: 2px 8px; border-radius: 12px; background: #21262d; color: #8b949e; text-transform: uppercase; }
    .status-in_progress .status-badge { background: #1f3a5f; color: #58a6ff; }
    .status-ready .status-badge { background: #1a3a1a; color: #3fb950; }
    .status-blocked .status-badge { background: #4a1a1a; color: #f85149; }
    .status-done .status-badge { background: #1a3a1a; color: #3fb950; }
    .goal { color: #8b949e; margin-bottom: 12px; font-style: italic; }
    .subtasks ul, .missing ul, .actions ul, .follow-ups ul, .todo-section ul { list-style: none; padding-left: 8px; }
    .subtasks li, .missing li, .actions li, .follow-ups li, .todo-section li { padding: 4px 0; }
    .subtasks li.done, .todo-section li.done { opacity: 0.5; text-decoration: line-through; }
    .tag { font-size: 0.7em; background: #21262d; color: #8b949e; padding: 1px 6px; border-radius: 8px; }
    .timing { color: #8b949e; font-size: 0.9em; }
    .due { color: #d29922; font-size: 0.85em; }
    .meta { margin-top: 12px; font-size: 0.75em; color: #484f58; }
    .context { color: #8b949e; margin-top: 8px; }
    .empty { color: #484f58; font-style: italic; }
    .refresh-btn { float: right; background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 0.85em; }
    .refresh-btn:hover { background: #30363d; }
    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } .columns { grid-template-columns: 1fr; } }
    .subtasks, .missing, .actions, .follow-ups { margin-top: 8px; }
    .subtasks strong, .missing strong, .actions strong, .follow-ups strong { font-size: 0.85em; color: #8b949e; }
  </style>
</head>
<body>
  <button class="refresh-btn" onclick="location.reload()">↻ Refresh</button>
  <h1>TODObot Dashboard</h1>
  <p class="subtitle">Auto-refreshes every 30s | ${tasks.length} task(s) | ${todos.length} todo(s)</p>

  <h2>Tasks</h2>
  ${tasks.length === 0 ? '<p class="empty">No tasks yet. Chat with the bot to create one.</p>' : `<div class="grid">${taskCards}</div>`}

  <h2>Todos</h2>
  <div class="columns">
    ${todoListHtml(pendingTodos, 'Pending')}
    ${todoListHtml(completedTodos, 'Completed')}
  </div>
</body>
</html>`;
}
