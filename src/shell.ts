import { spawn } from "node:child_process";
import { CommandResult } from "./types.js";

export function runCommand(
  command: string,
  args: string[],
  cwd: string,
  options: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGTERM");
        }, options.timeoutMs)
      : undefined;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({
        command: [command, ...args].join(" "),
        cwd,
        exitCode: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

export function assertOk(result: CommandResult): void {
  if (result.exitCode !== 0) {
    throw new Error(`${result.command} failed with ${result.exitCode}: ${result.stderr || result.stdout}`);
  }
}
