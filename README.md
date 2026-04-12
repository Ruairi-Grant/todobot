# TODObot — Multi-Agent Architecture Reference

> **Purpose of this document:** Provide a complete, self-contained description of the TODObot agent system — its architecture, data flows, tool schemas, agent behaviors, and integration points — so that a supervisory LLM can reason about, coordinate, or extend this system without access to the source code.

---

## 1. System Overview

TODObot is a **multi-agent system** built on **LangChain + LangGraph** (TypeScript). It manages **todos** and **Google Calendar events** through natural language. The system implements two agent orchestration patterns — **Supervisor** (production) and **Swarm** (experimental) — and exposes three interfaces: CLI REPL, HTTP API, and Telegram bot.

**Tech stack:** TypeScript (ES2022), LangGraph 0.4, OpenAI GPT-4o-mini, Fastify, Telegraf, Google Calendar API, Zod schemas, LangSmith tracing.

---

## 2. Architecture Patterns

### 2.1 Supervisor Pattern (Primary — used in production)

A **central supervisor LLM** acts as a router. It reads each user message, decides which specialist agent should handle it, delegates the task, and relays the agent's response verbatim. The supervisor **never answers directly**.

```
                         ┌──────────────────────────┐
            User ──────► │      SUPERVISOR (LLM)    │
                         │   Routes by content:     │
                         │   • todos/calendar/      │
                         │     scheduling           │
                         │     → planner_agent      │
                         │   • math → math_expert   │
                         │   • writing → writer     │
                         │   • default →            │
                         │     planner_agent        │
                         └──┬──────┬──────┬─────────┘
                            │      │      │
               ┌────────────┘      │      └────────────┐
               ▼                   ▼                   ▼
        ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
        │ math_expert │    │   writer    │    │  planner_agent   │
        │             │    │            │    │                  │
        │ Tools:      │    │ Tools:     │    │ Tools:           │
        │  • add      │    │  • echo    │    │  • add_todos     │
        │  • multiply │    │            │    │  • get_todos     │
        └─────────────┘    └─────────────┘    │  • get_todos_   │
                                              │    summary      │
                                              │  • complete_todo│
                                              │  • clear_todos  │
                                              │  • create_cal…  │
                                              │  • list_cal…    │
                                              │  • delete_cal…  │
                                              │  • find_free…   │
                                              │  • get_cal_     │
                                              │    summary      │
                                              └──────────────────┘
```

**Routing rules (in supervisor system prompt):**

| User intent | Routed to |
|---|---|
| Todos, calendar, scheduling, planning, organizing, task lists, projects, appointments, availability, reminders | `planner_agent` |
| Math calculations | `math_expert` |
| Writing or summarizing text | `writer` |
| Ambiguous / unknown | `planner_agent` (default) |

**Output mode:** `"last_message"` — the supervisor returns only the final message from the delegated agent, not the full internal tool-call chain.

### 2.2 Swarm Pattern (Experimental)

**Peer agents** hand off to each other without a central router. Each agent has a `transfer_to_<name>` tool that triggers a state transition.

```
        ┌──────────────────┐         ┌──────────────────┐
        │    alice         │ ──────► │      bob         │
        │ (addition)       │ ◄────── │ (multiplication) │
        │                  │         │                  │
        │ Tools:           │         │ Tools:           │
        │  • add           │         │  • multiply      │
        │  • transfer_to_  │         │  • echo          │
        │    bob           │         │  • transfer_to_  │
        └──────────────────┘         │    alice         │
                                     └──────────────────┘
```

- **Default active agent:** `alice`
- State tracks `activeAgent` field to know who is currently responding
- Handoff tool creates a `Command` object that sets `goto: targetAgent` and updates state

---

## 3. Agent Construction

All agents are built with `makeAgent()`, which wraps LangGraph's `createReactAgent` (ReAct loop: Reason → Act → Observe → repeat).

```
makeAgent({ name, llm, tools, system, privateMessagesKey? })
         │
         ▼
  createReactAgent({
    name,
    llm,          ← ChatOpenAI (gpt-4o-mini)
    tools,        ← Zod-validated tool functions
    stateSchema,  ← Shared or private message history
    prompt        ← [SystemMessage, ...history]
  })
```

**State management:** By default, agents share the parent graph's message history. If `privateMessagesKey` is set, the agent gets an isolated message thread (useful for inner reasoning that shouldn't leak to the user).

**LLM:** All agents share a single `ChatOpenAI({ modelName: "gpt-4o-mini" })` instance.

---

