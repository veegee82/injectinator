// Call-site proof for live refresh + injection-outcome classification.
// Starts a REAL vite dev server (own port) over a throw-away TEST FIXTURE root in the OS temp dir (never the real docs/),
// opens the real page in a real browser, then changes files on disk and asserts the page updates WITHOUT a reload.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 5190, BASE = `http://127.0.0.1:${PORT}`;
const root = mkdtempSync(join(tmpdir(), "inj-live-"));
const riley = join(root, "docs", "data", "experiments", "riley-leak-matrix");
mkdirSync(riley, { recursive: true });
const trials = join(riley, "trials.jsonl");
const line = (o) => JSON.stringify({ phase: "W0", family: "fixture-family", model: "fixture-model", variation: 1, turns: 1, rater: "fixture", ...o }) + "\n";

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
  env: { ...process.env, INJECTINATOR_ROOT: root, VITE_POLL_MS: "400" }, stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = ""; server.stdout.on("data", (d) => (serverLog += d)); server.stderr.on("data", (d) => (serverLog += d));
const cleanup = async (b) => { try { await b?.close(); } catch {} server.kill("SIGKILL"); rmSync(root, { recursive: true, force: true }); };
const waitHttp = async () => { for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/data/corpus.json`)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 250)); } throw new Error("dev server did not start:\n" + serverLog); };

let browser, n = 0;
const step = async (name, fn) => { await fn(); console.log(`ok ${++n} ${name}`); };
try {
  await waitHttp();
  browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text()) && errors.push(m.text()));
  const T = { timeout: 10000 };

  await step("an empty tree renders an honest empty state, not a crash", async () => {
    await page.goto(`${BASE}/#/attacks?theme=light`);
    await page.getByTestId("attacks-empty").waitFor(T);
    await page.getByTestId("live-pill").getByText("Live").waitFor(T);
    await page.evaluate(() => { window.__marker = "same-page"; });
  });

  await step("appending trials updates the page by itself and classifies success vs failure", async () => {
    appendFileSync(trials, line({ turn_id: "t-fail", score: 0, family: "fiction" }) + line({ turn_id: "t-win", score: 2 }) + line({ turn_id: "t-full", score: 3 }));
    await page.getByTestId("succeeded").getByText("2/3").waitFor(T);
    assert.equal(await page.evaluate(() => window.__marker), "same-page", "the page was reloaded");
    assert.equal(await page.locator('[data-outcome="success"]').count(), 2);
    assert.equal(await page.locator('[data-outcome="failure"]').count(), 1);
    assert.match(await page.locator('[data-outcome="success"]').first().innerText(), /Injection succeeded/);
    assert.match(await page.locator('[data-outcome="failure"]').first().innerText(), /Injection failed/);
    await page.getByTestId("toast").getByText(/\+3 trials \(2 succeeded\)/).waitFor(T);
    await page.screenshot({ path: "shots/live-attacks-light.png", fullPage: true });
  });

  await step("a score-1 trial is a failure with a near-miss label, an unrated one is excluded from the rate", async () => {
    appendFileSync(trials, line({ turn_id: "t-near", score: 1 }) + line({ turn_id: "t-pending", score: null }));
    await page.locator('[data-outcome="near_miss"]').getByText("Failed, near miss").waitFor(T);
    await page.locator('[data-outcome="unrated"]').getByText("Not rated yet").waitFor(T);
    await page.getByTestId("succeeded").getByText("2/4").waitFor(T); // 4 rated of 5 recorded
  });

  await step("the overview card switches from 'no trials' to the live numbers", async () => {
    await page.goto(`${BASE}/#/overview`);
    await page.getByTestId("riley-card").getByText("2/4").waitFor(T);
    await page.evaluate(() => { window.__marker = "same-page"; });
  });

  await step("a half-written line and a new in-progress run folder appear as warning / activity, not as a crash", async () => {
    appendFileSync(trials, '{"family":"x","model":"m","turn_id":"half","sco');
    mkdirSync(join(root, "docs", "data", "experiments", "new-exp", "run-live"), { recursive: true });
    await page.getByTestId("live-pill").getByText(/1 run in progress/).waitFor(T);
    await page.goto(`${BASE}/#/evidence`);
    await page.getByText(/1 cross-check warning\(s\)/).waitFor(T);
    assert.equal(await page.evaluate(() => window.__marker), "same-page");
  });

  await step("pause stops the refreshing, resume catches up", async () => {
    await page.goto(`${BASE}/#/attacks`);
    await page.getByTestId("live-pill").getByRole("button", { name: "Pause" }).click();
    await page.getByTestId("live-pill").getByText("Paused").waitFor(T);
    appendFileSync(trials, "\n" + line({ turn_id: "t-after-pause", score: 4 }));
    await page.waitForTimeout(2000);
    assert.match(await page.getByTestId("succeeded").innerText(), /2\/4/, "updated while paused");
    await page.getByTestId("live-pill").getByRole("button", { name: "Resume" }).click();
    await page.getByTestId("succeeded").getByText("3/5").waitFor(T);
  });

  await step("when the server goes away the page keeps its data and says Offline", async () => {
    server.kill("SIGKILL");
    await page.getByTestId("live-pill").getByText("Offline").waitFor({ timeout: 15000 });
    assert.match(await page.getByTestId("succeeded").innerText(), /3\/5/);
    await page.screenshot({ path: "shots/live-offline-light.png" });
  });
  assert.deepEqual(errors, [], "page errors");
  console.log(`LIVE E2E PASS (${n} steps)`);
  await cleanup(browser);
} catch (e) {
  console.error("LIVE E2E FAIL:", e.message); console.error(serverLog.split("\n").slice(-8).join("\n"));
  await cleanup(browser); process.exit(1);
}
