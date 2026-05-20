require("dotenv").config();

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

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

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const MONGO_URL =
  process.env.MONGO_URL || "mongodb://127.0.0.1:27017/Tool_serverless";

mongoose
  .connect(MONGO_URL)
  .then(async () => {
    log.db("mongo", "MongoDB connected");
    await seedAdmin();
    log.ok("seed", "Admin seed verified");

    await pingScheduler.startAll();
  })
  .catch((err) => log.err("mongo", err.message || String(err)));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/jobs", require("./routes/jobs"));

app.get("/api/system/terminal", (_req, res) => {
  const snap = terminalCapture.snapshot();
  res.json({
    preamble: snap.preamble,

    live: snap.live,

    terminal: terminalCapture.snapshotText(),
    metrics: sys.snapshot(),
    pingsRecent: buffers.pings.last(20),
  });
});

app.get("/api/system/scheduler", async (_req, res) => {
  try {
    const jobs = await Job.find(
      {},
      {
        _id: 1,
        name: 1,
        url: 1,
        interval: 1,
        method: 1,
        status: 1,
        paused: 1,
        lastChecked: 1,
        lastResponseTime: 1,
      },
    )
      .sort({ paused: 1, status: 1, name: 1 })
      .lean();

    const sanitized = jobs.map((j) => ({
      id: String(j._id).slice(-6),
      name: j.name || "",
      url: j.url,
      interval: j.interval || 1,
      method: j.method || "GET",
      status: j.paused ? "paused" : j.status || "checking",
      lastChecked: j.lastChecked || null,
      lastResponseTime: j.lastResponseTime || 0,
    }));

    const summary = {
      total: sanitized.length,
      active: sanitized.filter((j) => j.status === "active").length,
      dead: sanitized.filter((j) => j.status === "dead").length,
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

app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(consolePage.html());
});

const PORT = process.env.PORT || 5000;

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
  log.ws("ws", `WebSocket bus available at ws://localhost:${PORT}/ws`);
  log.ok("ui", `Live console UI at http://localhost:${PORT}/`);
  log.cron(
    "cron",
    "Per-job ping timers active — interval driven by frontend setup",
  );

  terminalCapture.lockPreamble();
});

function shutdown(signal) {
  log.warn("proc", `Received ${signal}, shutting down...`);
  realtimeHooks.stop();
  pingScheduler.stopAll();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
