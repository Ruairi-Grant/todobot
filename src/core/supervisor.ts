import { createSupervisor } from "@langchain/langgraph-supervisor";
import { InMemoryStore } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "checkpoints.db");

export function makeSupervisor({
  agents,
  llm,
  prompt,
  responseFormat,
  outputMode = "full_history",
  includeAgentName,
  addHandoffBackMessages = true,
  supervisorName = "supervisor",
  preModelHook,
  postModelHook,
  checkpointer = SqliteSaver.fromConnString(DB_PATH),
  store = new InMemoryStore(),
}: any) {
  const wf = createSupervisor({
    agents,
    llm,
    prompt,
    responseFormat,
    outputMode,
    includeAgentName,
    addHandoffBackMessages,
    supervisorName,
    preModelHook,
    postModelHook,
  });
  return wf.compile({ checkpointer, store });
}
