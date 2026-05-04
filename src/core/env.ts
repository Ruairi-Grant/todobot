import "dotenv/config";
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const PORT = Number(process.env.PORT ?? 3000);
export const TIMEZONE = process.env.TIMEZONE ?? "UTC";
if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

// LangSmith tracing — optional; auto-tracing activates when both are set
// Supports both LANGSMITH_* and legacy LANGCHAIN_* env var names
export const LANGSMITH_API_KEY =
  process.env.LANGSMITH_API_KEY ?? process.env.LANGCHAIN_API_KEY;
export const LANGSMITH_PROJECT =
  process.env.LANGSMITH_PROJECT ?? process.env.LANGCHAIN_PROJECT ?? "TODObot";

if (LANGSMITH_API_KEY) {
  process.env.LANGCHAIN_TRACING_V2 = "true";
  process.env.LANGSMITH_API_KEY ??= LANGSMITH_API_KEY;
  process.env.LANGSMITH_PROJECT ??= LANGSMITH_PROJECT;
}
