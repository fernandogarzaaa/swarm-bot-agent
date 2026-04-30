import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { runCommand } from "./shell.js";
import { CommandResult } from "./types.js";

export type SandboxScenarioName = "first-run-plan" | "mcp-degraded" | "openai-missing-key";
export type SandboxStatus = "pass" | "warning" | "fail";

export interface SandboxBug {
  severity: "warning" | "error";
  title: string;
  evidence: string;
  recommendation: string;
}

export interface SandboxStep {
  name: string;
  command: string;
  exitCode: number;
  status: SandboxStatus;
  summary: string;
}

export interface SandboxScenarioResult {
  name: SandboxScenarioName;
  status: SandboxStatus;
  summary: string;
  steps: SandboxStep[];
  artifacts: Record<string, string>;
  bugs: SandboxBug[];
}

export interface SandboxReport {
  createdAt: string;
  root: string;
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
  };
  scenarios: SandboxScenarioResult[];
  artifacts: {
    reportPath: string;
  };
}

export interface SandboxOptions {
  root?: string;
  cliPath?: string;
  scenarios?: SandboxScenarioName[];
  reportPath?: string;
}

const ALL_SCENARIOS: SandboxScenarioName[] = ["first-run-plan", "mcp-degraded", "openai-missing-key"];

export async function runSandboxSuite(options: SandboxOptions = {}): Promise<SandboxReport> {
  const root = resolve(options.root?.trim() ? options.root : mkdtempSync(join(tmpdir(), "swarm-bot-sandbox-")));
  const cliPath = resolve(options.cliPath ?? process.argv[1] ?? "dist/cli.js");
  const scenarios = options.scenarios?.length ? options.scenarios : ALL_SCENARIOS;
  mkdirSync(root, { recursive: true });

  const results: SandboxScenarioResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario, root, cliPath));
  }

  const reportPath = resolve(options.reportPath?.trim() ? options.reportPath : join(root, "sandbox-report.json"));
  const report: SandboxReport = {
    createdAt: new Date().toISOString(),
    root,
    summary: {
      total: results.length,
      passed: results.filter((result) => result.status === "pass").length,
      warnings: results.filter((result) => result.status === "warning").length,
      failed: results.filter((result) => result.status === "fail").length
    },
    scenarios: results,
    artifacts: { reportPath }
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return report;
}

async function runScenario(name: SandboxScenarioName, root: string, cliPath: string): Promise<SandboxScenarioResult> {
  if (name === "first-run-plan") return runFirstRunPlan(root, cliPath);
  if (name === "mcp-degraded") return runMcpDegraded(root, cliPath);
  return runOpenAiMissingKey(root, cliPath);
}

async function runFirstRunPlan(root: string, cliPath: string): Promise<SandboxScenarioResult> {
  const repo = await createFixtureRepo(join(root, "first-run-plan"), { lintFailure: true });
  const steps = [
    await runCliStep("scan detects user-visible signal", cliPath, ["scan", "--repo", repo]),
    await runCliStep("queue persists task", cliPath, ["queue", "--repo", repo, "--queue", join(repo, "state", "tasks.json")]),
    await runCliStep("run-loop records plan", cliPath, [
      "run-loop",
      "--repo",
      repo,
      "--mode",
      "plan",
      "--queue",
      join(repo, "state", "tasks.json"),
      "--memory",
      join(repo, "state", "memory.json")
    ])
  ];
  const bugs = collectCommandBugs(steps);
  const missingArtifacts = [join(repo, "state", "tasks.json"), join(repo, "state", "memory.json")].filter(
    (artifact) => !existsSync(artifact)
  );
  for (const artifact of missingArtifacts) {
    bugs.push({
      severity: "error",
      title: "Expected sandbox artifact was not created",
      evidence: artifact,
      recommendation: "Ensure run-loop writes queue and memory state for first-run users."
    });
  }
  return scenarioResult("first-run-plan", "First-run user scans, queues, and plans from a fixture repo.", steps, {
    repo,
    queue: join(repo, "state", "tasks.json"),
    memory: join(repo, "state", "memory.json")
  }, bugs);
}