## 4. Memory & Thread Isolation

```
Compilation:
  makeSupervisor/makeSwarm({
    ...,
    checkpointer: new MemorySaver(),   ← Thread-level conversation memory (in-process)
    store: new InMemoryStore()          ← Cross-thread long-term memory
  })

Invocation:
  app.invoke(
    { messages: [...] },
    { configurable: { thread_id: "unique-id" }, recursionLimit: 50 }
  )
```

- Each unique `thread_id` gets isolated conversation context
- `MemorySaver` is in-memory only — state is lost on process restart
- `recursionLimit: 50` prevents infinite agent loops

---

## 5. Tool Catalog

### 5.1 Todo Tools

Todos are stored as JSON in `todos.json` at the project root. The schema:

```typescript
interface Todo {
  id: string;        // UUID v4
  text: string;      // Description
  done: boolean;     // Completion status
  dueDate?: string;  // ISO 8601 date (YYYY-MM-DD)
  createdAt: string; // ISO 8601 timestamp
}
```

| Tool | Input Schema | Behavior | Output |
|---|---|---|---|
| `add_todos` | `{ todos: [{ text: string, dueDate?: string }] }` | Adds items, deduplicates by lowercase text match, generates UUIDs | JSON array of created todos |
| `get_todos` | `{}` | Returns raw todo array | JSON array |
| `get_todos_summary` | `{ status?: "all"\|"pending"\|"done", due_within_days?: number }` | Filters, sorts by due date, formats as markdown | Pre-formatted markdown string |
| `complete_todo` | `{ id_or_text: string }` | Matches by UUID or case-insensitive text substring | Updated todo JSON |
| `clear_todos` | `{}` | Removes all todos | `{ cleared: true }` |

**Agent instructions:**
- Break user goals into actionable todo items automatically
- Parse natural language dates → ISO dates before calling `add_todos`
- Prefer `get_todos_summary` for user-facing queries; use raw `get_todos` only for ID lookups

### 5.2 Calendar Tools

Authenticated via Google OAuth2. Credentials in `credentials.json`, token cached in `token.json`. Scope: `calendar.events` (read/write).

| Tool | Input Schema | Behavior | Output |
|---|---|---|---|
| `create_calendar_event` | `{ title, start_time, end_time, description?, location?, timezone? }` | Creates event via Google Calendar API. Times must be ISO 8601 datetime. | `{ id, title, start, end, link }` |
| `list_calendar_events` | `{ start_date?, end_date? }` | Lists events in range (defaults to today). Max 20 results. | JSON array of events |
| `get_calendar_summary` | `{ days?, offset_days?, timezone? }` | Formatted markdown grouped by date with times and locations | Pre-formatted markdown |
| `find_free_slots` | `{ date, min_duration_minutes?, day_start?, day_end?, timezone? }` | Finds gaps between events that meet minimum duration | Formatted free windows |
| `delete_calendar_event` | `{ event_id }` | Deletes event by ID (must retrieve ID via `list_calendar_events` first) | Deletion confirmation |

**Agent instructions:**
- Parse natural language → structured datetime BEFORE calling calendar tools
- Default event duration: 1 hour if no end time given
- Always pass `timezone` from env config
- Prefer `get_calendar_summary` for user-facing schedule queries
- Use `list_calendar_events` only when event IDs are needed (e.g., before deletion)

### 5.3 Utility Tools (Starter Kit)

| Tool | Input | Output |
|---|---|---|
| `add` | `{ a: number, b: number }` | `a + b` |
| `multiply` | `{ a: number, b: number }` | `a * b` |
| `echo` | `{ text: string }` | Passthrough |

### 5.4 Handoff Tool (Swarm Only)

`createHandoffTool({ agentName })` generates a tool named `transfer_to_<agent_name>` that:
1. Captures current message state
2. Appends a `ToolMessage` noting the transfer
3. Returns a `Command({ goto, graph: PARENT, update: { messages, activeAgent } })`

---

## 6. Agent System Prompts

### 6.1 Supervisor

```
You are a routing supervisor. Your job is to delegate tasks to the right agent — NEVER answer directly.

Routing rules:
- Todos, calendar, scheduling, planning, ... → planner_agent
- Math calculations → math_expert
- Writing or summarizing text → writer
- If unsure, default to planner_agent

IMPORTANT: Do NOT answer the user yourself. Always hand off to an agent.
When relaying the agent's response, include the agent's full formatted output — do NOT summarize or paraphrase it.
```

### 6.2 Planner Agent

