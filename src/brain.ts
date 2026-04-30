import { assertOk, runCommand } from "./shell.js";
import { BrainRequest, BrainResponse, RunPolicy } from "./types.js";

export interface BrainProvider {
  think(request: BrainRequest): Promise<BrainResponse>;
}

export class StaticBrain implements BrainProvider {
  async think(request: BrainRequest): Promise<BrainResponse> {
    return {
      provider: "static",
      summary: `Plan for ${request.objective}`,
      plan: request.constraints.length ? request.constraints : ["Inspect evidence.", "Make a small change.", "Verify."],
      confidence: 0.5,
      raw: request.context
    };
  }
}

export class CopilotCliBrain implements BrainProvider {
  constructor(private readonly policy: RunPolicy) {}

  async think(request: BrainRequest): Promise<BrainResponse> {
    if (!this.policy.allowCopilotBrain) {
      throw new Error("Policy blocked Copilot brain. Set SWARM_ALLOW_COPILOT_BRAIN=true.");
    }
    const prompt = buildBrainPrompt(request);
    const result = await runCommand("copilot", buildCopilotBrainArgs(prompt, {
      model: this.policy.copilotModel,
      effort: this.policy.copilotReasoningEffort
    }), this.policy.repoPath, { timeoutMs: 180000 });
    if (result.exitCode !== 0) {
      throw new Error(`Copilot brain failed: ${result.stderr || result.stdout}`);
    }
    return parseBrainResponse(result.stdout);
  }
}

export function createBrainProvider(policy: RunPolicy): BrainProvider {
  if (policy.brainProvider === "copilot-cli") return new CopilotCliBrain(policy);
  if (policy.brainProvider === "openai") return new OpenAIBrain(policy);
  return new StaticBrain();
}

export interface CopilotBrainOptions {
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh";
}

export function buildCopilotBrainArgs(prompt: string, options: CopilotBrainOptions = {}): string[] {
  const args = ["-p", prompt, "--silent", "--no-ask-user", "--deny-tool=shell", "--deny-tool=write"];
  if (options.model) args.push("--model", options.model);
  if (options.effort) args.push("--effort", options.effort);
  return args;
}

export function buildBrainPrompt(request: BrainRequest): string {
  return [
    "You are the reasoning brain for Swarm Bot, not an autonomous task delegate.",
    "Return concise JSON with keys: summary, plan, confidence.",
    "Do not edit files or run commands. Provide reasoning guidance only.",
    "",
    `Objective: ${request.objective}`,
    "",
    "Context:",
    request.context,
    "",
    "Constraints:",
    ...request.constraints.map((constraint) => `- ${constraint}`)
  ].join("\n");
}

function parseBrainResponse(raw: string): BrainResponse {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json) as Partial<BrainResponse>;
      return {
        provider: "copilot-cli",
        summary: String(parsed.summary || "Copilot brain response"),
        plan: Array.isArray(parsed.plan) ? parsed.plan.map(String) : [],
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6,
        raw
      };
    } catch {
      // fall through to text parsing
    }
  }
  return {
    provider: "copilot-cli",
    summary: raw.split(/\r?\n/).find(Boolean) || "Copilot brain response",
    plan: raw.split(/\r?\n/).filter((line) => /^\s*(-|\d+\.)/.test(line)).slice(0, 8),
    confidence: 0.55,
    raw
  };
}

export interface BearerTokenProvider {
  getBearerToken(): Promise<string>;
}

export class EnvBearerTokenProvider implements BearerTokenProvider {
  constructor(private readonly envNames = ["OPENAI_API_KEY"]) {}

  async getBearerToken(): Promise<string> {
    for (const name of this.envNames) {
      const value = process.env[name];
      if (value) return value;
    }
    throw new Error(`Missing bearer token. Set one of: ${this.envNames.join(", ")}.`);
  }
}

export class CommandBearerTokenProvider implements BearerTokenProvider {
  constructor(private readonly commandLine: string, private readonly cwd: string) {}

  async getBearerToken(): Promise<string> {
    const result = await runCommand("powershell", ["-NoProfile", "-Command", this.commandLine], this.cwd, {
      timeoutMs: 60000
    });
    assertOk(result);
    const token = result.stdout.trim();
    if (!token) throw new Error("Token command returned an empty token.");
    return token;
  }
}

export class OpenAIBrain implements BrainProvider {
  private readonly tokenProvider: BearerTokenProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly policy: RunPolicy, options: { tokenProvider?: BearerTokenProvider; fetchImpl?: typeof fetch } = {}) {
    this.tokenProvider = options.tokenProvider ?? (
      policy.openaiTokenCommand
        ? new CommandBearerTokenProvider(policy.openaiTokenCommand, policy.repoPath)
        : new EnvBearerTokenProvider()
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async think(request: BrainRequest): Promise<BrainResponse> {
    if (!this.policy.allowOpenAIBrain) {
      throw new Error("Policy blocked OpenAI brain. Set SWARM_ALLOW_OPENAI_BRAIN=true.");
    }
    const token = await this.tokenProvider.getBearerToken();
    const prompt = buildBrainPrompt(request);
    const response = await this.fetchImpl(`${this.policy.openaiBaseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.policy.openaiModel,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "swarm_brain_response",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                plan: { type: "array", items: { type: "string" } },
                confidence: { type: "number" }
              },
              required: ["summary", "plan", "confidence"]
            },
            strict: true
          }
        }
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI brain failed with ${response.status}: ${body.slice(0, 500)}`);
    }
    const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const raw = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("\n") ?? "";
    return { ...parseBrainResponse(raw), provider: "openai" };
  }
}
