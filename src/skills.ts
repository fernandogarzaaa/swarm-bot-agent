import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface LoadedSkill {
  id: string;
  path: string;
  text: string;
}

export function loadSkills(root = "skills"): LoadedSkill[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillPath = join(root, entry.name, "SKILL.md");
      return existsSync(skillPath)
        ? { id: entry.name, path: skillPath, text: readFileSync(skillPath, "utf8") }
        : undefined;
    })
    .filter((skill): skill is LoadedSkill => Boolean(skill));
}
