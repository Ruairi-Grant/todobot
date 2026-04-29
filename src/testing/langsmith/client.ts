import { Client } from "langsmith";
import { LANGSMITH_API_KEY } from "../../core/env";

let _client: Client | null = null;

export function getLangSmithClient(): Client {
  if (!LANGSMITH_API_KEY) {
    throw new Error(
      "LANGSMITH_API_KEY is not set. Add it to your .env file to use LangSmith tools."
    );
  }
  if (!_client) {
    _client = new Client({ apiKey: LANGSMITH_API_KEY });
  }
  return _client;
}
