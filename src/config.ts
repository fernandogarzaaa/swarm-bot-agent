import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AgentIdentity, McpConfig, RunPolicy } from "./types.js";

export function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function loadIdentity(file = "config/swarm-bot.identity.json"): AgentIdentity {
  const resolved = resolve(file);
  if (!existsSync(resolved)) {
    throw new Error(`Missing identity file: ${resolved}`);
  }
  return loadJson<AgentIdentity>(resolved);
}

export function loadMcpConfig(file = "config/mcp.servers.json"): McpConfig {
  const resolved = resolve(file);
  if (!existsSync(resolved)) {
    return { servers: {} };
  }
  return loadJson<McpConfig>(resolved);
}

export function defaultPolicy(repoPath: string, mode: RunPolicy["mode"]): RunPolicy {
  return {
    mode,
    repoPath: resolve(repoPath),
    baseBranch: process.env.SWARM_BASE_BRANCH || "main",
    branchPrefix: process.env.SWARM_BRANCH_PREFIX || "swarm-bot",
    allowPush: process.env.SWARM_ALLOW_PUSH === "true",
    allowPr: process.env.SWARM_ALLOW_PR === "true",
    allowMcp: process.env.SWARM_ALLOW_MCP !== "false",
    allowCopilot: process.env.SWARM_ALLOW_COPILOT === "true",
    maxChangedFiles: Number.parseInt(process.env.SWARM_MAX_CHANGED_FILES || "12", 10),
    githubRepo: process.env.SWARM_GITHUB_REPO || undefined,
    copilotCustomAgent: process.env.SWARM_COPILOT_AGENT || undefined,
    followCopilot: process.env.SWARM_COPILOT_FOLLOW === "true",
    brainProvider:
      process.env.SWARM_BRAIN_PROVIDER === "copilot-cli"
        ? "copilot-cli"
        : process.env.SWARM_BRAIN_PROVIDER === "openai"
          ? "openai"
          : "none",
    allowCopilotBrain: process.env.SWARM_ALLOW_COPILOT_BRAIN === "true",
    allowOpenAIBrain: process.env.SWARM_ALLOW_OPENAI_BRAIN === "true",
    copilotModel: process.env.SWARM_COPILOT_MODEL || undefined,
    copilotReasoningEffort: process.env.SWARM_COPILOT_REASONING_EFFORT as RunPolicy["copilotReasoningEffort"] | undefined,
    openaiModel: process.env.SWARM_OPENAI_MODEL || "gpt-4.1-mini",
    openaiBaseUrl: process.env.SWARM_OPENAI_BASE_URL || "https://api.openai.com/v1",
    openaiTokenCommand: process.env.SWARM_OPENAI_TOKEN_COMMAND || undefined
  };
}
