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
    maxChangedFiles: Number.parseInt(process.env.SWARM_MAX_CHANGED_FILES || "12", 10)
  };
}
