import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { MemoryEvent, ReflectionNote } from "./types.js";

interface MemoryDocument {
  version: 1;
  events: MemoryEvent[];
  reflections: ReflectionNote[];
  counters: Record<string, number>;
}

export class AgentMemory {
  constructor(private readonly file = join("state", "swarm-bot.memory.json")) {}

  load(): MemoryDocument {
    if (!existsSync(this.file)) {
      return { version: 1, events: [], reflections: [], counters: {} };
    }
    const parsed = JSON.parse(readFileSync(this.file, "utf8")) as Partial<MemoryDocument>;
    return {
      version: 1,
      events: parsed.events ?? [],
      reflections: parsed.reflections ?? [],
      counters: parsed.counters ?? {}
    };
  }

  appendEvent(event: MemoryEvent): void {
    const doc = this.load();
    doc.events.push(event);
    doc.counters[event.outcome] = (doc.counters[event.outcome] ?? 0) + 1;
    this.save(doc);
  }

  appendReflection(note: ReflectionNote): void {
    const doc = this.load();
    doc.reflections.push(note);
    this.save(doc);
  }

  recentFailures(limit = 5): MemoryEvent[] {
    return this.load()
      .events.filter((event) => event.outcome === "failure" || event.outcome === "blocked")
      .slice(-limit);
  }

  private save(doc: MemoryDocument): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(doc, null, 2));
  }
}
