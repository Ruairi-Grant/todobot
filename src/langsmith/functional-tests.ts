import "../env";
import { supervisorApp } from "../app-supervisor";
import { readTodos, writeTodos } from "../todos";
import { getLangSmithClient } from "./client";
import { LANGSMITH_PROJECT } from "../env";
import type { Run } from "langsmith/schemas";

// ── Helpers ─────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function threadId(name: string) {
  return `func-test-${name}-${Date.now()}`;
}

async function invoke(message: string, thread_id: string) {
  const result = await supervisorApp.invoke(
    { messages: [{ role: "user", content: message }] },
    { configurable: { thread_id }, recursionLimit: 50 },
  );
  const reply = String(result.messages.at(-1)?.content ?? "");
  return reply;
}

/** Wait for LangSmith to ingest the trace, then return child runs of the latest root run */
async function getTraceChildren(waitMs = 5000): Promise<Run[]> {
  // Give LangSmith time to ingest
  console.log(`   ⏳ Waiting ${waitMs / 1000}s for LangSmith ingestion...`);
  await new Promise((r) => setTimeout(r, waitMs));

  const client = getLangSmithClient();
  const project = LANGSMITH_PROJECT;

  // Get latest root run
  let rootRun: Run | null = null;
  for await (const run of client.listRuns({
    projectName: project,
    isRoot: true,
    limit: 1,
  })) {
    rootRun = run;
  }

  if (!rootRun) {
    console.log("   ❌ No root run found");
    return [];
  }

  console.log(`   📋 Root run: ${rootRun.id} (${rootRun.name})`);

  // Get all child runs for this trace
  const children: Run[] = [];
  for await (const run of client.listRuns({
    projectName: project,
    traceId: rootRun.trace_id,
    limit: 50,
  })) {
    children.push(run);
  }

  return children;
}

/** Extract tool calls from child runs */
function findToolCalls(children: Run[]) {
  return children.filter((r) => r.run_type === "tool");
}

/** Extract agent (chain) runs */
function findAgentRuns(children: Run[]) {
  return children.filter(
    (r) => r.run_type === "chain" && ["planner_agent", "supervisor"].includes(r.name),
  );
}

