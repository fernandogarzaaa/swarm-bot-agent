# Copilot Instructions

This repository contains Swarm Bot, a guarded autonomous pull-request agent.

Rules:

- Preserve the boundary that Swarm Bot is not literally conscious.
- Implement self-awareness as inspectable identity, memory, reflection, self-model, and policy state.
- Keep side effects behind explicit guards.
- Prefer small PRs with tests.
- Run `npm run ci` before finishing.
- Do not commit `dist/`, `node_modules/`, `state/`, or local MCP configs.
- When adding MCP capabilities, keep the initialization pipeline intact: `initialize`, `notifications/initialized`, then tool calls.
- Use token-saving MCP tools such as `chimera_csm`, `chimera_mode`, and `chimera_budget_lock` for long prompts or planning tasks.
- When Swarm Bot uses GitHub Copilot as a brain, treat Copilot CLI output as modular reasoning guidance. Do not convert that into autonomous delegation unless the operator explicitly selects a delegation mode.
- For OpenAI-backed brain providers, read credentials only from server-side environment variables or token-provider commands. Never write API keys or OAuth tokens to repository files.
