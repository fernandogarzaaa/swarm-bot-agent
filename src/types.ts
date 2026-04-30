export type AutonomyMode = "plan" | "dry-run" | "apply" | "delegate-copilot";
export type SignalType =
  | "ci_failure"
  | "failing_tests"
  | "benchmark_regression"
  | "outdated_dependencies"
  | "missing_tests";

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
  githubRepo?: string;
  copilotCustomAgent?: string;
  followCopilot: boolean;
  brainProvider: "none" | "copilot-cli" | "openai";
  allowCopilotBrain: boolean;
  allowOpenAIBrain: boolean;
  copilotModel?: string;
  copilotReasoningEffort?: "low" | "medium" | "high" | "xhigh";
  openaiModel: string;
  openaiBaseUrl: string;
  openaiTokenCommand?: string;
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

export interface DetectedSignal {
  type: SignalType;
  details: string;
  source: string;
  severity: number;
}

export interface QueuedTask {
  id: string;
  signal: SignalType;
  title: string;
  details: string;
  priority: number;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  retries?: number;
  failedStrategies?: string[];
}

export interface ExperimentStrategy {
  id: string;
  name: string;
  prompt: string;
}

export interface BrainRequest {
  objective: string;
  context: string;
  constraints: string[];
}

export interface BrainResponse {
  provider: string;
  summary: string;
  plan: string[];
  confidence: number;
  raw: string;
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
