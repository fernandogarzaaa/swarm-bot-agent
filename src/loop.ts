import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { AgentTask, BrainResponse, QueuedTask } from "./types.js";
import { detectSwarmSignals } from "./signals.js";
import { generateTasksFromSignals, TaskQueue } from "./tasks.js";

export interface CheckpointState {
  phase: string;
  taskId?: string;
  summary: string;
  timestamp?: string;
}

export class CheckpointStore {
  constructor(private readonly file = "state/latest-checkpoint.json") {}

  save(state: Omit<CheckpointState, "timestamp">): CheckpointState {
    const payload = { ...state, timestamp: new Date().toISOString() };
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(payload, null, 2));
    return payload;
  }

  load(): CheckpointState | null {
    if (!existsSync(this.file)) return null;
    return JSON.parse(readFileSync(this.file, "utf8")) as CheckpointState;
  }
}

export async function scanAndQueue(repoPath: string, queueFile = join("state", "task-queue.json")) {
  const signals = await detectSwarmSignals(repoPath);
  const tasks = generateTasksFromSignals(signals);
  const queue = new TaskQueue(queueFile);
  return { signals, queue: queue.enqueue(tasks) };
}

export function createLoopTask(task: QueuedTask, brain?: BrainResponse): AgentTask {
  return {
    title: `swarm-bot: ${task.title}`,
    body: [
      `Signal: ${task.signal}`,
      `Task id: ${task.id}`,
      "",
      task.details,
      ...(brain
        ? [
            "",
            "Brain provider:",
            brain.provider,
            "",
            "Brain summary:",
            brain.summary,
            "",
            "Brain plan:",
            ...brain.plan.map((step, index) => `${index + 1}. ${step}`)
          ]
        : []),
      "",
      "Constraints:",
      "- Keep changes small and reviewable.",
      "- Run relevant tests before opening a PR.",
      "- Record any uncertainty or blocked capability in the PR body."
    ].join("\n"),
    labels: ["swarm-bot", task.signal.replaceAll("_", "-")]
  };
}
