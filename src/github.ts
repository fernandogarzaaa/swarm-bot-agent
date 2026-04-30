import { assertOk, runCommand } from "./shell.js";
import { AgentIdentity, AgentTask, CommandResult, RunPolicy } from "./types.js";
import { assertChangedFileLimit, requireCapability } from "./guards.js";

export class GitHubAdapter {
  constructor(private readonly policy: RunPolicy, private readonly identity: AgentIdentity) {}

  async selfCheck(): Promise<CommandResult[]> {
    const checks = [
      runCommand("git", ["status", "--short"], this.policy.repoPath),
      runCommand("gh", ["--version"], this.policy.repoPath),
      runCommand("gh", ["auth", "status"], this.policy.repoPath)
    ];
    return Promise.all(checks);
  }

  async createBranch(task: AgentTask): Promise<string> {
    const slug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
    const branch = `${this.policy.branchPrefix}/${Date.now()}-${slug || "task"}`;
    assertOk(await runCommand("git", ["fetch", "origin", this.policy.baseBranch], this.policy.repoPath));
    assertOk(await runCommand("git", ["checkout", "-B", branch, `origin/${this.policy.baseBranch}`], this.policy.repoPath));
    assertOk(await runCommand("git", ["config", "user.name", this.identity.displayName], this.policy.repoPath));
    assertOk(await runCommand("git", ["config", "user.email", this.identity.email], this.policy.repoPath));
    return branch;
  }

  async changedFiles(): Promise<string[]> {
    const result = await runCommand("git", ["status", "--short"], this.policy.repoPath);
    assertOk(result);
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.slice(3).trim())
      .filter(Boolean);
  }

  async commitPushAndPr(task: AgentTask, branch: string): Promise<string> {
    requireCapability(this.policy, "push");
    requireCapability(this.policy, "pr");
    const changed = await this.changedFiles();
    assertChangedFileLimit(changed, this.policy.maxChangedFiles);
    if (changed.length === 0) {
      throw new Error("No file changes to commit.");
    }
    assertOk(await runCommand("git", ["add", "--all"], this.policy.repoPath));
    assertOk(await runCommand("git", ["commit", "-m", `swarm-bot: ${task.title}`], this.policy.repoPath));
    assertOk(await runCommand("git", ["push", "-u", "origin", branch], this.policy.repoPath));
    const pr = await runCommand(
      "gh",
      [
        "pr",
        "create",
        "--base",
        this.policy.baseBranch,
        "--head",
        branch,
        "--title",
        task.title,
        "--body",
        task.body
      ],
      this.policy.repoPath
    );
    assertOk(pr);
    return pr.stdout;
  }

  async delegateToCopilot(task: AgentTask): Promise<string> {
    requireCapability(this.policy, "copilot");
    const result = await runCommand(
      "gh",
      buildCopilotAgentArgs(`${task.title}\n\n${task.body}`, {
        base: this.policy.baseBranch,
        repo: this.policy.githubRepo,
        customAgent: this.policy.copilotCustomAgent,
        follow: this.policy.followCopilot
      }),
      this.policy.repoPath,
      { timeoutMs: 120000 }
    );
    assertOk(result);
    return result.stdout;
  }
}

export interface CopilotAgentOptions {
  base?: string;
  repo?: string;
  customAgent?: string;
  follow?: boolean;
}

export function buildCopilotAgentArgs(prompt: string, options: CopilotAgentOptions = {}): string[] {
  const args = ["agent-task", "create", prompt];
  if (options.base) args.push("--base", options.base);
  if (options.repo) args.push("--repo", options.repo);
  if (options.customAgent) args.push("--custom-agent", options.customAgent);
  if (options.follow) args.push("--follow");
  return args;
}
