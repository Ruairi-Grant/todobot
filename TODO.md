DONE:
- ✅ bring tests up to scratch:
    - ✅ vitest adopted with 51 unit tests across 5 test files
    - ✅ tests follow telegram architecture (conversation threading, message ID derivation, chunking)
    - ✅ each test has a clear description of what it tests
    - ✅ tests cover: task CRUD, subtask auto-completion, follow-ups, todo provider (local + microsoft stub), action dispatcher, dashboard HTML/XSS, telegram threading
- ✅ evolve tasks architecture to have expected follow ups
    - ✅ Task interface extended with expected_follow_ups: { id, prompt, timing?, status }
    - ✅ Tools: add_follow_ups, complete_follow_up, skip_follow_up
    - ✅ Planner prompt updated to use follow-ups when tasks go to in_progress
- ✅ cleanup unused code, better structure the codebase
    - ✅ Deleted: swarm, handoff, client.ts, old telegram.ts, dubitatively/, math tools, writer agent
    - ✅ Restructured to capability-based architecture: core/, capabilities/, agents/, entrypoints/, testing/
    - ✅ Each capability (tasks, todos, calendar) is self-contained: store.ts + tools.ts + prompt.ts
    - ✅ Decoupled cross-domain calls via injectable action registry
    - ✅ Removed @langchain/langgraph-swarm dependency
- ✅ hit MVP 1 of something I can use to track tasks i am working on and persist to microsoft TODO.
    - ✅ TodoProvider interface with LocalJson and MicrosoftTodo (stub) implementations
    - ✅ Switchable via TODO_PROVIDER=local|microsoft env var
    - ✅ HTML dashboard at GET / showing tasks + todos with auto-refresh
    - ✅ JSON API: GET /api/tasks, GET /api/todos

TODO:
- wire up real Microsoft To Do integration when Azure AD app registration is ready
- add integration tests (LLM-dependent) for end-to-end agent flows


MVP 2
- have agent read mail and create tasks
- have agent provide a summary at the start of the day for approval - nothing to do is ok
- have agent suggest basic delagation it can do
    - draft an email response