The planner agent has the most complex system prompt (~60 lines). Key behavioral rules:

- **Date awareness:** Injected with `Today is <ISO date>` and `User timezone is <tz>`
- **Todo rules:** Break goals into actionable items; parse NL dates; prefer summary tool for user-facing output
- **Calendar rules:** Parse NL → structured data before tool calls; default 1h events; always pass timezone
- **Multi-task:** If user asks to BOTH add a todo AND schedule an event, do BOTH in one turn
- **Mandatory tool use:** Must call at least one tool per turn — never respond with only text

### 6.3 Math Expert

```
You are a math expert. Use one tool at a time.
```

### 6.4 Writer

```
You write crisp, structured answers.
```

---

## 7. Entry Points & Interfaces

### 7.1 CLI REPL (`npm run dev`)

```
src/index.ts → supervisorApp.invoke()
```

- Interactive readline prompt
- Single thread: `thread_id = "cli"`
- Type `quit` or `exit` to stop
- Displays last message from agent response

### 7.2 HTTP API (`npm run dev:http`)

```
src/http.ts → Fastify on port 3000
```

| Endpoint | Body | Uses |
|---|---|---|
| `POST /supervisor` | `{ messages: [{ role, content }], thread_id?: string }` | Supervisor pattern |
| `POST /swarm` | `{ messages: [{ role, content }], thread_id?: string }` | Swarm pattern |

- Default `thread_id`: `"t1"`
- Returns full LangGraph state including all messages

### 7.3 Telegram Bot (`npm run dev:telegram`)

```
src/telegram/index.ts → src/telegram/bot.ts → HTTP call to /supervisor
```

**Requires:** `TELEGRAM_BOT_TOKEN` env var + running HTTP server (`npm run dev:http`)

**Threading model:**
```
Thread ID = tg-{chatId}-{rootMessageId}
```
Replies to the same message share a conversation thread (the bot walks the reply chain to find the root message).

**Commands:**

| Command | Behavior |
|---|---|
| `/start` | Greeting message |
| `/todos` | Sends "show my todos" to the agent |
| Any text | Forwarded to supervisor via HTTP |

- Responses chunked to 4096 chars (Telegram limit)
- Attempts Markdown formatting, falls back to plain text

---

## 8. Data Flow: End-to-End Example

**User says:** "Add 'buy flowers' to my todos for tomorrow and schedule it at 3pm"

```
1. User message arrives (CLI / HTTP / Telegram)
       │
2. supervisorApp.invoke({ messages: [...], thread_id })
       │
3. Supervisor LLM reads message
   → matches "todos" + "schedule" → routes to planner_agent
       │
4. planner_agent receives message + system prompt
   → LLM reasons: need both add_todos AND create_calendar_event
       │
5. Tool call: add_todos({
     todos: [{ text: "buy flowers", dueDate: "2026-04-13" }]
   })
   → Deduplicates, generates UUID, writes to todos.json
   → Returns: [{ id: "abc-123", text: "buy flowers", ... }]
       │
6. Tool call: create_calendar_event({
     title: "Buy flowers",
     start_time: "2026-04-13T15:00:00",
     end_time: "2026-04-13T16:00:00",
     timezone: "UTC"
   })
   → Creates Google Calendar event
   → Returns: { id: "...", link: "https://..." }
       │
7. planner_agent LLM combines tool results into formatted response
       │
8. Supervisor relays response verbatim to user
```

---

## 9. Environment Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API authentication |
| `PORT` | No | `3000` | HTTP server port |
| `TIMEZONE` | No | `"UTC"` | Default timezone for calendar events (IANA format) |
| `TELEGRAM_BOT_TOKEN` | For Telegram | — | Telegraf bot token |
| `LANGGRAPH_URL` | For Telegram | `http://localhost:3000/supervisor` | HTTP endpoint the Telegram bot calls |
| `GOOGLE_CALENDAR_ID` | No | `"primary"` | Google Calendar to operate on |
| `LANGSMITH_API_KEY` | No | — | Enables LangSmith tracing when set |
| `LANGSMITH_PROJECT` | No | `"todobot"` | LangSmith project name |

**Google Calendar auth files:**
- `credentials.json` — OAuth2 client credentials (download from Google Cloud Console)
- `token.json` — Cached OAuth2 token (auto-generated on first auth flow)

---

## 10. Observability: LangSmith Tracing

When `LANGSMITH_API_KEY` is set, **all LangChain operations are auto-traced** (no code changes needed). The env module sets `LANGCHAIN_TRACING_V2=true` at startup.

