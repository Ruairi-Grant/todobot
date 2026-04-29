import "../core/env";
import { createInterface } from "readline";
import { supervisorApp } from "../agents/app";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const threadId = "cli";

function prompt() {
  rl.question("\n🤖 You: ", async (input) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed === "quit" || trimmed === "exit") {
      console.log("Bye!");
      rl.close();
      return;
    }

    try {
      const res = await supervisorApp.invoke(
        { messages: [{ role: "user", content: trimmed }] },
        { configurable: { thread_id: threadId }, recursionLimit: 50 }
      );
      const last = res.messages.at(-1)?.content ?? "(no response)";
      console.log(`\n📋 Agent: ${last}`);
    } catch (err: any) {
      console.error("Error:", err.message);
    }

    prompt();
  });
}

console.log("TODObot REPL — type a task to plan, or 'quit' to exit");
prompt();
