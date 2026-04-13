import { llm } from "./llm";
import { add, multiply, echo } from "./tools";
import { makeAgent } from "./agent-factory";
import { createHandoffTool } from "./handoff";
import { makeSwarm } from "./swarm";
// TODO: what is this, do we use it at all. if not, do we use swarms at all

const alice = makeAgent({
  name: "alice",
  llm,
  tools: [add, createHandoffTool({ agentName: "bob" })],
  system: "You are Alice, an addition expert.",
});
const bob = makeAgent({
  name: "bob",
  llm,
  tools: [multiply, echo, createHandoffTool({ agentName: "alice" })],
  system: "You are Bob; speak like a pirate.",
});

export const swarmApp = makeSwarm({
  agents: [alice, bob],
  defaultActiveAgent: "alice",
});
