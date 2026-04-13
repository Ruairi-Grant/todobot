import "./env";
import { supervisorApp } from "./app-supervisor";
import { readTodos, writeTodos } from "./todos";
import { readTasks, writeTasks } from "./tasks";

const thread_id = "test-granny-" + Date.now();
const cfg = { configurable: { thread_id } };

async function test() {
  // Clean slate
  writeTodos([]);
  writeTasks([]);
  console.log("── Test: plan granny's birthday party ──\n");

  // Step 1: Initial request — agent should create a task with missing_info
  console.log("→ Step 1: sending planning request...");
  const r1 = await supervisorApp.invoke(
    { messages: [{ role: "user", content: "plan my grannies birthday party" }] },
    cfg
  );
  const reply1 = r1.messages.at(-1)?.content ?? "";
  console.log("← Reply:", String(reply1).slice(0, 300), "\n");

  // Verify a task was created
  const tasksAfterStep1 = readTasks();
  console.log(`📋 tasks.json has ${tasksAfterStep1.length} task(s) after step 1`);
  if (tasksAfterStep1.length > 0) {
    const task = tasksAfterStep1[0];
    console.log(`   ✅ Task: "${task.title}" (status: ${task.status})`);
    console.log(`   📝 Goal: ${task.goal}`);
    if (task.subtasks.length > 0) {
      console.log(`   📋 Subtasks: ${task.subtasks.length}`);
      for (const s of task.subtasks) {
        console.log(`      • [${s.done ? "x" : " "}] ${s.text}`);
      }
    }
    if (task.missing_info.length > 0) {
      console.log(`   ❓ Missing info: ${task.missing_info.join(", ")}`);
    }
  } else {
    console.log("   ⚠️  No task created yet (agent may have used todos instead)");
  }

  // Step 2: Follow up with details — agent should update the task
  console.log("\n→ Step 2: providing details...");
  const r2 = await supervisorApp.invoke(
    {
      messages: [
        {
          role: "user",
          content:
            "May 10th, at home, 15 guests, garden theme, budget $500",
        },
      ],
    },
    cfg
  );
  const reply2 = r2.messages.at(-1)?.content ?? "";
  console.log("← Reply:", String(reply2).slice(0, 400), "\n");

  // Verify task was updated or todos were created
  const tasksAfterStep2 = readTasks();
  const todosAfterStep2 = readTodos();

  console.log("── Verification ──");
  console.log(`📋 tasks.json: ${tasksAfterStep2.length} task(s)`);
  console.log(`📋 todos.json: ${todosAfterStep2.length} todo(s)`);

  // Check tasks
  if (tasksAfterStep2.length > 0) {
    const task = tasksAfterStep2[0];
    console.log(`\n✅ Task: "${task.title}" (status: ${task.status})`);
    if (task.subtasks.length > 0) {
      console.log(`   Subtasks: ${task.subtasks.length}`);
      for (const s of task.subtasks) {
        console.log(`      • [${s.done ? "x" : " "}] ${s.text}`);
      }
    }
    if (task.missing_info.length === 0) {
      console.log("   ✅ No missing info (task is actionable)");
    } else {
      console.log(`   ❓ Still missing: ${task.missing_info.join(", ")}`);
    }
    if (task.proposed_actions.length > 0) {
      console.log(`   ⚡ Proposed actions: ${task.proposed_actions.length}`);
      for (const a of task.proposed_actions) {
        console.log(`      • [${a.status}] ${a.description}`);
      }
    }
    if (task.context) {
      console.log(`   📝 Context: ${task.context.slice(0, 200)}`);
    }
  }

  // Check todos (backward compat — agent might still create todos)
  if (todosAfterStep2.length > 0) {
    console.log(`\n📋 Todos created:`);
    for (const t of todosAfterStep2) {
      console.log(`   • [${t.done ? "x" : " "}] ${t.text}${t.dueDate ? ` 📅 ${t.dueDate}` : ""}`);
    }
  }

  // At least one system should have data
  if (tasksAfterStep2.length === 0 && todosAfterStep2.length === 0) {
    console.error("\n❌ FAIL: Neither tasks nor todos were created!");
    process.exit(1);
  }

  console.log("\n── Test passed ──");
}

test().catch((err) => {
  console.error("❌ Test error:", err.message);
  process.exit(1);
});
