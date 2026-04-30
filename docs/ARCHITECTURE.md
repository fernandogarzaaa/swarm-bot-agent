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

## GitHub Copilot Integration

GitHub's current supported automation path is the Copilot cloud agent:

- `gh agent-task create` can ask Copilot to open a pull request.
- Remote GitHub MCP can expose `create_pull_request_with_copilot`.
- The feature is public preview and subject to change.

Swarm Bot wraps that path instead of pretending there is a stable private Copilot API.

## MCP Integration

`McpBridge` supports:

- HTTP JSON-RPC MCP servers.
- stdio JSON-RPC MCP servers.
- `tools/list`.
- `tools/call`.

Use `config/mcp.servers.example.json` as the starting point.

## Safety Defaults

The agent starts in `plan` mode. Push, PR, Copilot, and MCP side effects are individually gated by environment variables.
