import { GitHubAdapter } from "./github.js";
import { AgentMemory } from "./memory.js";
import { McpBridge } from "./mcp.js";
import { buildReflection } from "./reflection.js";
import { AgentIdentity, AgentTask, CommandResult, RunPolicy } from "./types.js";

export class SwarmBotAgent {
  private readonly github: GitHubAdapter;

  constructor(
    private readonly identity: AgentIdentity,
    private readonly policy: RunPolicy,
    private readonly memory: AgentMemory,
    private readonly mcp: McpBridge
  ) {
    this.github = new GitHubAdapter(policy, identity);
  }

  async selfCheck(): Promise<CommandResult[]> {
    const results = await this.github.selfCheck();
    if (this.policy.allowMcp) {
      for (const server of this.mcp.listServers()) {
        try {
          const tools = await this.mcp.listTools(server);
          results.push({
            command: `mcp tools/list ${server}`,
            cwd: this.policy.repoPath,
            exitCode: 0,
            stdout: JSON.stringify(tools),
            stderr: ""
          });
        } catch (error) {
          results.push({
            command: `mcp tools/list ${server}`,
            cwd: this.policy.repoPath,
            exitCode: 1,
            stdout: "",
            stderr: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    return results;
  }

  async run(task: AgentTask): Promise<string> {
    const evidence: string[] = [];
    try {
      if (this.policy.mode === "delegate-copilot") {
        const delegated = await this.github.delegateToCopilot(task);
        this.memory.appendEvent({
          timestamp: new Date().toISOString(),
          taskTitle: task.title,
          mode: this.policy.mode,
          outcome: "delegated",
          summary: delegated,
          evidence
        });
        return delegated;
      }

      if (this.policy.mode === "plan" || this.policy.mode === "dry-run") {
        const checks = await this.selfCheck();
        evidence.push(...checks.map((check) => `${check.command}: ${check.exitCode}`));
        this.memory.appendReflection(buildReflection(task, checks));
        this.memory.appendEvent({
          timestamp: new Date().toISOString(),
          taskTitle: task.title,
          mode: this.policy.mode,
          outcome: checks.every((check) => check.exitCode === 0) ? "success" : "blocked",
          summary: `${this.identity.displayName} planned task without applying changes.`,
          evidence
        });
        return "Plan recorded. No repository changes were applied.";
      }

      const branch = await this.github.createBranch(task);
      evidence.push(`branch:${branch}`);
      const prUrl = await this.github.commitPushAndPr(task, branch);
      this.memory.appendEvent({
        timestamp: new Date().toISOString(),
        taskTitle: task.title,
        mode: this.policy.mode,
        outcome: "success",
        summary: prUrl,
        evidence
      });
      return prUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.memory.appendReflection({
        timestamp: new Date().toISOString(),
        mistake: message,
        learned: "The agent hit a guard or runtime failure and must narrow the next attempt before retrying.",
        nextPolicyChange: "Require explicit evidence that the blocked capability is intended for this repository.",
        avoidPatterns: [this.policy.mode]
      });
      this.memory.appendEvent({
        timestamp: new Date().toISOString(),
        taskTitle: task.title,
        mode: this.policy.mode,
        outcome: "failure",
        summary: message,
        evidence
      });
      throw error;
    }
  }
}
