import type { Run } from "langsmith/schemas";
import { getLangSmithClient } from "./client";
import { LANGSMITH_PROJECT } from "../env";

function truncate(value: unknown, maxLen = 500): unknown {
  if (value === null || value === undefined) return value;
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function summarizeRun(run: Run) {
  const durationMs =
    run.end_time && run.start_time
      ? new Date(run.end_time).getTime() - new Date(run.start_time).getTime()
      : null;

  return {
    id: run.id,
    name: run.name,
    runType: run.run_type,
    status: run.status ?? (run.error ? "error" : "success"),
    error: run.error ?? null,
    inputs: truncate(run.inputs),
    outputs: truncate(run.outputs),
    startTime: run.start_time,
    durationMs,
    totalTokens: run.total_tokens ?? null,
    childRunIds: run.child_run_ids ?? [],
    numChildRuns: run.child_run_ids?.length ?? 0,
  };
}

/**
 * Get the most recent root trace from LangSmith.
 * Dev utility — not an agent tool.
 */
export async function getLatestTrace(projectName?: string) {
  const client = getLangSmithClient();
  const project = projectName || LANGSMITH_PROJECT;

  const runs: Run[] = [];
  for await (const run of client.listRuns({
    projectName: project,
    isRoot: true,
    limit: 1,
  })) {
    runs.push(run);
  }

  if (runs.length === 0) return { message: "No runs found", project };
  return summarizeRun(runs[0]);
}

/**
 * Search past traces in LangSmith by filter / error flag.
 * Dev utility — not an agent tool.
 */
export async function searchTraces(opts: {
  projectName?: string;
  filter?: string;
  errorsOnly?: boolean;
  limit?: number;
} = {}) {
  const client = getLangSmithClient();
  const project = opts.projectName || LANGSMITH_PROJECT;
  const limit = Math.min(opts.limit ?? 5, 10);

  const results: ReturnType<typeof summarizeRun>[] = [];
  for await (const run of client.listRuns({
    projectName: project,
    filter: opts.filter || undefined,
    error: opts.errorsOnly || undefined,
    limit,
  })) {
    results.push(summarizeRun(run));
  }

  if (results.length === 0) return { message: "No matching runs found", project };
  return results;
}
