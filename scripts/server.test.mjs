// 실제 환경파일을 읽거나 네트워크를 호출하지 않고 서버 소스를 검증합니다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const problem = "연필이 책상에서 자꾸 굴러가요";
const now = Date.parse("2026-10-19T10:00:00+09:00");
const active = {
  NODE_ENV: "development", SOLAR_ENABLED: "true", SOLAR_API_KEY: "test-only-placeholder",
  SOLAR_API_ENDS_AT: "2026-10-24T11:30:00+09:00",
};
const shared = {
  ...active, NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://test-only.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-only-placeholder",
};
const validIdeas = () => ["연필 자리", "작은 받침", "물건 표시"].map(name => ({
  name, problem: "연필을 놓을 자리를 정해요.",
  parts: [{ name: "받침", shape: "6cm 네모 한 장" }], assembly: "평평하게 그리고 식힌 뒤 놓아 봐요.",
}));
const completion = (ideas = validIdeas(), finish = "stop") => Response.json({
  choices: [{ finish_reason: finish, message: { content: JSON.stringify({ ideas }) } }],
});

// 환경·시간·모듈 캐시·fetch는 사례마다 격리합니다. fetch는 대역만 사용합니다.
function harness(env = {}, reply = () => { throw new Error("Unexpected external request"); }) {
  const calls = [];
  const clock = { now };
  const context = vm.createContext({
    process: { env: { ...env } },
    Date: class extends Date { static now() { return clock.now; } },
    Request, Response, URL, AbortSignal, TextDecoder, Uint8Array,
    fetch: async (url, options) => {
      calls.push({ url: String(url), ...options });
      return reply(String(url), options);
    },
  });
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: filename,
    }).outputText;
    const localRequire = specifier => {
      if (specifier.startsWith("@/")) return load(path.join(root, "src", specifier.slice(2) + ".ts"));
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), specifier + ".ts"));
      return require(specifier);
    };
    const execute = vm.runInContext(`(function(require, module, exports) {\n${code}\n})`, context, { filename });
    execute(localRequire, module, module.exports);
    return module.exports;
  }
  const route = load(path.join(root, "src/app/api/ideas/route.ts"));
  return {
    calls, clock,
    reserve: () => load(path.join(root, "src/lib/request-limit.server.ts")).reserveRequest(new AbortController().signal),
    async post(payload = { problem }, headers = {}, raw) {
      const response = await route.POST(new Request("https://workshop.example/api/ideas", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: raw ?? JSON.stringify(payload),
      }));
      return { status: response.status, headers: response.headers, data: await response.json() };
    },
  };
}

function assertPrepared(result, reason) {
  assert.equal(result.status, 200);
  assert.equal(result.data.source, "prepared");
  assert.equal(result.data.reason, reason);
  assert.equal(result.data.ideas.length, 3);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.ok(result.data.ideas.every(idea => idea.parts.length >= 1 && idea.parts.length <= 3));
  assert.ok(!JSON.stringify(result.data).includes(active.SOLAR_API_KEY));
}

test("disabled AI returns prepared cards without external requests", async () => {
  const app = harness(); assertPrepared(await app.post(), "disabled"); assert.equal(app.calls.length, 0);
});

for (const mode of ["two", "simpler"]) {
  test(`${mode} fallback stays within two physical pieces`, async () => {
    const result = await harness().post({ problem, mode });
    assert.ok(result.data.ideas.every(idea => idea.parts.length <= 2));
  });
}

test("different fallback excludes all three previous names", async () => {
  const app = harness(); const first = await app.post();
  const next = await app.post({ problem, mode: "different", previous: first.data.ideas });
  assert.ok(next.data.ideas.every(idea => !first.data.ideas.some(old => old.name === idea.name)));
});

