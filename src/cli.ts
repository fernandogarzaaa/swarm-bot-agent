#!/usr/bin/env node
import { AgentMemory } from "./memory.js";
import { McpBridge } from "./mcp.js";
import { SwarmBotAgent } from "./agent.js";
import { defaultPolicy, loadIdentity, loadMcpConfig } from "./config.js";
import { AgentTask, AutonomyMode } from "./types.js";
import { detectSwarmSignals } from "./signals.js";
import { generateTasksFromSignals, TaskQueue } from "./tasks.js";
import { McpHealthRegistry } from "./mcp-health.js";
import { runSandboxSuite, SandboxScenarioName } from "./sandbox.js";

function readArg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function readMode(): AutonomyMode {
  const mode = readArg("--mode", "plan") as AutonomyMode;
  if (!["plan", "dry-run", "apply", "delegate-copilot"].includes(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }
  return mode;
}

async function main(): Promise<void> {
  const command = process.argv[2] || "help";
  const repo = readArg("--repo", process.cwd());
  const mode = readMode();
  const identity = loadIdentity(readArg("--identity", "config/swarm-bot.identity.json"));
  const policy = defaultPolicy(repo, mode);
  const memory = new AgentMemory(readArg("--memory", "state/swarm-bot.memory.json"));
  const mcp = new McpBridge(loadMcpConfig(readArg("--mcp", "config/mcp.servers.json")));
  const agent = new SwarmBotAgent(identity, policy, memory, mcp);

  if (command === "self-check") {
    const results = await agent.selfCheck();
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.every((result) => result.exitCode === 0) ? 0 : 1);
  }

  if (command === "run") {
    const task: AgentTask = {
      title: readArg("--title", "Swarm Bot Task"),
      body: readArg("--body", "No task body provided."),
      labels: readArg("--labels", "swarm-bot").split(",").filter(Boolean)
    };
    console.log(await agent.run(task));
    return;
  }

  if (command === "scan") {
    console.log(JSON.stringify(await detectSwarmSignals(repo, { expensive: readArg("--expensive", "false") === "true" }), null, 2));
    return;
  }

  if (command === "queue") {
    const queue = new TaskQueue(readArg("--queue", "state/task-queue.json"));
    const signals = await detectSwarmSignals(repo, { expensive: readArg("--expensive", "false") === "true" });
    console.log(JSON.stringify(queue.enqueue(generateTasksFromSignals(signals)), null, 2));
    return;
  }

  if (command === "next-task") {
    const queue = new TaskQueue(readArg("--queue", "state/task-queue.json"));
    console.log(JSON.stringify(queue.next() ?? null, null, 2));
    return;
  }

  if (command === "mcp-health") {
    const registry = new McpHealthRegistry(loadMcpConfig(readArg("--mcp", "config/mcp.servers.json")), readArg("--health", "state/mcp-health.json"));
    console.log(JSON.stringify(await registry.probeAll(), null, 2));
    return;
  }

  if (command === "run-loop") {
    console.log(await agent.runLoopOnce(readArg("--queue", "state/task-queue.json")));
    return;
  }

  if (command === "sandbox") {
    const selected = readArg("--scenario", "all");
    const scenarios =
      selected === "all" ? undefined : selected.split(",").map((item) => item.trim()).filter(Boolean) as SandboxScenarioName[];
    const report = await runSandboxSuite({
      root: readArg("--sandbox-dir", ".swarm-sandbox"),
      cliPath: process.argv[1],
      scenarios,
      reportPath: readArg("--report", "")
    });
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.summary.failed === 0 ? 0 : 1);
  }

  console.log(`Usage:
  swarm-bot self-check --repo <path>
  swarm-bot scan --repo <path>
  swarm-bot queue --repo <path>
  swarm-bot next-task
  swarm-bot mcp-health --mcp config/mcp.servers.example.json
  swarm-bot sandbox --scenario all
  swarm-bot run-loop --repo <path> --mode plan
  swarm-bot run --repo <path> --mode plan --title "..." --body "..."
  swarm-bot run --repo <path> --mode delegate-copilot --title "..." --body "..."

Guard env:
  SWARM_ALLOW_PUSH=true
  SWARM_ALLOW_PR=true
  SWARM_ALLOW_COPILOT=true
  SWARM_ALLOW_MCP=false
  SWARM_GITHUB_REPO=owner/repo
  SWARM_COPILOT_AGENT=swarm-bot
  SWARM_COPILOT_FOLLOW=true
  SWARM_BRAIN_PROVIDER=copilot-cli
  SWARM_ALLOW_COPILOT_BRAIN=true
  SWARM_BRAIN_PROVIDER=openai
  SWARM_ALLOW_OPENAI_BRAIN=true
  OPENAI_API_KEY=<server-side secret>
  SWARM_OPENAI_TOKEN_COMMAND=<optional command that prints an OAuth/access token>
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
