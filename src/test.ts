import "./env";
import { supervisorApp } from "./app-supervisor";
import { readTodos, writeTodos } from "./todos";

const thread_id = "test-granny-" + Date.now();
const cfg = { configurable: { thread_id } };

async function test() {
  // Clean slate
  writeTodos([]);
  console.log("── Test: plan granny's birthday party ──\n");

  // Step 1: Initial request — agent should ask clarifying questions
  console.log("→ Step 1: sending planning request...");
  const r1 = await supervisorApp.invoke(
    { messages: [{ role: "user", content: "plan my grannies birthday party" }] },
    cfg
  );
  const reply1 = r1.messages.at(-1)?.content ?? "";
  console.log("← Reply:", String(reply1).slice(0, 200), "\n");

  // Step 2: Follow up with details — agent should create todos
  console.log("→ Step 2: providing details...");
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
  console.log("← Reply:", String(reply2).slice(0, 300), "\n");

  // Verify todos were written
  const todos = readTodos();
  console.log(`✅ todos.json has ${todos.length} item(s)`);
  if (todos.length === 0) {
    console.error("❌ FAIL: No todos were written!");
    process.exit(1);
  }
  for (const t of todos) {
    console.log(`   • [${t.done ? "x" : " "}] ${t.text}${t.dueDate ? ` 📅 ${t.dueDate}` : ""}`);
  }

  console.log("\n── Test passed ──");
}

test().catch((err) => {
  console.error("❌ Test error:", err.message);
  process.exit(1);
});
