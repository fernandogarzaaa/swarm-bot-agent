#!/usr/bin/env node
import { AgentMemory } from "./memory.js";
import { McpBridge } from "./mcp.js";
import { SwarmBotAgent } from "./agent.js";
import { defaultPolicy, loadIdentity, loadMcpConfig } from "./config.js";
import { AgentTask, AutonomyMode } from "./types.js";

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

  console.log(`Usage:
  swarm-bot self-check --repo <path>
  swarm-bot run --repo <path> --mode plan --title "..." --body "..."
  swarm-bot run --repo <path> --mode delegate-copilot --title "..." --body "..."

Guard env:
  SWARM_ALLOW_PUSH=true
  SWARM_ALLOW_PR=true
  SWARM_ALLOW_COPILOT=true
  SWARM_ALLOW_MCP=false
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
