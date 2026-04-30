import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSandboxSuite } from "../dist/index.js";

test("runSandboxSuite simulates first-run user workflows and writes a bug report", async () => {
  const root = mkdtempSync(join(tmpdir(), "swarm-bot-sandbox-"));
  const report = await runSandboxSuite({
    root,
    cliPath: join(process.cwd(), "dist", "cli.js"),
    scenarios: ["first-run-plan", "mcp-degraded", "openai-missing-key"]
  });

  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.failed, 0);
  assert.ok(report.summary.warnings >= 1);
  assert.ok(report.scenarios.every((scenario) => scenario.steps.length > 0));
  assert.ok(report.scenarios.some((scenario) => scenario.bugs.some((bug) => bug.severity === "warning")));
  assert.ok(existsSync(report.artifacts.reportPath));

  const persisted = JSON.parse(readFileSync(report.artifacts.reportPath, "utf8"));
  assert.equal(persisted.summary.total, 3);
});

test("sandbox CLI command prints report JSON for a selected scenario", async () => {
  const root = mkdtempSync(join(tmpdir(), "swarm-bot-sandbox-cli-"));
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(
    process.execPath,
    ["dist/cli.js", "sandbox", "--sandbox-dir", root, "--scenario", "first-run-plan"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.total, 1);
  assert.equal(report.scenarios[0].name, "first-run-plan");
});
