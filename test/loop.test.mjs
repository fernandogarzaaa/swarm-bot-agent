import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CheckpointStore, createLoopTask, buildCopilotAgentArgs } from "../dist/index.js";

test("CheckpointStore records resumable loop state", () => {
  const root = mkdtempSync(join(tmpdir(), "swarm-bot-checkpoint-"));
  const store = new CheckpointStore(join(root, "checkpoint.json"));
  store.save({ phase: "audit", taskId: "task_1", summary: "checking CI" });

  assert.equal(store.load()?.phase, "audit");
  assert.match(readFileSync(join(root, "checkpoint.json"), "utf8"), /checking CI/);
});

test("createLoopTask turns queued tasks into PR-ready task prompts", () => {
  const task = createLoopTask({
    id: "task_1",
    signal: "ci_failure",
    title: "repair CI pipeline",
    details: "lint failed",
    priority: 1,
    status: "pending",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  });

  assert.equal(task.title, "swarm-bot: repair CI pipeline");
  assert.match(task.body, /lint failed/);
  assert.ok(task.labels.includes("swarm-bot"));
});

test("buildCopilotAgentArgs supports repo, base branch, custom agent, and follow", () => {
  assert.deepEqual(buildCopilotAgentArgs("do work", {
    repo: "owner/repo",
    base: "main",
    customAgent: "swarm-bot",
    follow: true
  }), [
    "agent-task",
    "create",
    "do work",
    "--base",
    "main",
    "--repo",
    "owner/repo",
    "--custom-agent",
    "swarm-bot",
    "--follow"
  ]);
});