async function runMcpDegraded(root: string, cliPath: string): Promise<SandboxScenarioResult> {
  const repo = await createFixtureRepo(join(root, "mcp-degraded"), {});
  const config = join(repo, "bad-mcp.json");
  writeFileSync(
    config,
    JSON.stringify(
      { servers: { bad: { transport: "http", url: "http://127.0.0.1:9/mcp", enabled: true } } },
      null,
      2
    )
  );
  const steps = [
    await runCliStep("mcp-health reports degraded server", cliPath, [
      "mcp-health",
      "--repo",
      repo,
      "--mcp",
      config,
      "--health",
      join(repo, "state", "mcp-health.json")
    ])
  ];
  const bugs = collectCommandBugs(steps);
  if (steps[0].exitCode === 0 && /unhealthy/.test(readStepText(steps[0]))) {
    bugs.push({
      severity: "warning",
      title: "MCP server degraded in user sandbox",
      evidence: "mcp-health reported unhealthy for the bad HTTP server.",
      recommendation: "Surface degraded MCP status prominently before an autonomous run uses tools."
    });
  }
  return scenarioResult("mcp-degraded", "User validates MCP health against an unreachable server.", steps, {
    repo,
    mcpConfig: config,
    health: join(repo, "state", "mcp-health.json")
  }, bugs);
}

async function runOpenAiMissingKey(root: string, cliPath: string): Promise<SandboxScenarioResult> {
  const repo = await createFixtureRepo(join(root, "openai-missing-key"), { lintFailure: true });
  const env = {
    ...process.env,
    SWARM_BRAIN_PROVIDER: "openai",
    SWARM_ALLOW_OPENAI_BRAIN: "true",
    OPENAI_API_KEY: ""
  };
  const steps = [
    await runCliStep(
      "run-loop explains missing OpenAI credential",
      cliPath,
      ["run-loop", "--repo", repo, "--mode", "plan", "--queue", join(repo, "state", "tasks.json")],
      env,
      true
    )
  ];
  const bugs: SandboxBug[] = [];
  if (steps[0].exitCode !== 0 && /Missing bearer token|OPENAI_API_KEY/.test(readStepText(steps[0]))) {
    bugs.push({
      severity: "warning",
      title: "OpenAI brain provider blocks first run without credentials",
      evidence: "The sandbox reproduced a missing OPENAI_API_KEY/token-provider failure.",
      recommendation: "Add onboarding diagnostics that check brain provider credentials before run-loop dispatch."
    });
  } else {
    bugs.push(...collectCommandBugs(steps));
  }
  return scenarioResult("openai-missing-key", "User enables OpenAI brain provider without an API key.", steps, {
    repo
  }, bugs);
}

async function createFixtureRepo(repo: string, options: { lintFailure?: boolean }): Promise<string> {
  mkdirSync(join(repo, "src"), { recursive: true });
  writeFileSync(join(repo, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFileSync(join(repo, "src", "index.ts"), "export const value = 1;\n");
  if (options.lintFailure) {
    writeFileSync(join(repo, "lint_output.json"), JSON.stringify({ status: "failed", message: "lint failed" }, null, 2));
  }
  await runCommand("git", ["init"], repo);
  await runCommand("git", ["config", "user.email", "sandbox@swarm-bot.local"], repo);
  await runCommand("git", ["config", "user.name", "Swarm Sandbox"], repo);
  await runCommand("git", ["add", "--all"], repo);
  await runCommand("git", ["commit", "-m", "sandbox fixture"], repo);
  return repo;
}

async function runCliStep(
  name: string,
  cliPath: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  expectedFailure = false
): Promise<SandboxStep> {
  const result = await runCommand(process.execPath, [cliPath, ...args], process.cwd(), { env, timeoutMs: 120000 });
  const status: SandboxStatus = result.exitCode === 0 ? "pass" : expectedFailure ? "warning" : "fail";
  return {
    name,
    command: result.command,
    exitCode: result.exitCode,
    status,
    summary: summarizeResult(result)
  };
}

function scenarioResult(
  name: SandboxScenarioName,
  summary: string,
  steps: SandboxStep[],
  artifacts: Record<string, string>,
  bugs: SandboxBug[]
): SandboxScenarioResult {
  const status: SandboxStatus = bugs.some((bug) => bug.severity === "error")
    ? "fail"
    : bugs.length > 0 || steps.some((step) => step.status === "warning")
      ? "warning"
      : "pass";
  return { name, status, summary, steps, artifacts, bugs };
}

function collectCommandBugs(steps: SandboxStep[]): SandboxBug[] {
  return steps
    .filter((step) => step.status === "fail")
    .map((step) => ({
      severity: "error" as const,
      title: `Sandbox step failed: ${step.name}`,
      evidence: step.summary,
      recommendation: "Reproduce the command locally and add a focused regression test before changing runtime code."
    }));
}

function summarizeResult(result: CommandResult): string {
  return [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .split(/\r?\n/)
    .slice(0, 8)
    .join("\n");
}

function readStepText(step: SandboxStep): string {
  return `${step.summary}\n${step.command}`;
}
