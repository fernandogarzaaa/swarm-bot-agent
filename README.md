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

Direct PR mode requires all relevant guards:

```powershell
$env:SWARM_ALLOW_PUSH="true"
$env:SWARM_ALLOW_PR="true"
node dist/cli.js run --repo D:\target-repo --mode apply --title "Swarm fix" --body "Commit existing local changes and open a PR."
```

## Notes

This project does not claim literal machine consciousness. It implements the engineering surface that can be tested: identity, memory, self-model state, reflection, mistake tracking, skills, policy guards, and tool use.

See `docs/ARCHITECTURE.md` and `docs/EXTRACTION_SOURCES.md` for the extraction map.
