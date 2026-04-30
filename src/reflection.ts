import { AgentTask, CommandResult, ReflectionNote } from "./types.js";

export function buildReflection(task: AgentTask, results: CommandResult[]): ReflectionNote {
  const failed = results.filter((result) => result.exitCode !== 0);
  const stderr = failed.map((result) => result.stderr || result.stdout).filter(Boolean).join("\n");
  const mistake = failed.length > 0 ? `A command failed while handling "${task.title}".` : undefined;

  return {
    timestamp: new Date().toISOString(),
    mistake,
    learned:
      failed.length > 0
        ? summarizeFailure(stderr)
        : "The run completed without command failures. Preserve the same validation gate for similar tasks.",
    nextPolicyChange:
      failed.length > 0
        ? "Require a narrower reproduction step before applying another fix for this task family."
        : undefined,
    avoidPatterns: failed.map((result) => result.command)
  };
}

function summarizeFailure(text: string): string {
  if (!text.trim()) return "The failing command did not provide useful stderr; capture richer diagnostics next time.";
  return text.trim().split(/\r?\n/).slice(0, 6).join(" ");
}
