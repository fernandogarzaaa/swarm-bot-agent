import { RunPolicy } from "./types.js";

export function requireCapability(policy: RunPolicy, capability: "push" | "pr" | "mcp" | "copilot"): void {
  const allowed =
    capability === "push"
      ? policy.allowPush
      : capability === "pr"
        ? policy.allowPr
        : capability === "mcp"
          ? policy.allowMcp
          : policy.allowCopilot;
  if (!allowed) {
    throw new Error(`Policy blocked ${capability}. Set the matching SWARM_ALLOW_* environment variable to true.`);
  }
}

export function assertChangedFileLimit(changedFiles: string[], maxChangedFiles: number): void {
  if (changedFiles.length > maxChangedFiles) {
    throw new Error(`Change set has ${changedFiles.length} files; policy limit is ${maxChangedFiles}.`);
  }
}