function printSeparator(title: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}\n`);
}

// ── Test 1: Create todo AND calendar event ──────────────────
async function test1_todoAndCalendar() {
  printSeparator("TEST 1: Create todo + calendar event");
  const tid = threadId("t1");

  // Clear todos first
  const todosBefore = readTodos();
  const cleanTodos = todosBefore.filter(
    (t) => !t.text.toLowerCase().includes("buy flowers"),
  );
  writeTodos(cleanTodos);

  const prompt =
    `I need to buy flowers for a friend. Schedule it on my calendar for tomorrow at 3pm ` +
    `and also add a todo to remind me to buy flowers.`;

  console.log(`→ Prompt: "${prompt}"`);
  console.log(`→ Thread: ${tid}`);

  const reply = await invoke(prompt, tid);
  console.log(`← Reply: ${reply.slice(0, 400)}\n`);

  // ── Local verification ──
  console.log("── Local Verification ──");
  const todosAfter = readTodos();
  const flowerTodo = todosAfter.find((t) =>
    t.text.toLowerCase().includes("flower"),
  );
  console.log(
    flowerTodo
      ? `✅ Todo found: "${flowerTodo.text}" (due: ${flowerTodo.dueDate ?? "none"})`
      : "❌ No todo with 'flower' found in todos.json",
  );

  // Check for duplicates
  const flowerTodos = todosAfter.filter((t) =>
    t.text.toLowerCase().includes("flower"),
  );
  console.log(
    flowerTodos.length === 1
      ? "✅ No duplicate todos"
      : `⚠️  Found ${flowerTodos.length} todos mentioning 'flower' (expected 1)`,
  );

  // ── LangSmith trace verification ──
  console.log("\n── LangSmith Trace Verification ──");
  const children = await getTraceChildren();
  const toolCalls = findToolCalls(children);

  console.log(`   Total child runs: ${children.length}`);
  console.log(`   Tool calls: ${toolCalls.length}`);
  for (const tc of toolCalls) {
    const inputs = typeof tc.inputs === "string" ? tc.inputs : JSON.stringify(tc.inputs);
    const outputs = typeof tc.outputs === "string" ? tc.outputs : JSON.stringify(tc.outputs);
    console.log(`   🔧 [${tc.name}] inputs: ${inputs?.slice(0, 300)}`);
    console.log(`      outputs: ${outputs?.slice(0, 300)}`);
  }

  // Check both tools were called
  const calledTools = new Set(toolCalls.map((t) => t.name));
  const hasAddTodos = calledTools.has("add_todos");
  const hasCalendarCreate = calledTools.has("create_calendar_event");
  console.log(
    hasAddTodos ? "✅ add_todos was called" : "❌ add_todos was NOT called",
  );
  console.log(
    hasCalendarCreate
      ? "✅ create_calendar_event was called"
      : "❌ create_calendar_event was NOT called",
  );

  // Check which agents were involved
  const agentRuns = findAgentRuns(children);
  const agentNames = [...new Set(agentRuns.map((r) => r.name))];
  console.log(`   Agents invoked: ${agentNames.join(", ")}`);

  const usedPlanner = agentNames.includes("planner_agent");
  console.log(
    usedPlanner
      ? "✅ planner_agent was used (handles both todos + calendar)"
      : "❌ planner_agent was NOT used",
  );

  return { hasAddTodos, hasCalendarCreate, usedPlanner, flowerTodo: !!flowerTodo };
}

// ── Test 2: Query free slots tomorrow ───────────────────────
async function test2_freeSlotsQuery() {
  printSeparator("TEST 2: Query free time tomorrow");
  const tid = threadId("t2");

  const prompt =
    `When am I free tomorrow? I need to find an hour to go to the gym. ` +
    `Check my calendar and suggest a good time slot.`;

  console.log(`→ Prompt: "${prompt}"`);
  console.log(`→ Thread: ${tid}`);

  const reply = await invoke(prompt, tid);
  console.log(`← Reply: ${reply.slice(0, 500)}\n`);

  // ── LangSmith trace verification ──
  console.log("── LangSmith Trace Verification ──");
  const children = await getTraceChildren();
  const toolCalls = findToolCalls(children);

  console.log(`   Total child runs: ${children.length}`);
  console.log(`   Tool calls: ${toolCalls.length}`);
  for (const tc of toolCalls) {
    const inputs = typeof tc.inputs === "string" ? tc.inputs : JSON.stringify(tc.inputs);
    console.log(`   🔧 [${tc.name}] inputs: ${inputs?.slice(0, 300)}`);
  }

  const calledTools = new Set(toolCalls.map((t) => t.name));
  const hasListEvents = calledTools.has("list_calendar_events");
  console.log(
    hasListEvents
      ? "✅ list_calendar_events was called"
      : "❌ list_calendar_events was NOT called",
  );

  // Check the query was for tomorrow's date range
  const listCall = toolCalls.find((t) => t.name === "list_calendar_events");
  if (listCall) {
    const inputs = typeof listCall.inputs === "string"
      ? JSON.parse(listCall.inputs)
      : listCall.inputs;
    const inputStr = JSON.stringify(inputs);
    const hasTomorrow = inputStr.includes(tomorrow);
    console.log(
      hasTomorrow
        ? `✅ Query includes tomorrow's date (${tomorrow})`
        : `⚠️  Query doesn't clearly reference ${tomorrow}: ${inputStr.slice(0, 200)}`,
    );
  }

  // Check the reply mentions a time suggestion
  const mentionsTime = /\d{1,2}(:\d{2})?\s*(am|pm|AM|PM)/i.test(reply) ||
    /\d{2}:\d{2}/.test(reply);
  console.log(
    mentionsTime
      ? "✅ Reply suggests a specific time"
      : "⚠️  Reply doesn't seem to suggest a specific time slot",
  );

  return { hasListEvents, mentionsTime };
}

