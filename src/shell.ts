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
    let settled = false;
    // A missing executable (e.g. the `gh` CLI not installed) emits 'error'
    // instead of 'close'. Without this handler Node throws an unhandled
    // 'error' event and crashes the whole process. Resolve with exit code 127
    // (shell convention for "command not found") so callers can degrade.
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      const missing = error.code === "ENOENT";
      resolve({
        command: [command, ...args].join(" "),
        cwd,
        exitCode: missing ? 127 : 1,
        stdout: stdout.trim(),
        stderr: missing
          ? `${command}: command not found (is it installed and on PATH?)`
          : `${command}: ${error.message}`
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
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
