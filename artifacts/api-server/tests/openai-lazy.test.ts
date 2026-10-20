import test from "node:test";
import assert from "node:assert/strict";

delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

// The API imports this at startup, so it must not need AI credentials just to load.
const { openai } = await import("@workspace/integrations-openai-ai-server");

test("a missing AI key fails the AI request, not application startup", () => {
  assert.throws(() => openai.chat, /AI_INTEGRATIONS_OPENAI_BASE_URL must be set/);
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://ai.example.test/v1";
  assert.throws(() => openai.chat, /AI_INTEGRATIONS_OPENAI_API_KEY must be set/);
});

test("with credentials the shared client is created once against the configured endpoint", () => {
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "sk-test-only";
  assert.equal(openai.baseURL, "https://ai.example.test/v1");
  assert.equal(typeof openai.chat.completions.create, "function");
  assert.equal(openai.chat, openai.chat);
});
