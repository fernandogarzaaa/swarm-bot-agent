# Extraction Sources

Local sources inspected:

- `D:\appforge-main\scripts\swarm_controller.ts`
- `D:\appforge-main\scripts\swarm_result_selector.ts`
- `D:\appforge-main\swarm\core\mcp_tool_registry.ts`
- `D:\appforge-main\swarm\core\persistent_memory.ts`
- `D:\project-evo\sdk\swarm_orchestrator.py`
- `D:\project-evo\swarms\agents\coder.py`
- `D:\project-evo\mcp_server.py`
- `D:\OpenChimera\core\mcp_registry.py`
- `D:\OpenChimera\core\mcp_server.py`
- `D:\chimeralang-mcp-v2-openai\.mcp.json`
- `D:\chimeralang-mcp-v2-openai\chimeralang_mcp\server.py`
- `D:\AegisSwarm\gateway\gateway.py`
- `D:\AegisSwarm\swarms\devops.py`

Seraph findings:

- `D:\OpenChimera\LEGACY_INTEGRATIONS.md` lists Project Seraph as memory-recovered lineage.
- `D:\OpenChimera\config\subsystems.json` describes Project Seraph as a personal swarm, voice bridge, and desktop telemetry interface.
- `D:\OpenChimera\rag_storage.json` contains recovered notes for `project_seraph.py`, webcam presence detection, Windows voice bridge, desktop telemetry, and `aether_web_bridge.html`.
- `D:\AegisSwarm\gateway\gateway.py` connects to Seraph over ZMQ at `tcp://127.0.0.1:5560`.
- Focused filename searches did not find a live `project_seraph.py` in the scanned roots.

GitHub Copilot references:

- GitHub Docs: Copilot cloud agent can be started from the GitHub CLI with `gh agent-task create`.
- GitHub Docs: remote GitHub MCP can expose `create_pull_request_with_copilot`.
- GitHub Docs: Copilot cloud agent is in public preview and has branch/permission restrictions.
