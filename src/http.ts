import { fastify } from "fastify";
import { PORT } from "./env";
import { swarmApp } from "./app-swarm";
import { supervisorApp } from "./app-supervisor";

const app = fastify();

app.post("/swarm", async (req, reply) => {
  const body = (req.body ?? {}) as any;
  const messages = body.messages ?? [];
  const thread_id = body.thread_id ?? "t1";
  const res = await swarmApp.invoke(
    { messages },
    { configurable: { thread_id } }
  );
  return reply.send(res);
});

app.post("/supervisor", async (req, reply) => {
  const body = (req.body ?? {}) as any;
  const messages = body.messages ?? [];
  const thread_id = body.thread_id ?? "t1";
  const res = await supervisorApp.invoke(
    { messages },
    { configurable: { thread_id }, recursionLimit: 50 }
  );
  return reply.send(res);
});

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log(`http://localhost:${PORT}`));
