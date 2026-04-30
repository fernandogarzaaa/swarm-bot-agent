import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runCommand } from "./shell.js";
import { DetectedSignal } from "./types.js";

export interface SignalOptions {
  expensive?: boolean;
}

const FAIL_PATTERN = /\b(fail(?:ed|ure)?|error|red|broken|exit code [1-9])\b/i;

export async function detectSwarmSignals(repoPath: string, options: SignalOptions = {}): Promise<DetectedSignal[]> {
  const expensive = options.expensive ?? process.env.SWARM_EXPENSIVE_SIGNALS === "true";
  const signals: DetectedSignal[] = [];
  const ci = detectCiFailure(repoPath);
  if (ci) signals.push(ci);
  const benchmark = detectBenchmarkRegression(repoPath);
  if (benchmark) signals.push(benchmark);
  signals.push(...detectTestCoverageSignals(repoPath));
  if (expensive) {
    const tests = await detectFailingTests(repoPath);
    if (tests) signals.push(tests);
    const deps = await detectOutdatedDependencies(repoPath);
    if (deps) signals.push(deps);
  }
  return dedupeSignals(signals);
}

function detectCiFailure(repoPath: string): DetectedSignal | null {
  for (const file of ["final_scan.txt", "verification_results.txt", "lint_output.json"]) {
    const path = join(repoPath, file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    if (FAIL_PATTERN.test(content)) {
      return { type: "ci_failure", details: `Failure markers found in ${file}.`, source: file, severity: 1 };
    }
  }
  return null;
}

function detectBenchmarkRegression(repoPath: string): DetectedSignal | null {
  const path = join(repoPath, "swarm", "benchmark_results.json");
  if (!existsSync(path)) return null;
  try {
    const payload = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    if (payload.regression === true || String(payload.status || "").toLowerCase() === "regression") {
      return {
        type: "benchmark_regression",
        details: "Benchmark metadata indicates a regression.",
        source: "swarm/benchmark_results.json",
        severity: 2
      };
    }
  } catch {
    return {
      type: "benchmark_regression",
      details: "Benchmark metadata is unreadable.",
      source: "swarm/benchmark_results.json",
      severity: 2
    };
  }
  return null;
}

async function detectFailingTests(repoPath: string): Promise<DetectedSignal | null> {
  if (!existsSync(join(repoPath, "package.json"))) return null;
  const result = await runCommand("npm", ["test", "--", "--passWithNoTests"], repoPath, { timeoutMs: 120000 });
  return result.exitCode === 0
    ? null
    : { type: "failing_tests", details: "Unit tests are failing.", source: "npm test", severity: 1 };
}

async function detectOutdatedDependencies(repoPath: string): Promise<DetectedSignal | null> {
  if (!existsSync(join(repoPath, "package.json"))) return null;
  const result = await runCommand("npm", ["outdated", "--json"], repoPath, { timeoutMs: 120000 });
  return result.stdout.trim()
    ? {
        type: "outdated_dependencies",
        details: "Outdated dependencies detected via npm outdated.",
        source: "npm outdated",
        severity: 2
      }
    : null;
}

function detectTestCoverageSignals(repoPath: string): DetectedSignal[] {
  const srcCount = countFiles(repoPath, ["src"], /\.(ts|tsx|js|jsx|mjs|cjs|py|rs)$/);
  const testsCount = countFiles(repoPath, ["test", "tests", "src"], /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|py)$/);
  if (srcCount === 0) return [];
  if (testsCount === 0) {
    return [{ type: "missing_tests", details: "No test files detected for source tree.", source: "src", severity: 3 }];
  }
  const ratio = testsCount / srcCount;
  return ratio < 0.1
    ? [
        {
          type: "missing_tests",
          details: `Estimated test-to-source ratio is ${ratio.toFixed(2)}.`,
          source: "src",
          severity: 3
        }
      ]
    : [];
}

function countFiles(repoPath: string, roots: string[], pattern: RegExp): number {
  let count = 0;
  for (const root of roots) {
    const path = join(repoPath, root);
    if (!existsSync(path)) continue;
    count += walk(path, pattern);
  }
  return count;
}

function walk(root: string, pattern: RegExp): number {
  let count = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (["node_modules", "dist", "build", ".git", "coverage"].includes(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) count += walk(path, pattern);
    if (entry.isFile() && pattern.test(entry.name)) count += 1;
  }
  return count;
}

function dedupeSignals(signals: DetectedSignal[]): DetectedSignal[] {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.type}:${signal.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
