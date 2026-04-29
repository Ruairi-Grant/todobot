import { llm } from "../core/llm";
import { makeSupervisor } from "../core/supervisor";
import { createPlannerAgent } from "./planner";

const plannerAgent = createPlannerAgent(llm);

export const supervisorApp = makeSupervisor({
  agents: [plannerAgent],
  llm,
  outputMode: "last_message",
  supervisorName: "supervisor",
  prompt:
    "You are a routing supervisor. Your job is to delegate tasks to the right agent — NEVER answer directly.\n\n" +
    "Routing rules:\n" +
    "- All requests → delegate to planner_agent\n\n" +
    "IMPORTANT: Do NOT answer the user yourself. Always hand off to an agent.\n" +
    "When relaying the agent's response back to the user, include the agent's full formatted output — do NOT summarize or paraphrase it.",
});
