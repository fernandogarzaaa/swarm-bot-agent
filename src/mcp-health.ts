import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { McpBridge } from "./mcp.js";
import { McpConfig } from "./types.js";

export interface McpHealthEntry {
  id: string;
  status: "healthy" | "unhealthy" | "disabled";
  checkedAt: string;
  failureCount: number;
  lastError?: string;
  nextProbeAt?: string;
}

interface HealthDocument {
  version: 1;
  servers: Record<string, McpHealthEntry>;
}

export class McpHealthRegistry {
  private readonly bridge: McpBridge;

  constructor(private readonly config: McpConfig, private readonly file = "state/mcp-health.json") {
    this.bridge = new McpBridge(config);
  }

  list(): McpHealthEntry[] {
    return Object.values(this.load().servers).sort((a, b) => a.id.localeCompare(b.id));
  }

  async probe(serverId: string): Promise<McpHealthEntry> {
    const server = this.config.servers[serverId];
    const previous = this.load().servers[serverId];
    if (!server || server.enabled === false) {
      return this.persist(serverId, { status: "disabled", failureCount: previous?.failureCount ?? 0 });
    }
    if (previous?.nextProbeAt && Date.parse(previous.nextProbeAt) > Date.now()) {
      return previous;
    }
    try {
      await this.bridge.listTools(serverId);
      return this.persist(serverId, { status: "healthy", failureCount: 0 });
    } catch (error) {
      const failureCount = (previous?.failureCount ?? 0) + 1;
      const backoffMs = Math.min(300000, 1000 * 2 ** Math.min(failureCount, 8));
      return this.persist(serverId, {
        status: "unhealthy",
        failureCount,
        lastError: error instanceof Error ? error.message : String(error),
        nextProbeAt: new Date(Date.now() + backoffMs).toISOString()
      });
    }
  }

  async probeAll(): Promise<McpHealthEntry[]> {
    const ids = Object.keys(this.config.servers);
    const results: McpHealthEntry[] = [];
    for (const id of ids) results.push(await this.probe(id));
    return results;
  }

  private load(): HealthDocument {
    if (!existsSync(this.file)) return { version: 1, servers: {} };
    const parsed = JSON.parse(readFileSync(this.file, "utf8")) as Partial<HealthDocument>;
    return { version: 1, servers: parsed.servers ?? {} };
  }

  private persist(serverId: string, patch: Partial<McpHealthEntry>): McpHealthEntry {
    const document = this.load();
    const entry: McpHealthEntry = {
      id: serverId,
      status: patch.status ?? "unhealthy",
      checkedAt: new Date().toISOString(),
      failureCount: patch.failureCount ?? 0,
      lastError: patch.lastError,
      nextProbeAt: patch.nextProbeAt
    };
    document.servers[serverId] = entry;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(document, null, 2));
    return entry;
  }
}