// ── Test 3: Todos due in next week ──────────────────────────
async function test3_todosNextWeek() {
  printSeparator("TEST 3: Todos due in the next week");
  const tid = threadId("t3");

  const prompt = `What todos do I have due in the next week?`;

  console.log(`→ Prompt: "${prompt}"`);
  console.log(`→ Thread: ${tid}`);

  const reply = await invoke(prompt, tid);
  console.log(`← Reply: ${reply.slice(0, 500)}\n`);

  // ── Local verification ──
  console.log("── Local Verification ──");
  const todos = readTodos();
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const dueSoon = todos.filter(
    (t) => !t.done && t.dueDate && t.dueDate <= nextWeek && t.dueDate >= today,
  );
  console.log(
    `   📋 Todos actually due ${today} → ${nextWeek}: ${dueSoon.length}`,
  );
  for (const t of dueSoon.slice(0, 5)) {
    console.log(`      - "${t.text}" (due: ${t.dueDate})`);
  }
  if (dueSoon.length > 5) console.log(`      ... and ${dueSoon.length - 5} more`);

  // ── LangSmith trace verification ──
  console.log("\n── LangSmith Trace Verification ──");
  const children = await getTraceChildren();
  const toolCalls = findToolCalls(children);

  console.log(`   Total child runs: ${children.length}`);
  console.log(`   Tool calls: ${toolCalls.length}`);
  for (const tc of toolCalls) {
    const inputs = typeof tc.inputs === "string" ? tc.inputs : JSON.stringify(tc.inputs);
    console.log(`   🔧 [${tc.name}] inputs: ${inputs?.slice(0, 300)}`);
  }

  const calledTools = new Set(toolCalls.map((t) => t.name));
  const hasGetTodos = calledTools.has("get_todos");
  console.log(
    hasGetTodos
      ? "✅ get_todos was called"
      : "❌ get_todos was NOT called",
  );

  // Check that the agent routed to todo_agent
  const agentRuns = findAgentRuns(children);
  const usedPlanner = agentRuns.some((r) => r.name === "planner_agent");
  console.log(
    usedPlanner
      ? "✅ Routed to planner_agent"
      : "❌ Did NOT route to planner_agent",
  );

  // Check the reply mentions some of the due items
  const mentionsDueDates = dueSoon.some((t) =>
    reply.toLowerCase().includes(t.text.toLowerCase().slice(0, 15)),
  );
  console.log(
    mentionsDueDates
      ? "✅ Reply references actual due todos"
      : "⚠️  Reply may not reference the right todos (check manually)",
  );

  return { hasGetTodos, usedPlanner, mentionsDueDates };
}

// ── Main runner ─────────────────────────────────────────────
async function main() {
  console.log("🚀 Functional Test Suite — TODObot");
  console.log(`   Today: ${today} | Tomorrow: ${tomorrow}\n`);

  const results: Record<string, any> = {};

  try {
    results.test1 = await test1_todoAndCalendar();
  } catch (e: any) {
    console.log(`❌ Test 1 crashed: ${e.message}`);
    results.test1 = { error: e.message };
  }

  try {
    results.test2 = await test2_freeSlotsQuery();
  } catch (e: any) {
    console.log(`❌ Test 2 crashed: ${e.message}`);
    results.test2 = { error: e.message };
  }

  try {
    results.test3 = await test3_todosNextWeek();
  } catch (e: any) {
    console.log(`❌ Test 3 crashed: ${e.message}`);
    results.test3 = { error: e.message };
  }

  printSeparator("SUMMARY");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
