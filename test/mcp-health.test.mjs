import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HookPipeline, McpHealthRegistry, createMcpPolicyHook } from "../dist/index.js";

test("McpHealthRegistry probes HTTP MCP servers and records healthy state", async () => {
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk.toString()));
    req.on("end", () => {
      const payload = JSON.parse(raw);
      const result =
        payload.method === "initialize"
          ? { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "mock", version: "1" } }
          : { tools: [] };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const registry = new McpHealthRegistry(
    {
      servers: {
        mock: {
          transport: "http",
          url: `http://127.0.0.1:${address.port}/mcp`,
          enabled: true
        }
      }
    },
    join(mkdtempSync(join(tmpdir(), "swarm-bot-mcp-")), "health.json")
  );

  const result = await registry.probe("mock");
  assert.equal(result.status, "healthy");
  assert.equal(registry.list()[0].failureCount, 0);
  server.close();
});

test("HookPipeline blocks disallowed tool calls before execution", () => {
  const hooks = new HookPipeline();
  hooks.registerPre(createMcpPolicyHook({ allowedTools: ["chimera_csm"], blockedCapabilities: ["file_write"] }));

  assert.equal(hooks.executePre("chimera_csm", {}).action, "pass");
  const blocked = hooks.executePre("dangerous_file_write", {});
  assert.equal(blocked.action, "block");
  assert.match(blocked.reason, /not allowed|blocked/i);
});