for (const [label, payload, headers, raw, status] of [
  ["blank input", { problem: "  " }, {}, undefined, 400],
  ["51 characters", { problem: "가".repeat(51) }, {}, undefined, 400],
  ["email", { problem: "test@example.com" }, {}, undefined, 400],
  ["phone", { problem: "010-0000-0000" }, {}, undefined, 400],
  ["unknown mode", { problem, mode: "chat" }, {}, undefined, 400],
  ["invalid JSON", {}, {}, "{", 400],
  ["wrong content type", {}, { "Content-Type": "text/plain" }, undefined, 415],
  ["foreign origin", { problem }, { Origin: "https://other.example" }, undefined, 403],
  ["declared oversized body", {}, { "Content-Length": "12001" }, undefined, 413],
  ["actual oversized body", {}, {}, JSON.stringify({ problem: "가".repeat(5000) }), 413],
]) {
  test(`${label} is rejected before any provider call`, async () => {
    const app = harness(active);
    assert.equal((await app.post(payload, headers, raw)).status, status);
    assert.equal(app.calls.length, 0);
  });
}

for (const [label, config, reason] of [
  ["missing key", { SOLAR_API_KEY: "" }, "disabled"],
  ["kill switch", { SOLAR_ENABLED: "false" }, "disabled"],
  ["missing deadline", { SOLAR_API_ENDS_AT: "" }, "unconfigured"],
  ["deadline without timezone", { SOLAR_API_ENDS_AT: "2026-10-24T11:30:00" }, "unconfigured"],
  ["exact deadline", { SOLAR_API_ENDS_AT: "2026-10-19T10:00:00+09:00" }, "expired"],
]) {
  test(`${label} uses fallback without spending a request`, async () => {
    const app = harness({ ...active, ...config });
    assertPrepared(await app.post(), reason); assert.equal(app.calls.length, 0);
  });
}

test("validated Solar success returns three cards without exposing the key", async () => {
  const app = harness(active, () => completion()); const result = await app.post();
  assert.equal(result.data.source, "ai"); assert.deepEqual(result.data.ideas, validIdeas());
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.ok(!JSON.stringify(result.data).includes(active.SOLAR_API_KEY));
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].url, "https://api.upstage.ai/v1/chat/completions");
  const sent = JSON.parse(app.calls[0].body);
  assert.equal(JSON.parse(sent.messages[1].content).problem, problem);
});

for (const [label, reply, mode = "initial", previous = []] of [
  ["provider key failure", () => new Response("provider error", { status: 401 })],
  ["provider timeout", () => { throw new DOMException("Timed out", "TimeoutError"); }],
  ["invalid provider JSON", () => new Response("{")],
  ["oversized provider body", () => new Response("x".repeat(65537))],
  ["truncated completion", () => completion(validIdeas(), "length")],
  ["only two cards", () => completion(validIdeas().slice(0, 2))],
  ["duplicate names", () => { const ideas = validIdeas(); ideas[1].name = ideas[0].name; return completion(ideas); }],
  ["four pieces", () => { const ideas = validIdeas(); ideas[0].parts = Array(4).fill(ideas[0].parts[0]); return completion(ideas); }],
  ["hidden multiple pieces", () => { const ideas = validIdeas(); ideas[0].parts[0].shape = "6cm 벽 두 장"; return completion(ideas); }],
  ["unsafe food container", () => { const ideas = validIdeas(); ideas[0].name = "음식 그릇"; return completion(ideas); }],
  ["oversized centimeters", () => { const ideas = validIdeas(); ideas[0].parts[0].shape = "11cm 네모 한 장"; return completion(ideas); }],
  ["oversized millimeters", () => { const ideas = validIdeas(); ideas[0].parts[0].shape = "101mm 네모 한 장"; return completion(ideas); }],
  ["two-piece mode violation", () => { const ideas = validIdeas(); ideas[0].parts = Array(3).fill(ideas[0].parts[0]); return completion(ideas); }, "two"],
  ["repeated alternative", () => completion(), "different", validIdeas()],
]) {
  test(`${label} returns validated prepared cards`, async () => {
    const result = await harness(active, reply).post({ problem, mode, previous });
    assertPrepared(result, "unavailable");
  });
}

