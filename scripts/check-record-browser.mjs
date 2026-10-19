// 먼저 npm run dev로 앱을 실행합니다. 실제 보호자 기록이나 외부 서비스는 사용하지 않습니다.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import jsQR from "jsqr";

const qrRequire = createRequire(import.meta.resolve("qrcode"));
const { PNG } = qrRequire("pngjs");
const executablePath = process.env.BROWSER_PATH || (process.platform === "win32" && existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
  ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const base = new URL(process.argv[2] || "http://localhost:3000");
if (["localhost", "127.0.0.1"].includes(base.hostname)) {
  const lan = Object.values(networkInterfaces()).flat().find(address => address.family === "IPv4" && !address.internal);
  if (!lan) throw new Error("Use a school-network or deployment URL for QR testing");
  base.hostname = lan.address;
}
const origin = base.origin;
const browser = await chromium.launch({ headless: true, executablePath });
const output = new URL("../artifacts/record-qa/", import.meta.url);
await mkdir(output, { recursive: true });
let activePage;
try {
  const context = await browser.newContext({ viewport: { width: 810, height: 1080 } });
  await context.route("https://cdn.jsdelivr.net/**", route => route.abort());
  const page = await context.newPage();
  activePage = page;
  const failures = [];
  page.on("pageerror", error => failures.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  const nav = page.getByRole("navigation", { name: "수업 단계" });
  await nav.getByRole("button", { name: /불편 발견/ }).click();
  await page.getByLabel("우리 가족이 발견한 불편 한 가지").fill("연필이 굴러가요");
  await page.getByLabel("아이의 첫 생각").fill("작은 산으로 막아 보자!");
  await nav.getByRole("button", { name: /아이디어 설계/ }).click();
  await page.getByLabel("우리가 만들 발명품 이름").fill("우리 가족 연필 산");
  await page.getByLabel("우리 생각으로 바꾸고 싶은 점").fill("산 옆에 작은 길도 만들어요.");
  await nav.getByRole("button", { name: /함께 만들기/ }).click();
  await page.getByRole("heading", { name: /안전한 순간이/ }).waitFor();
  await page.getByRole("button", { name: "교사 큰 화면" }).click();
  await nav.getByRole("button", { name: /함께 만들기/ }).click();
  await page.getByRole("button", { name: "가족 화면으로" }).click();
  await page.getByRole("heading", { name: /안전한 순간이/ }).waitFor();
  for (const box of await page.locator(".safety-grid input").all()) await box.check();
  await nav.getByRole("button", { name: /함께 만들기/ }).click();
  await page.getByLabel("1번 조각 이름").fill("받침");
  await page.getByLabel("1번 조각 모양").fill("6cm 네모");
  await page.getByLabel("1번 조각 담당").selectOption("학생");
  await page.getByLabel("1번 조각 완성").check();
  await page.getByRole("button", { name: /02 \/ 세우고 조립하기/ }).click();
  await page.getByLabel("우리의 조립 순서").fill("받침 위에 산을 세워요.");
  await nav.getByRole("button", { name: /추억 남기기/ }).click();
  await page.getByLabel("학생의 한마디").fill("함께 만들어서 즐거웠어요 💛");
  await page.getByLabel("보호자의 한마디").fill("아이의 새로운 생각을 발견했어요.");
  assert.ok(!(await page.locator("body").innerText()).includes("7가족"));
  assert.equal(await page.getByRole("button", { name: /인쇄|PDF/ }).count(), 0);
  await page.getByRole("button", { name: /우리 가족 기록 QR로 가져가기/ }).click();
  const qr = page.getByAltText("보호자 스마트폰으로 활동 기록을 여는 QR코드");
  await qr.waitFor();
  // 원본 QR뿐 아니라 실제 태블릿에 표시된 크기에서도 판독되는지 확인합니다.
  const bytes = await qr.screenshot();
  const png = PNG.sync.read(bytes);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(decoded?.data.startsWith(origin + "/record#v1."));
  await page.getByRole("link", { name: /기록 이미지 저장/ }).waitFor();
  await page.locator(".record-share").screenshot({ path: fileURLToPath(new URL("tablet-share.png", output)) });

  const mobile = await context.newPage();
  activePage = mobile;
  await mobile.setViewportSize({ width: 390, height: 844 });
  const requestedUrls = [];
  mobile.on("request", request => requestedUrls.push(request.url()));
  await mobile.goto(decoded.data, { waitUntil: "domcontentloaded" });
  const save = mobile.getByRole("link", { name: "기록 이미지 저장" });
  await save.waitFor();
  const downloadEvent = mobile.waitForEvent("download");
  await save.click();
  const download = await downloadEvent;
  await download.saveAs(fileURLToPath(new URL("family-record.png", output)));
  assert.ok(!requestedUrls.some(url => url.includes("v1.")));
  assert.ok(!requestedUrls.some(url => url.includes("%EC%97%B0%ED%95%84")));
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false);
  await mobile.screenshot({ path: fileURLToPath(new URL("phone-record.png", output)), fullPage: true });
  await mobile.reload({ waitUntil: "domcontentloaded" });
  await mobile.getByRole("link", { name: "기록 이미지 저장" }).waitFor();

  await page.getByRole("button", { name: "새 가족으로 시작" }).click();
  await page.getByRole("button", { name: "지우고 시작" }).click();
  await page.getByRole("heading", { name: /오늘은 우리가/ }).waitFor();
  // 수업 iPad를 초기화해도 이미 스마트폰에 전달한 링크는 유효합니다.
  await mobile.reload({ waitUntil: "domcontentloaded" });
  await mobile.getByRole("link", { name: "기록 이미지 저장" }).waitFor();
  await mobile.goto(origin + "/record#broken", { waitUntil: "domcontentloaded" });
  await mobile.locator('.record-receiver [role="alert"]').waitFor();
  assert.equal(await mobile.getByRole("link", { name: "기록 이미지 저장" }).count(), 0);
  assert.deepEqual(failures, []);
  await writeFile(new URL("result.txt", output), "PASS: safety mode switch, QR scan, phone PNG download, refresh, reset independence, invalid link, mobile layout\n");
  console.log("PASS: tablet QR -> phone PNG download, safety switch, refresh, reset, invalid link, mobile layout");
} catch (error) {
  if (activePage) {
    await activePage.screenshot({ path: fileURLToPath(new URL("failure.png", output)), fullPage: true }).catch(() => {});
    await writeFile(new URL("failure.txt", output), await activePage.locator("body").innerText()).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
