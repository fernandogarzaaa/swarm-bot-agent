import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { DetectedSignal, ExperimentStrategy, QueuedTask, SignalType } from "./types.js";

interface QueueDocument {
  tasks: QueuedTask[];
}

const TASK_META: Record<SignalType, { title: string; priority: number }> = {
  ci_failure: { title: "repair CI pipeline", priority: 1 },
  failing_tests: { title: "fix failing tests", priority: 1 },
  benchmark_regression: { title: "optimize benchmark regression", priority: 2 },
  outdated_dependencies: { title: "update outdated dependencies", priority: 2 },
  missing_tests: { title: "add missing tests", priority: 3 }
};

const BASE_STRATEGIES: ExperimentStrategy[] = [
  { id: "direct_repair", name: "Direct repair", prompt: "Make the smallest targeted code change that addresses the signal." },
  { id: "test_first", name: "Test first", prompt: "Add or update tests first, then implement the smallest passing change." },
  { id: "safety_review", name: "Safety review", prompt: "Audit the proposed change for side effects before editing." },
  { id: "copilot_delegate", name: "Copilot delegate", prompt: "Delegate the task to GitHub Copilot cloud agent with strict review instructions." }
];

export function generateTasksFromSignals(signals: DetectedSignal[], maxTasks = 5): QueuedTask[] {
  return signals
    .sort((a, b) => a.severity - b.severity)
    .slice(0, maxTasks)
    .map((signal) => {
      const meta = TASK_META[signal.type];
      const now = new Date().toISOString();
      return {
        id: `task_${hash(`${signal.type}:${signal.source}:${signal.details}`).slice(0, 12)}`,
        signal: signal.type,
        title: meta.title,
        details: signal.details,
        priority: meta.priority,
        status: "pending",
        createdAt: now,
        updatedAt: now
      };
    });
}

export class TaskQueue {
  constructor(private readonly file: string) {}

  load(): QueueDocument {
    if (!existsSync(this.file)) return { tasks: [] };
    const parsed = JSON.parse(readFileSync(this.file, "utf8")) as Partial<QueueDocument>;
    return { tasks: parsed.tasks ?? [] };
  }

  save(document: QueueDocument): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(document, null, 2));
  }

  enqueue(tasks: QueuedTask[]): QueueDocument {
    const document = this.load();
    const active = new Set(
      document.tasks
        .filter((task) => task.status === "pending" || task.status === "running")
        .map((task) => `${task.signal}:${task.title}`)
    );
    for (const task of tasks) {
      const key = `${task.signal}:${task.title}`;
      if (!active.has(key)) {
        document.tasks.push(task);
        active.add(key);
      }
    }
    document.tasks.sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
    this.save(document);
    return document;
  }

  next(): QueuedTask | undefined {
    return this.load()
      .tasks.filter((task) => task.status === "pending")
      .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt))[0];
  }

  update(taskId: string, patch: Partial<QueuedTask>): QueueDocument {
    const document = this.load();
    document.tasks = document.tasks.map((task) =>
      task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task
    );
    this.save(document);
    return document;
  }
}

export function generateExperimentStrategies(
  task: QueuedTask,
  options: { failedStrategies?: string[]; maxStrategies?: number } = {}
): ExperimentStrategy[] {
  const failed = new Set(options.failedStrategies ?? task.failedStrategies ?? []);
  const selected = BASE_STRATEGIES.filter((strategy) => !failed.has(strategy.id)).slice(0, options.maxStrategies ?? 4);
  if (selected.length >= 2) return selected;
  return [
    ...selected,
    {
      id: `recovery_${task.signal}`,
      name: "Recovery fallback",
      prompt: "Use a conservative recovery strategy based on the latest failure reflection."
    }
  ];
}

export class CircuitBreaker {
  private readonly history = new Map<string, number>();

  constructor(private readonly maxRepeats = 3) {}

  record(agentId: string, task: string, input: string): { tripped: boolean; count: number; key: string } {
    const key = `${agentId}:${task}:${hash(input)}`;
    const count = (this.history.get(key) ?? 0) + 1;
    this.history.set(key, count);
    return { tripped: count > this.maxRepeats, count, key };
  }

  reset(): void {
    this.history.clear();
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
