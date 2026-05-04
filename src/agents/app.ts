import { llm } from "../core/llm";
import { makeSupervisor } from "../core/supervisor";
import { createPlannerAgent } from "./planner";

const plannerAgent = createPlannerAgent(llm);

export const supervisorApp = makeSupervisor({
  agents: [plannerAgent],
  llm,
  outputMode: "full_history",
  supervisorName: "supervisor",
  prompt:
    "You are a routing supervisor. Your job is to delegate tasks to the right agent — NEVER answer directly.\n\n" +
    "Routing rules:\n" +
    "- All requests → delegate to planner_agent\n\n" +
    "IMPORTANT: Do NOT answer the user yourself. Always hand off to an agent.\n" +
    "After an agent has responded, reply with ONLY the word: DONE",
});
