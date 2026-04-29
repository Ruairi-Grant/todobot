import { createSupervisor } from "@langchain/langgraph-supervisor";
import { MemorySaver, InMemoryStore } from "@langchain/langgraph";

export function makeSupervisor({
  agents,
  llm,
  prompt,
  responseFormat,
  outputMode = "last_message",
  includeAgentName,
  addHandoffBackMessages = true,
  supervisorName = "supervisor",
  preModelHook,
  postModelHook,
  checkpointer = new MemorySaver(),
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