test("eight simultaneous valid requests work with mocked Solar", async () => {
  const app = harness(active, () => completion());
  const results = await Promise.all(Array.from({ length: 8 }, () => app.post()));
  assert.ok(results.every(result => result.data.source === "ai" && result.data.ideas.length === 3));
  assert.equal(app.calls.length, 8);
});

test("local quota includes failed provider requests", async () => {
  const app = harness({ ...active, SOLAR_MAX_REQUESTS_PER_MINUTE: "1" }, () => new Response("", { status: 503 }));
  assertPrepared(await app.post(), "unavailable");
  assertPrepared(await app.post(), "limited"); assert.equal(app.calls.length, 1);
});

test("daily local quota survives minute rollover and resets at Korean midnight", async () => {
  const app = harness({ ...active, SOLAR_MAX_REQUESTS_PER_DAY: "1" }, () => completion());
  assert.equal(await app.reserve(), true); app.clock.now += 60000;
  assert.equal(await app.reserve(), false);
  app.clock.now = Date.parse("2026-10-20T00:00:00+09:00"); assert.equal(await app.reserve(), true);
});

for (const [label, config] of [
  ["missing production counter", { ...active, NODE_ENV: "production" }],
  ["incomplete counter credentials", { ...active, UPSTASH_REDIS_REST_URL: shared.UPSTASH_REDIS_REST_URL }],
  ["incomplete Vercel counter credentials", { ...active, KV_REST_API_URL: shared.UPSTASH_REDIS_REST_URL }],
  ["invalid local quota", { ...active, SOLAR_MAX_REQUESTS_PER_MINUTE: "0" }],
  ["invalid counter host", { ...shared, UPSTASH_REDIS_REST_URL: "https://other.example" }],
  ["invalid counter scope", { ...shared, SOLAR_BUDGET_SCOPE: "invalid scope" }],
]) {
  test(`${label} blocks Solar before external calls`, async () => {
    const app = harness(config); assertPrepared(await app.post(), "unavailable"); assert.equal(app.calls.length, 0);
  });
}

test("shared quota refusal avoids Solar calls", async () => {
  const app = harness(shared, () => Response.json({ result: 0 }));
  assertPrepared(await app.post(), "limited"); assert.equal(app.calls.length, 1);
});

for (const [label, reply] of [
  ["counter failure", () => new Response("", { status: 503 })],
  ["counter invalid response", () => Response.json({ result: "1" })],
  ["counter timeout", () => { throw new DOMException("Timed out", "TimeoutError"); }],
]) {
  test(`${label} stops without contacting Solar`, async () => {
    const app = harness(shared, reply); assertPrepared(await app.post(), "unavailable"); assert.equal(app.calls.length, 1);
  });
}

test("shared quota is reserved atomically and sends no family input", async () => {
  const app = harness(shared, url => url === shared.UPSTASH_REDIS_REST_URL + "/" ? Response.json({ result: 1 }) : completion());
  assert.equal((await app.post()).data.source, "ai"); assert.equal(app.calls.length, 2);
  const counter = JSON.parse(app.calls[0].body);
  assert.equal(counter[0], "EVAL"); assert.equal(counter[2], "2");
  assert.ok(counter[3].includes("{family-2026-10-24}:minute:"));
  assert.ok(counter[4].includes("{family-2026-10-24}:day:"));
  assert.ok(!app.calls[0].body.includes(problem));
  assert.ok(!app.calls[0].body.includes(active.SOLAR_API_KEY));
});

test("Vercel Upstash credentials reserve production quota before calling Solar", async () => {
  const env = {
    ...active, NODE_ENV: "production", KV_REST_API_URL: shared.UPSTASH_REDIS_REST_URL,
    KV_REST_API_TOKEN: "test-vercel-placeholder",
  };
  const app = harness(env, url => url === env.KV_REST_API_URL + "/" ? Response.json({ result: 1 }) : completion());
  assert.equal((await app.post()).data.source, "ai");
  assert.equal(app.calls.length, 2);
  assert.equal(app.calls[0].headers.Authorization, `Bearer ${env.KV_REST_API_TOKEN}`);
  assert.equal(JSON.parse(app.calls[0].body)[0], "EVAL");
});
