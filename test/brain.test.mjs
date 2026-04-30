import test from "node:test";
import assert from "node:assert/strict";
import { StaticBrain, buildBrainPrompt, buildCopilotBrainArgs } from "../dist/index.js";

test("buildCopilotBrainArgs calls Copilot CLI as a reasoning provider, not a task delegate", () => {
  assert.deepEqual(buildCopilotBrainArgs("think", { model: "gpt-5.2", effort: "medium" }), [
    "-p",
    "think",
    "--silent",
    "--no-ask-user",
    "--deny-tool=shell",
    "--deny-tool=write",
    "--model",
    "gpt-5.2",
    "--effort",
    "medium"
  ]);
});

test("buildBrainPrompt explicitly forbids file edits and command execution", () => {
  const prompt = buildBrainPrompt({ objective: "fix tests", context: "npm test failed", constraints: ["small PR"] });
  assert.match(prompt, /reasoning brain/i);
  assert.match(prompt, /Do not edit files or run commands/i);
});

test("StaticBrain returns deterministic fallback plans", async () => {
  const response = await new StaticBrain().think({ objective: "fix tests", context: "failure", constraints: ["verify"] });
  assert.equal(response.provider, "static");
  assert.deepEqual(response.plan, ["verify"]);
});
