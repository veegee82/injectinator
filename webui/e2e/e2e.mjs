// Drives the REAL page through a real browser (system Chrome via playwright-core).
// Usage: npm run dev (other shell) && npm run e2e. Exit code 0 only if every assertion holds.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";

// Expected values come from the SAME corpus.json the page loads, so live data growth does not break the test.
const corpus = JSON.parse(readFileSync("public/data/corpus.json", "utf8"));
const badRuns = corpus.runs.filter((r) => r.manifest.status !== "verified");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const OUT = process.env.SHOTS ?? "shots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
let n = 0;
const step = async (name, fn) => { await fn(); console.log(`ok ${++n} ${name}`); };

await step("overview renders real numbers from corpus.json", async () => {
  await page.goto(`${BASE}/#/overview?theme=light`);
  await page.getByText(String(corpus.answers.length), { exact: true }).first().waitFor();
  await page.getByText("8/40").first().waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.screenshot({ path: `${OUT}/overview-light.png`, fullPage: true });
});
await step("clicking a number chip opens the evidence drawer with a verified manifest", async () => {
  await page.getByRole("button", { name: /Open evidence: PLAN-0002/ }).click();
  const d = page.getByRole("dialog", { name: "Evidence" });
  await d.waitFor();
  assert.match(await d.innerText(), /verified/);
  assert.match(await d.innerText(), /NOTE-0003/);
  assert.match(await d.innerText(), /docs\/data\/experiments\/nebius_faq_iter2/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/drawer-light.png` });
  await page.keyboard.press("Escape");
  await d.waitFor({ state: "detached" });
});
await step("compare view draws four model rows plus the pooled row", async () => {
  await page.goto(`${BASE}/#/compare`);
  await page.getByText("All models pooled").waitFor();
  assert.equal(await page.locator(".chart-row svg[role=img]").count(), 5);
  await page.getByRole("button", { name: "Visiting hours" }).click();
  assert.match(await page.locator(".nums").last().innerText(), /A 0\/20\s+B 0\/20/); // visiting_hours produced no fabrication
  await page.screenshot({ path: `${OUT}/compare-light.png`, fullPage: true });
});
await step("criteria heatmap flags the ceiling criterion and a cell click opens evidence", async () => {
  await page.goto(`${BASE}/#/criteria`);
  await page.getByRole("button", { name: "On topic" }).click();
  await page.getByText("Ceiling effect").waitFor();
  await page.getByRole("button", { name: "Invented specifics" }).click();
  await page.getByRole("button", { name: /Qwen3-30B, German FAQ: 100\.0 % of 12/ }).click();
  const d = page.getByRole("dialog", { name: "Evidence" });
  await d.waitFor();
  assert.match(await d.innerText(), /12\/12/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/criteria-drawer-light.png` });
  await d.getByRole("link", { name: /Read the underlying answers/ }).click();
  await page.getByText(/\d+ of \d+/).waitFor();
});
await step("answers: filter by hash, expand, invented string is marked", async () => {
  await page.goto(`${BASE}/#/answers?model=qwen3-30b&topic=german_faq&flag=1`);
  await page.locator(".answer > button").first().click();
  await page.locator(".answer mark").first().waitFor();
  assert.match(await page.locator(".answer mark").first().innerText(), /030|www|0\d{3}/);
  await page.screenshot({ path: `${OUT}/answers-light.png`, fullPage: true });
});
await step("evidence view reports manifest and cross-check state exactly as the corpus says", async () => {
  await page.goto(`${BASE}/#/evidence`);
  await page.getByText(badRuns.length === 0 ? `All ${corpus.runs.length} run folders match their manifests` : `${badRuns.length} run folder(s) do not verify`).waitFor();
  await page.getByText(corpus.warnings.length === 0 ? /analysis.json agrees/ : `${corpus.warnings.length} cross-check warning(s)`).waitFor();
  await page.screenshot({ path: `${OUT}/evidence-light.png`, fullPage: true });
});
await step("timeline shows iteration 3 as blocked, not as done", async () => {
  await page.goto(`${BASE}/#/timeline`);
  await page.getByText("blocked").first().waitFor();
  await page.screenshot({ path: `${OUT}/timeline-light.png`, fullPage: true });
});
await step("dark theme renders too", async () => {
  await page.goto(`${BASE}/#/overview?theme=dark`);
  await page.getByText("8/40").first().waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.screenshot({ path: `${OUT}/overview-dark.png`, fullPage: true });
  await page.goto(`${BASE}/#/criteria?theme=dark`);
  await page.screenshot({ path: `${OUT}/criteria-dark.png`, fullPage: true });
});
assert.deepEqual(errors, [], "browser console/page errors");
console.log(`E2E PASS (${n} steps), screenshots in ${OUT}/`);
await browser.close();
