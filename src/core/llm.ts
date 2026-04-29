import { ChatOpenAI } from "@langchain/openai";
export const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });
