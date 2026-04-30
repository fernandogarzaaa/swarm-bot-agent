# Swarm Bot Agent Architecture

This package extracts the useful AppForge swarm-bot behavior into a standalone, guarded autonomous PR agent.

## Extracted Behaviors

- AppForge swarm controller: persistent queue, cycle memory, selected task context, and bounded experiments.
- AppForge result selector: choose the successful candidate, record failures, and persist memory after each cycle.
- AppForge MCP registry: tool metadata, capability matching, execution results, and success-rate tracking.
- Project Evo: multi-agent audit/architect/adversary/coder/tester loop, circuit breaker, failure exclusion, and PR creation path.
- OpenChimera: MCP registry health model and tool execution gates.
- ChimeraLang MCP: stdio/http MCP server shape and tool-call constraint middleware pattern.
- Aegis/Seraph lineage: external operator bridge pattern through a gateway instead of direct uncontrolled local actions.

## Consciousness Boundary

This agent does not create or verify literal consciousness. The implementation gives it operational self-awareness:

- identity file
- persistent memory
- reflection notes
- mistake tracking
- policy guards
- skills loaded as part of the agent self-model

That is the implementable surface: stateful behavior that can explain and adjust itself.

## Autonomy Modes

- `plan`: gather evidence and record memory, no changes.
- `dry-run`: same as plan, reserved for future patch simulation.
- `apply`: create branch, commit existing local changes, push, and open PR. Requires `SWARM_ALLOW_PUSH=true` and `SWARM_ALLOW_PR=true`.
- `delegate-copilot`: call GitHub Copilot cloud agent through `gh agent-task create`. Requires GitHub CLI 2.80+ and `SWARM_ALLOW_COPILOT=true`.

## Brain Providers

Swarm Bot treats model access as a replaceable brain provider:

- `none`: deterministic static fallback for tests and offline planning.
- `copilot-cli`: calls GitHub Copilot CLI with `copilot -p` for reasoning guidance only. It denies shell/write tools by default so Copilot is not a delegated worker.
- `openai`: calls the OpenAI Responses API with a server-side bearer token from `OPENAI_API_KEY` or a token-command hook.

Provider guards:

- `SWARM_BRAIN_PROVIDER=copilot-cli`
- `SWARM_ALLOW_COPILOT_BRAIN=true`
- `SWARM_BRAIN_PROVIDER=openai`
- `SWARM_ALLOW_OPENAI_BRAIN=true`
- `OPENAI_API_KEY=<server-side secret>`
- `SWARM_OPENAI_TOKEN_COMMAND=<optional command that prints a short-lived bearer token>`

The token command is the integration point for a host app that performs OAuth or sign-in. The token is read from stdout and is never written to repository files.

## GitHub Copilot Integration

GitHub's current supported automation path is the Copilot cloud agent:

- `gh agent-task create` can ask Copilot to open a pull request.
- Remote GitHub MCP can expose `create_pull_request_with_copilot`.
- The feature is public preview and subject to change.

Swarm Bot wraps that path instead of pretending there is a stable private Copilot API.

For Copilot-as-brain behavior, use the separate `copilot-cli` brain provider. This keeps reasoning guidance separate from background PR delegation.

## MCP Integration

`McpBridge` supports:

- HTTP JSON-RPC MCP servers.
- stdio JSON-RPC MCP servers.
- `tools/list`.
- `tools/call`.

Use `config/mcp.servers.example.json` as the starting point.

`McpHealthRegistry` adds OpenChimera-style health tracking with failure counts and exponential backoff. `HookPipeline` supports pre/post tool policy hooks for allowlists and blocked capabilities.

## Task Loop

The task loop is AppForge/Project-Evo inspired:

1. Detect signals: CI failure, failing tests, benchmark regression, outdated dependencies, missing tests.
2. Generate and dedupe queued tasks.
3. Persist checkpoints before scan/dispatch/complete phases.
4. Ask the configured brain provider for a plan.
5. Run in `plan`, `dry-run`, `apply`, or explicit `delegate-copilot` mode.
6. Persist memory and reflection outcomes.

Commands:

- `scan`
- `queue`
- `next-task`
- `mcp-health`
- `run-loop`
- `sandbox`

## Virtual Sandbox

The sandbox harness simulates user workflows in isolated temporary repositories. It runs real CLI commands and produces a JSON report:

- total scenarios
- pass/warning/fail counts
- per-step command summaries
- generated artifact paths
- suspected bugs with severity and recommendations

Built-in scenarios:

- `first-run-plan`: first-time user runs scan, queue, and plan loop.
- `mcp-degraded`: user configures an unreachable MCP server and sees health degradation.
- `openai-missing-key`: user enables the OpenAI brain provider without `OPENAI_API_KEY` or a token command.

Run it with:

```powershell
npm run sandbox -- --scenario all
```

## Safety Defaults

The agent starts in `plan` mode. Push, PR, Copilot, and MCP side effects are individually gated by environment variables.
