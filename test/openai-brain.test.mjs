import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIBrain } from "../dist/index.js";

const basePolicy = {
  mode: "plan",
  repoPath: process.cwd(),
  baseBranch: "main",
  branchPrefix: "swarm-bot",
  allowPush: false,
  allowPr: false,
  allowMcp: true,
  allowCopilot: false,
  maxChangedFiles: 12,
  followCopilot: false,
  brainProvider: "openai",
  allowCopilotBrain: false,
  allowOpenAIBrain: true,
  openaiModel: "gpt-4.1-mini",
  openaiBaseUrl: "https://api.openai.com/v1"
};

test("OpenAIBrain calls the Responses API with bearer auth and parses JSON output", async () => {
  const calls = [];
  const brain = new OpenAIBrain(basePolicy, {
    tokenProvider: { async getBearerToken() { return "test-token"; } },
    async fetchImpl(url, init) {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        output_text: JSON.stringify({ summary: "inspect", plan: ["scan", "test"], confidence: 0.82 })
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });

  const result = await brain.think({ objective: "fix ci", context: "lint failed", constraints: ["small PR"] });
  assert.equal(result.provider, "openai");
  assert.deepEqual(result.plan, ["scan", "test"]);
  assert.equal(calls[0].url, "https://api.openai.com/v1/responses");
  assert.equal(calls[0].init.headers.authorization, "Bearer test-token");
});

test("OpenAIBrain requires an explicit side-effect guard", async () => {
  const brain = new OpenAIBrain({ ...basePolicy, allowOpenAIBrain: false }, {
    tokenProvider: { async getBearerToken() { return "test-token"; } },
    async fetchImpl() {
      throw new Error("should not call fetch");
    }
  });

  await assert.rejects(
    () => brain.think({ objective: "fix ci", context: "lint failed", constraints: [] }),
    /SWARM_ALLOW_OPENAI_BRAIN/
  );
});
