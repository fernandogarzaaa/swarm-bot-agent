import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectSwarmSignals,
  generateTasksFromSignals,
  generateExperimentStrategies,
  TaskQueue,
  CircuitBreaker
} from "../dist/index.js";

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), "swarm-bot-signals-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));
  writeFileSync(join(dir, "src", "index.ts"), "export const value = 1;\n");
  return dir;
}

test("detectSwarmSignals finds stable AppForge-style signals without expensive probes", async () => {
  const repo = tempRepo();
  writeFileSync(join(repo, "lint_output.json"), JSON.stringify({ status: "failed", message: "lint failed" }));
  mkdirSync(join(repo, "swarm"), { recursive: true });
  writeFileSync(join(repo, "swarm", "benchmark_results.json"), JSON.stringify({ regression: true }));

  const signals = await detectSwarmSignals(repo, { expensive: false });
  assert.deepEqual(
    signals.map((signal) => signal.type).sort(),
    ["benchmark_regression", "ci_failure", "missing_tests"]
  );
});

test("tasks are deduped, prioritized, persisted, and strategy-mutated", () => {
  const repo = tempRepo();
  const queue = new TaskQueue(join(repo, "state", "tasks.json"));
  const tasks = generateTasksFromSignals([
    { type: "ci_failure", details: "CI failed", source: "lint_output.json", severity: 1 },
    { type: "missing_tests", details: "No tests", source: "src", severity: 3 }
  ]);

  queue.enqueue(tasks);
  queue.enqueue(tasks);
  assert.equal(queue.load().tasks.length, 2);
  assert.equal(queue.next()?.signal, "ci_failure");

  const strategies = generateExperimentStrategies(tasks[0], {
    failedStrategies: ["direct_repair"],
    maxStrategies: 4
  });
  assert.ok(strategies.length >= 2);
  assert.ok(strategies.every((strategy) => strategy.id !== "direct_repair"));
});

test("CircuitBreaker stops repeated failed loops", () => {
  const breaker = new CircuitBreaker(2);
  assert.equal(breaker.record("agent", "task", "same-input").tripped, false);
  assert.equal(breaker.record("agent", "task", "same-input").tripped, false);
  assert.equal(breaker.record("agent", "task", "same-input").tripped, true);
});
