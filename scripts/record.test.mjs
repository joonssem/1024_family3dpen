import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { deflateSync, strToU8 } from "fflate";

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL("../src/lib/family-record.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { btoa, atob, Uint8Array, URL })(require, module, module.exports);
const { encodeRecord, decodeRecord, recordUrl, isLocalOnly, recordSections } = module.exports;

const fixture = () => ({
  version: 1, title: "가족 발명소", date: "2026. 10. 24", place: "5층 스마트교실", promise: "함께 나눈 대화가 소중해요.",
  problem: "연필이 굴러가요", firstIdea: "산 모양으로 막자!", invention: "연필 멈춤 산", change: "동그란 받침으로 바꿔요.",
  selected: "연필 멈춤 산", assembly: "바닥을 만들고\n벽을 세워요.", childMemory: "함께해서 좋았어요 💛", parentMemory: "질문하며 함께 만들었어요.",
  parts: [{ name: "받침", shape: "6cm 동그라미", owner: "학생", done: true }, { name: "벽", shape: "2cm 삼각형", owner: "보호자", done: false }],
});

test("Korean, emoji, line breaks, ownership and completion survive QR payload round trip", () => {
  const record = fixture(); assert.deepEqual(JSON.parse(JSON.stringify(decodeRecord(encodeRecord(record)))), record);
});

test("record stays in URL fragment, never in the request path or query", () => {
  const url = new URL(recordUrl(fixture(), "https://workshop.example"));
  assert.equal(url.pathname, "/record"); assert.equal(url.search, "");
  assert.deepEqual(JSON.parse(JSON.stringify(decodeRecord(url.hash))), fixture());
});

test("generated QR can be decoded back to the complete record", () => {
  const url = recordUrl(fixture(), "https://workshop.example");
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const scale = 5, quiet = 4, side = (qr.modules.size + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) {
    if (!qr.modules.get(y, x)) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
    }
  }
  assert.equal(jsQR(pixels, side, side)?.data, url);
});

test("empty optional entries can be shared without inventing a family name", () => {
  const record = fixture();
  for (const key of ["problem", "firstIdea", "invention", "change", "selected", "assembly", "childMemory", "parentMemory"]) record[key] = "";
  record.parts = [];
  assert.equal(decodeRecord(encodeRecord(record)).invention, "");
  assert.ok(recordSections(record).every(section => section.body.length > 0));
});

for (const token of ["", "v2.test", "#v1.invalid!", "v1.a", "v1." + "a".repeat(5001)]) {
  test(`invalid fragment is rejected (${token.length} characters)`, () => assert.throws(() => decodeRecord(token)));
}

test("valid compression with wrong record structure is rejected", () => {
  const compressed = deflateSync(strToU8(JSON.stringify({ version: 1, title: "missing fields" })));
  assert.throws(() => decodeRecord("v1." + Buffer.from(compressed).toString("base64url")));
});

test("oversized decompressed payload is rejected", () => {
  const compressed = deflateSync(strToU8(JSON.stringify({ ...fixture(), problem: "가".repeat(100000) })));
  assert.throws(() => decodeRecord("v1." + Buffer.from(compressed).toString("base64url")));
});

test("invalid field lengths and part counts are rejected before sharing", () => {
  assert.throws(() => encodeRecord({ ...fixture(), problem: "가".repeat(51) }));
  assert.throws(() => encodeRecord({ ...fixture(), parts: Array(4).fill(fixture().parts[0]) }));
});

test("all image sections retain entered text and partial completion", () => {
  const record = fixture(); const sections = recordSections(record).map(s => s.body).join("\n");
  for (const key of ["problem", "firstIdea", "invention", "change", "selected", "assembly", "childMemory", "parentMemory"]) assert.ok(sections.includes(record[key]));
  assert.ok(sections.includes("도전 중")); assert.ok(sections.includes("보호자"));
});

test("loopback addresses are distinguished from reachable school or deployed addresses", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]) assert.equal(isLocalOnly(host), true);
  for (const host of ["192.168.1.5", "family.vercel.app"]) assert.equal(isLocalOnly(host), false);
});
