import "../env";
import { supervisorApp } from "../app-supervisor";

const thread_id = "test-debugger-" + Date.now();
const cfg = { configurable: { thread_id } };

async function test() {
  console.log("── E2E Test: debugger_agent routing ──\n");

  console.log("→ Asking: 'What was my last run?'");
  const r1 = await supervisorApp.invoke(
    { messages: [{ role: "user", content: "What was my last run?" }] },
    cfg,
  );
  const reply1 = String(r1.messages.at(-1)?.content ?? "");
  console.log("← Reply:", reply1.slice(0, 500), "\n");

  console.log("→ Asking: 'Search for any errors in recent traces'");
  const r2 = await supervisorApp.invoke(
    {
      messages: [
        { role: "user", content: "Search for any errors in recent traces" },
      ],
    },
    cfg,
  );
  const reply2 = String(r2.messages.at(-1)?.content ?? "");
  console.log("← Reply:", reply2.slice(0, 500), "\n");

  console.log("── Test complete ──");
}

test().catch(console.error);
