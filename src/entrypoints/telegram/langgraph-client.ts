import axios from "axios";

const LANGGRAPH_URL = process.env.LANGGRAPH_URL ?? "http://localhost:3000/supervisor";

export function chunkMessage(text: string, size = 4000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export async function callLangGraph(message: string, threadId: string): Promise<string> {
  const res = await axios.post(LANGGRAPH_URL, {
    messages: [{ role: "user", content: message }],
    thread_id: threadId,
  });

  const messages = res.data?.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    const last = messages.at(-1);
    return last?.kwargs?.content ?? last?.content ?? JSON.stringify(last);
  }

  return JSON.stringify(res.data);
}
