export type HookAction = "pass" | "block" | "mutate";

export interface HookResult {
  action: HookAction;
  reason?: string;
  mutatedInput?: Record<string, unknown>;
  mutatedResult?: Record<string, unknown>;
}

export type PreHook = (toolName: string, input: Record<string, unknown>) => HookResult | undefined;
export type PostHook = (
  toolName: string,
  input: Record<string, unknown>,
  result: Record<string, unknown>
) => HookResult | undefined;

export class HookPipeline {
  private readonly preHooks: PreHook[] = [];
  private readonly postHooks: PostHook[] = [];

  registerPre(hook: PreHook): void {
    this.preHooks.push(hook);
  }

  registerPost(hook: PostHook): void {
    this.postHooks.push(hook);
  }

  executePre(toolName: string, input: Record<string, unknown>): HookResult {
    let current = { ...input };
    let mutated = false;
    for (const hook of this.preHooks) {
      const result = hook(toolName, current);
      if (!result || result.action === "pass") continue;
      if (result.action === "block") return result;
      if (result.mutatedInput) {
        current = { ...result.mutatedInput };
        mutated = true;
      }
    }
    return mutated ? { action: "mutate", mutatedInput: current } : { action: "pass" };
  }

  executePost(toolName: string, input: Record<string, unknown>, result: Record<string, unknown>): HookResult {
    let current = { ...result };
    let mutated = false;
    for (const hook of this.postHooks) {
      const hookResult = hook(toolName, input, current);
      if (!hookResult || hookResult.action === "pass") continue;
      if (hookResult.action === "block") return hookResult;
      if (hookResult.mutatedResult) {
        current = { ...hookResult.mutatedResult };
        mutated = true;
      }
    }
    return mutated ? { action: "mutate", mutatedResult: current } : { action: "pass" };
  }
}

export interface McpToolPolicy {
  allowedTools?: string[];
  blockedCapabilities?: string[];
}

export function createMcpPolicyHook(policy: McpToolPolicy): PreHook {
  return (toolName, input) => {
    if (policy.allowedTools?.length && !policy.allowedTools.includes(toolName)) {
      return { action: "block", reason: `Tool ${toolName} is not allowed by policy.` };
    }
    const payload = `${toolName} ${JSON.stringify(input)}`.toLowerCase();
    const blocked = policy.blockedCapabilities?.find((capability) => payload.includes(capability.toLowerCase()));
    if (blocked) {
      return { action: "block", reason: `Tool call includes blocked capability: ${blocked}.` };
    }
    return { action: "pass" };
  };
}
