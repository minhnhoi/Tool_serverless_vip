require("dotenv").config();

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
// --- VIP additions (keeps original structure intact) ---
// Install the stdout/stderr mirror BEFORE anything else writes to the
// terminal so the boot banner is captured and replayed on the web UI.
const terminalCapture = require("./utils/terminalCapture");
terminalCapture.install();

const Job = require("./models/Job");
const PingLog = require("./models/PingLog");
const { seedAdmin } = require("./utils/seedAdmin");

const banner = require("./utils/banner");
const { log } = require("./utils/colorLogger");
const realtimeHooks = require("./utils/realtimeHooks");
const wsServer = require("./utils/wsServer");
const consolePage = require("./utils/consolePage");
const sys = require("./utils/sysMetrics");
const { buffers } = require("./utils/realtimeBus");
const pingScheduler = require("./utils/pingScheduler");
// -------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/Tool_serverless";

mongoose
  .connect(MONGO_URL)
  .then(async () => {
    log.db("mongo", "MongoDB connected");
    await seedAdmin();
    log.ok("seed", "Admin seed verified");
    // Arm per-job ping timers using each job's frontend-configured interval.
    await pingScheduler.startAll();
  })
  .catch((err) => log.err("mongo", err.message || String(err)));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/jobs", require("./routes/jobs"));

// Public terminal snapshot (no auth) so the live console at "/" can
// hydrate immediately on first request. MUST be registered before the
// auth-protected /api/system router below.
app.get("/api/system/terminal", (_req, res) => {
  const snap = terminalCapture.snapshot();
  res.json({
    // boot banner chunks (with original inter-chunk timing) — replayed
    // by the web console as an animated "fresh boot" on every page load.
    preamble: snap.preamble,
    // post-boot rolling runtime output (already in chunks/string form)
    live: snap.live,
    // legacy / convenience field — full text concatenation
    terminal: terminalCapture.snapshotText(),
    metrics: sys.snapshot(),
    pingsRecent: buffers.pings.last(20),
  });
});

// Public, sanitized scheduler snapshot for the live console sidebar.
// Exposes ONLY the fields needed to render the scheduler panel — never
// secrets / headers / keywords / IDs that could leak.
app.get("/api/system/scheduler", async (_req, res) => {
  try {
    const jobs = await Job.find({}, {
      _id: 1, name: 1, url: 1, interval: 1, method: 1,
      status: 1, paused: 1, lastChecked: 1, lastResponseTime: 1
    }).sort({ paused: 1, status: 1, name: 1 }).lean();

    const sanitized = jobs.map((j) => ({
      id: String(j._id).slice(-6),
      name: j.name || "",
      url: j.url,
      interval: j.interval || 1,
      method: j.method || "GET",
      status: j.paused ? "paused" : (j.status || "checking"),
      lastChecked: j.lastChecked || null,
      lastResponseTime: j.lastResponseTime || 0,
    }));

    const summary = {
      total: sanitized.length,
      active: sanitized.filter((j) => j.status === "active").length,
      dead:   sanitized.filter((j) => j.status === "dead").length,
      paused: sanitized.filter((j) => j.status === "paused").length,
      checking: sanitized.filter((j) => j.status === "checking").length,
    };

    res.json({
      jobs: sanitized,
      summary,
      pingsRecent: buffers.pings.last(40),
      latency: buffers.latency.last(60),
      ts: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "scheduler snapshot failed" });
  }
});

app.use("/api/system", require("./routes/system"));

// Home page \u2014 a live PowerShell-style console mirror of the backend
// terminal (banner, boot animation, colored logs, live dashboard).
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(consolePage.html());
});

// Master ping loop has been replaced by a per-job scheduler — see
// utils/pingScheduler.js. Each job is fired on its own timer driven by
// the `interval` value configured from the frontend.

const PORT = process.env.PORT || 5000;

// --- VIP boot sequence + HTTP+WS server ---
const httpServer = http.createServer(app);
wsServer.attach(httpServer);
realtimeHooks.start();

httpServer.listen(PORT, async () => {
  await banner.printAll({
    port: PORT,
    hostname: require("os").hostname(),
    nodeVersion: process.version,
    cores: require("os").cpus().length,
  });
  log.ok("http", `Server listening on port ${PORT}`);
  log.ws("ws",  `WebSocket bus available at ws://localhost:${PORT}/ws`);
  log.ok("ui",  `Live console UI at http://localhost:${PORT}/`);
  log.cron("cron", "Per-job ping timers active — interval driven by frontend setup");

  // Freeze the boot banner so it's *always* shown on first page load
  // (replayed at its original cadence by the web console). Everything
  // logged after this point goes into the rolling live buffer.
  terminalCapture.lockPreamble();
});

// Graceful shutdown
function shutdown(signal) {
  log.warn("proc", `Received ${signal}, shutting down...`);
  realtimeHooks.stop();
  pingScheduler.stopAll();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
