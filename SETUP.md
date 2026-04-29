# TODObot — Setup Guide

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** (comes with Node)
- An **OpenAI API key** ([platform.openai.com](https://platform.openai.com))

## 1. Clone & install

```bash
git clone <your-repo-url>
cd TODObot
npm install
```

## 2. Create `.env`

Copy the template below into a `.env` file in the project root:

```env
# Required
OPENAI_API_KEY=sk-...

# Optional — timezone for calendar operations (default: UTC)
TIMEZONE=Europe/London

# Optional — LangSmith tracing
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=todobot

# Optional — Telegram bot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...

# Optional — HTTP server port (default: 3000)
PORT=3000
```

At minimum you need `OPENAI_API_KEY`.

## 3. Google Calendar (optional)

If you want calendar features:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create an OAuth 2.0 Client ID (Desktop app).
2. Download the JSON and save it as `credentials.json` in the project root.
3. Run the auth flow once:
   ```bash
   npm run test:calendar
   ```
   This opens a browser to authorize, then saves `token.json` locally.

Both `credentials.json` and `token.json` are gitignored — you'll need to repeat this on each machine.

## 4. Verify

```bash
# Type-check
npx tsc --noEmit

# Run tests (51 tests)
npm test
```

## 5. Run

| Mode | Command | Description |
|------|---------|-------------|
| CLI REPL | `npm run dev` | Interactive terminal chat |
| HTTP API | `npm run dev:http` | Fastify server on `PORT` |
| Telegram | `npm run dev:telegram` | Telegram bot (needs `TELEGRAM_BOT_TOKEN`) |

## Project structure

```
src/
  agents/          — LangGraph agent definitions (app, planner)
  capabilities/    — Domain tools (calendar, tasks, todos)
  core/            — LLM config, env, supervisor, agent factory
  entrypoints/     — CLI, HTTP, Telegram entry points
  testing/         — LangSmith evaluation helpers
  __tests__/       — Vitest test suite
```

## Sensitive files (gitignored)

| File | Purpose |
|------|---------|
| `.env` | API keys and config |
| `credentials.json` | Google OAuth client secret |
| `token.json` | Google OAuth refresh token |
| `todos.json` | Local todo data |
