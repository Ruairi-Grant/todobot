import { fastify } from "fastify";
import { PORT } from "../core/env";
import { supervisorApp } from "../agents/app";
import { readTasks } from "../capabilities/tasks/store";
import { readTodos } from "../capabilities/todos/store";
import { buildDashboardHtml } from "./dashboard";

const app = fastify();

// ── Agent API ───────────────────────────────────────────────

app.post("/supervisor", async (req, reply) => {
  const body = (req.body ?? {}) as any;
  const messages = body.messages ?? [];
  const thread_id = body.thread_id ?? "t1";
  const res = await supervisorApp.invoke(
    { messages },
    { configurable: { thread_id }, recursionLimit: 50 }
  );
  // Extract the agent's response (last meaningful AI message before supervisor's "DONE")
  const allMessages = res.messages ?? [];
  const agentResponse = [...allMessages]
    .reverse()
    .find(
      (m: any) =>
        (m.constructor?.name === "AIMessage" || (m as any)?.kwargs?.content) &&
        m?.name !== "supervisor" &&
        (m as any)?.kwargs?.name !== "supervisor"
    );
  const content = (agentResponse as any)?.kwargs?.content ?? (agentResponse as any)?.content ?? null;
  return reply.send({ ...res, agentResponse: content });
});

// ── JSON API ────────────────────────────────────────────────

app.get("/api/tasks", async (_req, reply) => {
  return reply.send(readTasks());
});

app.get("/api/todos", async (_req, reply) => {
  return reply.send(readTodos());
});

// ── Dashboard ───────────────────────────────────────────────

app.get("/", async (_req, reply) => {
  const tasks = readTasks();
  const todos = readTodos();
  const html = buildDashboardHtml(tasks, todos);
  return reply.type("text/html").send(html);
});

// ── Start ───────────────────────────────────────────────────

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log(`http://localhost:${PORT}`));
