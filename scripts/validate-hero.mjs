import { chromium } from "playwright";

const SCRATCH = process.env.SCRATCH ?? "/tmp";
const results = [];
const ok = (name, cond, detail = "") => {
  results.push(`${cond ? "PASS" : "FAIL"}: ${name} ${detail}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const failed = [];
page.on("requestfailed", (r) => {
  const err = r.failure()?.errorText;
  // seeking a <video> aborts in-flight range requests; that's normal, not a failure
  if (err === "net::ERR_ABORTED" && r.url().endsWith(".mp4")) return;
  failed.push(r.url() + " " + err);
});

const resp = await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
ok("page loads 200", resp.status() === 200, `(${resp.status()})`);

const video = page.locator('[data-testid="hero-video"]');
ok("video element present", (await video.count()) === 1);

// wait for video to be ready and playing
await page.waitForFunction(() => {
  const v = document.querySelector('[data-testid="hero-video"]');
  return v && v.readyState >= 3 && !v.paused && v.currentTime > 0;
}, { timeout: 30000 });

const state = await page.evaluate(() => {
  const v = document.querySelector('[data-testid="hero-video"]');
  return {
    readyState: v.readyState,
    paused: v.paused,
    muted: v.muted,
    loop: v.loop,
    duration: v.duration,
    videoWidth: v.videoWidth,
    videoHeight: v.videoHeight,
    currentSrc: v.currentSrc,
  };
});
ok("video ready (readyState>=3)", state.readyState >= 3, `(${state.readyState})`);
ok("video playing (not paused)", !state.paused);
ok("video muted", state.muted);
ok("video loop enabled", state.loop);
ok("duration ~21.8s (tennis + sunset cut)", Math.abs(state.duration - 21.76) < 1, `(${state.duration.toFixed(2)}s)`);
ok("resolution 1920x1080", state.videoWidth === 1920 && state.videoHeight === 1080, `(${state.videoWidth}x${state.videoHeight})`);

// playback advances
const t1 = await page.evaluate(() => document.querySelector('[data-testid="hero-video"]').currentTime);
await page.waitForTimeout(2000);
const t2 = await page.evaluate(() => document.querySelector('[data-testid="hero-video"]').currentTime);
ok("playback advances", t2 > t1, `(${t1.toFixed(2)} -> ${t2.toFixed(2)})`);

// hero text visible
ok("headline visible", await page.locator("h1", { hasText: "Every strike" }).isVisible());
ok("subheading names the product", await page.locator(".hero-content p", { hasText: "Meet Aurevo" }).isVisible());

// screenshot each segment by seeking (tennis ~0-15.1s, sunset ~15.1-21.8s)
const seeks = [5, 18];
for (const t of seeks) {
  await page.evaluate((tt) => {
    const v = document.querySelector('[data-testid="hero-video"]');
    v.currentTime = tt;
  }, t);
  await page.waitForFunction((tt) => {
    const v = document.querySelector('[data-testid="hero-video"]');
    return v.readyState >= 3 && Math.abs(v.currentTime - tt) < 3;
  }, t, { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SCRATCH}/pw_seg_${t}.png` });
}

// loop wrap: seek near end, confirm it wraps to start
await page.evaluate(() => {
  const v = document.querySelector('[data-testid="hero-video"]');
  v.currentTime = v.duration - 0.5;
});
await page.waitForTimeout(2000);
const wrapped = await page.evaluate(() => document.querySelector('[data-testid="hero-video"]').currentTime);
ok("loops back to start", wrapped < 5, `(currentTime after end: ${wrapped.toFixed(2)})`);

ok("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
ok("no failed requests", failed.length === 0, failed.slice(0, 3).join(" | "));

await browser.close();
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
