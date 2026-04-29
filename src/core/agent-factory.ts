import { ChatOpenAI } from "@langchain/openai";
import {
  createReactAgent,
  createReactAgentAnnotation,
} from "@langchain/langgraph/prebuilt";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage, SystemMessage } from "@langchain/core/messages";

function privateMessagesSchema(key: string) {
  return Annotation.Root({
    [key]: Annotation<BaseMessage[]>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
  });
}

export function makeAgent({
  name,
  llm,
  tools = [],
  system,
  privateMessagesKey,
}: {
  name: string;
  llm: ChatOpenAI;
  tools?: any[];
  system?: string;
  privateMessagesKey?: string;
}) {
  const stateSchema = privateMessagesKey
    ? privateMessagesSchema(privateMessagesKey)
    : createReactAgentAnnotation();

  const prompt =
    typeof system === "string"
      ? (state: any) => [
          new SystemMessage(system),
          ...(state.messages ?? state[privateMessagesKey!] ?? []),
        ]
      : undefined;

  return createReactAgent({
    name,
    llm,
    tools,
    stateSchema,
    prompt,
  });
}
