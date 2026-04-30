# swarm-bot-agent

Standalone extraction of the AppForge swarm-bot into a guarded autonomous pull-request agent.

## What It Does

- Maintains a persistent agent identity and memory.
- Records reflection notes after successful and failed runs.
- Calls configured MCP servers over stdio or HTTP JSON-RPC.
- Uses GitHub CLI for repo checks, branch work, pushes, and pull requests.
- Can delegate tasks to GitHub Copilot cloud agent through `gh agent-task create`.
- Keeps side effects behind explicit environment-variable guards.

## Quick Start

```powershell
npm install
npm run build
node dist/cli.js self-check --repo D:\appforge-qa --mcp config\mcp.servers.example.json
```

Plan-only run:

```powershell
node dist/cli.js run --repo D:\appforge-qa --mode plan --title "Inspect repo" --body "Record evidence without changes."
```

Copilot delegation:

```powershell
$env:SWARM_ALLOW_COPILOT="true"
node dist/cli.js run --repo D:\target-repo --mode delegate-copilot --title "Fix CI" --body "Investigate failures and open a PR."
```

Signal and queue workflow:

```powershell
node dist/cli.js scan --repo D:\target-repo
node dist/cli.js queue --repo D:\target-repo
node dist/cli.js next-task
node dist/cli.js run-loop --repo D:\target-repo --mode plan
```

MCP health:

```powershell
node dist/cli.js mcp-health --mcp config\mcp.servers.example.json
```

Brain provider mode:

```powershell
$env:SWARM_BRAIN_PROVIDER="openai"
$env:SWARM_ALLOW_OPENAI_BRAIN="true"
$env:OPENAI_API_KEY="<server-side secret>"
node dist/cli.js run-loop --repo D:\target-repo --mode plan
```

Copilot as a reasoning brain:

```powershell
$env:SWARM_BRAIN_PROVIDER="copilot-cli"
$env:SWARM_ALLOW_COPILOT_BRAIN="true"
node dist/cli.js run-loop --repo D:\target-repo --mode plan
```

For a sign-in or OAuth-backed app, provide a command that prints a short-lived bearer token:

```powershell
$env:SWARM_OPENAI_TOKEN_COMMAND="my-auth-helper get-openai-token"
```

Direct PR mode requires all relevant guards:

```powershell
$env:SWARM_ALLOW_PUSH="true"
$env:SWARM_ALLOW_PR="true"
node dist/cli.js run --repo D:\target-repo --mode apply --title "Swarm fix" --body "Commit existing local changes and open a PR."
```

## Notes

This project does not claim literal machine consciousness. It implements the engineering surface that can be tested: identity, memory, self-model state, reflection, mistake tracking, skills, policy guards, and tool use.

See `docs/ARCHITECTURE.md` and `docs/EXTRACTION_SOURCES.md` for the extraction map.