**Dev utilities** (not exposed as agent tools):

- `getLatestTrace(projectName?)` — Returns the most recent root run with: ID, name, type, status, error, inputs/outputs (truncated), duration, token count, child run count.
- `searchTraces({ filter?, errorsOnly?, limit? })` — Searches past runs by LangSmith filter string or error flag.

---

## 11. File Map

```
TODObot/
├── src/
│   ├── env.ts                  ← Environment vars, LangSmith auto-config
│   ├── llm.ts                  ← Shared ChatOpenAI(gpt-4o-mini) instance
│   ├── agent-factory.ts        ← makeAgent() — wraps createReactAgent
│   ├── supervisor.ts           ← makeSupervisor() — compiles supervisor graph
│   ├── swarm.ts                ← makeSwarm() — compiles swarm graph
│   ├── handoff.ts              ← createHandoffTool() — swarm agent transfer
│   ├── app-supervisor.ts       ← Defines & wires supervisor agents + tools
│   ├── app-swarm.ts            ← Defines & wires swarm agents (alice/bob)
│   ├── client.ts               ← supervisorClient() — thin invoke wrapper
│   ├── tools.ts                ← Todo tools + math/echo utilities
│   ├── todos.ts                ← Todo data model, JSON read/write
│   ├── index.ts                ← CLI REPL entry point
│   ├── http.ts                 ← Fastify HTTP server (/supervisor, /swarm)
│   ├── test.ts                 ← Birthday party planning test
│   ├── calendar/
│   │   ├── auth.ts             ← Google OAuth2 flow + token caching
│   │   ├── tools.ts            ← Calendar tools (create/list/delete/free/summary)
│   │   └── test-auth.ts        ← Calendar auth test
│   ├── telegram/
│   │   ├── bot.ts              ← Telegraf bot with threading + commands
│   │   └── index.ts            ← Telegram entry point
│   ├── langgraph/
│   │   └── client.ts           ← HTTP client for Telegram → LangGraph calls
│   └── langsmith/
│       ├── client.ts           ← LangSmith client singleton
│       └── tools.ts            ← getLatestTrace(), searchTraces()
├── todos.json                  ← Persistent todo storage
├── credentials.json            ← Google OAuth2 credentials
├── token.json                  ← Cached Google auth token
├── package.json                ← Dependencies & scripts
└── tsconfig.json               ← TypeScript config (ES2022, strict)
```

---

## 12. Key Dependencies

| Package | Version | Role |
|---|---|---|
| `@langchain/core` | ^0.3.75 | Base types: messages, tools, agents |
| `@langchain/langgraph` | ^0.4.9 | Graph state, memory, checkpoints, ReAct agent |
| `@langchain/langgraph-supervisor` | ^0.0.19 | `createSupervisor()` orchestration |
| `@langchain/langgraph-swarm` | ^0.0.6 | `createSwarm()` orchestration |
| `@langchain/openai` | ^0.6.11 | ChatOpenAI model binding |
| `googleapis` | ^171.4.0 | Google Calendar API |
| `telegraf` | ^4.16.3 | Telegram bot framework |
| `fastify` | ^5.6.0 | HTTP server |
| `langsmith` | ^0.5.18 | Tracing & debugging |
| `zod` | ^3.25.76 | Runtime schema validation for tools |

---

## 13. Run Commands

```bash
npm run dev           # CLI REPL (interactive)
npm run dev:http      # HTTP API server on :3000
npm run dev:telegram  # Telegram bot (requires dev:http running)
npm run test          # Birthday party planning smoke test
npm run test:calendar # Google Calendar auth test
```

---

## 14. Design Decisions & Constraints

1. **In-memory persistence only** — `MemorySaver` and `InMemoryStore` reset on restart. Todos survive (JSON file) but conversation threads do not.
2. **Single LLM** — All agents use the same `gpt-4o-mini` instance. No per-agent model selection.
3. **Supervisor never answers** — Strict routing-only behavior; all user-facing content comes from specialist agents.
4. **Tool-mandatory planner** — The planner agent must call at least one tool per turn. It is not allowed to respond with free text alone.
5. **Pre-parsing required** — Calendar tools expect ISO 8601 datetimes. The LLM must convert natural language dates into structured ISO strings before calling tools.
6. **Telegram depends on HTTP** — The Telegram bot is a client of the HTTP server, not a direct LangGraph consumer. The HTTP server must be running.
7. **No authentication on HTTP** — The Fastify server has no auth middleware. It's designed for local development only.

