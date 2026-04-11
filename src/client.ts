import { supervisorApp } from "./app-supervisor";

/**
 * Thin client wrapper around the supervisor.
 * Each unique threadId gets its own conversation context via MemorySaver.
 */
export async function supervisorClient({
  threadId,
  message,
}: {
  threadId: string;
  message: string;
}): Promise<string> {
  const res = await supervisorApp.invoke(
    { messages: [{ role: "user", content: message }] },
    { configurable: { thread_id: threadId }, recursionLimit: 50 }
  );
  return (res.messages.at(-1)?.content as string) ?? "";
}
