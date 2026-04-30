export type AutonomyMode = "plan" | "dry-run" | "apply" | "delegate-copilot";

export interface AgentIdentity {
  id: string;
  displayName: string;
  email: string;
  purpose: string;
  autonomyLevel: string;
  traits: string[];
  claims: Record<string, string>;
}

export interface RunPolicy {
  mode: AutonomyMode;
  repoPath: string;
  baseBranch: string;
  branchPrefix: string;
  allowPush: boolean;
  allowPr: boolean;
  allowMcp: boolean;
  allowCopilot: boolean;
  maxChangedFiles: number;
}

export interface AgentTask {
  title: string;
  body: string;
  labels: string[];
}

export interface CommandResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface MemoryEvent {
  timestamp: string;
  taskTitle: string;
  mode: AutonomyMode;
  outcome: "success" | "failure" | "blocked" | "delegated";
  summary: string;
  evidence: string[];
}

export interface ReflectionNote {
  timestamp: string;
  mistake?: string;
  learned: string;
  nextPolicyChange?: string;
  avoidPatterns: string[];
}

export interface McpServerConfig {
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  cwd?: string;
  url?: string;
  enabled?: boolean;
}

export interface McpConfig {
  servers: Record<string, McpServerConfig>;
}
