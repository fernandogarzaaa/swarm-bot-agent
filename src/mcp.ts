import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { spawn } from "node:child_process";
import { McpConfig, McpServerConfig } from "./types.js";

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export class McpBridge {
  constructor(private readonly config: McpConfig) {}

  listServers(): string[] {
    return Object.entries(this.config.servers)
      .filter(([, server]) => server.enabled !== false)
      .map(([id]) => id);
  }

  async listTools(serverId: string): Promise<unknown> {
    return this.call(serverId, "tools/list", {});
  }

  async callTool(serverId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.call(serverId, "tools/call", { name, arguments: args });
  }

  async call(serverId: string, method: string, params: Record<string, unknown>): Promise<unknown> {
    const server = this.config.servers[serverId];
    if (!server || server.enabled === false) {
      throw new Error(`MCP server is not configured or enabled: ${serverId}`);
    }
    const payload =
      Object.keys(params).length === 0
        ? { jsonrpc: "2.0", id: `${Date.now()}`, method }
        : { jsonrpc: "2.0", id: `${Date.now()}`, method, params };
    const response =
      server.transport === "http" ? await this.callHttp(server, payload) : await this.callStdio(server, payload);
    if (response.error) throw new Error(`MCP ${serverId} ${method} failed: ${response.error.message}`);
    return response.result;
  }

  private callHttp(server: McpServerConfig, payload: unknown): Promise<JsonRpcResponse> {
    if (!server.url) throw new Error("HTTP MCP server requires url.");
    const url = new URL(server.url);
    const body = JSON.stringify(payload);
    const client = url.protocol === "https:" ? httpsRequest : httpRequest;
    return new Promise((resolve, reject) => {
      const req = client(
        url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
            "MCP-Protocol-Version": "2026-07-28"
          }
        },
        (res) => {
          let raw = "";
          res.on("data", (chunk) => (raw += chunk.toString()));
          res.on("end", () => {
            try {
              resolve(JSON.parse(raw) as JsonRpcResponse);
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  private callStdio(server: McpServerConfig, payload: Record<string, unknown>): Promise<JsonRpcResponse> {
    if (!server.command) throw new Error("stdio MCP server requires command.");
    return new Promise((resolve, reject) => {
      const child = spawn(server.command || "", server.args ?? [], {
        cwd: server.cwd,
        shell: false,
        windowsHide: true
      });
      let stdout = "";
      let stderr = "";
      let initialized = false;
      let settled = false;
      const initId = `init-${Date.now()}`;
      const targetId = String(payload.id ?? "");
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGTERM");
        reject(new Error(`MCP stdio timeout: ${stderr || stdout}`));
      }, 15000);

      function finish(value: JsonRpcResponse): void {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill("SIGTERM");
        resolve(value);
      }

      function fail(error: unknown): void {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill("SIGTERM");
        reject(error);
      }

      function send(message: unknown): void {
        child.stdin.write(`${JSON.stringify(message)}\n`);
      }

      function handleResponse(response: JsonRpcResponse): void {
        if (response.id === initId) {
          if (response.error) {
            // Dual-era fallback: server may not support server/discover yet,
            // try legacy initialize handshake.
            send({
              jsonrpc: "2.0",
              id: initId,
              method: "initialize",
              params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "swarm-bot-agent", version: "0.1.0" }
              }
            });
            return;
          }
          initialized = true;
          // MCP 2.0 (2026-07-28): stateless, no notifications/initialized.
          // Attach per-request protocol metadata.
          const payloadWithMeta = {
            ...(payload as Record<string, unknown>),
            params: {
              ...((payload as Record<string, unknown>).params as Record<string, unknown> ?? {}),
              _meta: {
                "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                clientInfo: { name: "swarm-bot-agent", version: "0.1.0" }
              }
            }
          };
          send(payloadWithMeta);
          return;
        }
        if (String(response.id ?? "") === targetId) {
          // Legacy initialize response (dual-era fallback path)
          if (!initialized) {
            initialized = true;
            send({ jsonrpc: "2.0", method: "notifications/initialized" });
            send(payload);
            return;
          }
          finish(response);
        }
      }

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
        const lines = stdout.split(/\r?\n/);
        stdout = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim().startsWith("{")) continue;
          try {
            handleResponse(JSON.parse(line) as JsonRpcResponse);
          } catch (error) {
            fail(error);
          }
        }
      });
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
      child.on("error", (error) => {
        fail(error);
      });
      // MCP 2.0 (2026-07-28): use server/discover instead of initialize.
      // Falls back to legacy initialize if the server does not support it.
      send({
        jsonrpc: "2.0",
        id: initId,
        method: "server/discover",
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            clientInfo: { name: "swarm-bot-agent", version: "0.1.0" }
          }
        }
      });
    });
  }
}
