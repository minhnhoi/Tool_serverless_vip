// utils/realtimeHooks.js
// Wires the existing Mongoose models to the realtime bus, and starts
// the periodic system-metrics + latency aggregation loops.
//
// Importing this file has side effects (it registers a Mongoose post-save
// hook on the PingLog schema and starts two timers). Calling start()
// returns the timer handles so the caller can shut them down cleanly.

const PingLog = require("../models/Job") && require("../models/PingLog"); // ensure Job model loaded first
const sys = require("./sysMetrics");
const banner = require("./banner");
const { log } = require("./colorLogger");
const {
  publishMetrics,
  publishPing,
  publishLatencySample,
  buffers,
} = require("./realtimeBus");

let _timers = null;

function installPingHook() {
  // Avoid double-registration on hot reload.
  if (PingLog.schema.__rt_hook_installed) return;
  PingLog.schema.__rt_hook_installed = true;

  const ONLY_DOWN = process.env.LOG_PING_ONLY_DOWN === "1";

  PingLog.schema.post("save", function (doc) {
    const payload = {
      _id: doc._id.toString(),
      jobId: doc.jobId ? doc.jobId.toString() : null,
      url: doc.url,
      status: doc.status,
      statusCode: doc.statusCode,
      responseTime: doc.responseTime,
      message: doc.message || "",
      timestamp: doc.timestamp,
    };
    publishPing(payload);

    // Skip stdout spam on UP pings when LOG_PING_ONLY_DOWN=1 — the event
    // is still buffered and broadcast to the WS console for the live UI.
    if (ONLY_DOWN && doc.status === "up") return;

    const code = doc.statusCode || 0;
    const codeColored =
      doc.status === "up"
        ? `\x1b[38;5;46m${code} OK\x1b[0m`
        : `\x1b[38;5;208m${code || "ERR"}\x1b[0m`;
    log.ping(
      "ping",
      `${doc.url} → ${codeColored} \x1b[90m(${doc.responseTime}ms)\x1b[0m`,
      payload
    );
  });
}

function startMetricsLoop() {
  // Push system snapshot every 1s.
  return setInterval(() => {
    const snap = sys.snapshot();
    publishMetrics(snap);
  }, 1000);
}

function startLatencyAggregator() {
  // Roll the last few seconds of pings into a "latency / throughput / error-rate"
  // sample once per second so the front-end chart can render smoothly.
  return setInterval(() => {
    const now = Date.now();
    const windowMs = 5000;
    const recent = buffers.pings
      .toArray()
      .filter((p) => now - new Date(p.timestamp).getTime() <= windowMs);

    const throughput = Number((recent.length / (windowMs / 1000)).toFixed(2));
    const upCount = recent.filter((p) => p.status === "up").length;
    const errorRate = recent.length
      ? Number((((recent.length - upCount) / recent.length) * 100).toFixed(2))
      : 0;
    const latency = recent.length
      ? Math.round(recent.reduce((s, p) => s + (p.responseTime || 0), 0) / recent.length)
      : 0;

    publishLatencySample({
      timestamp: new Date().toISOString(),
      latency,
      throughput,
      errorRate,
      sampleCount: recent.length,
    });
  }, 1000);
}

function startTerminalDashboard() {
  // DISABLED — the live dashboard render is now rendered as a widget at
  // the top of the middle "Runtime Probe" panel in the web console
  // (consolePage.js) using real metrics from the WebSocket bus, so we
  // no longer print it to stdout (which would duplicate it in the left
  // PowerShell mirror).
  return null;
}

function start() {
  installPingHook();
  if (_timers) return _timers;
  _timers = {
    metrics:   startMetricsLoop(),
    latency:   startLatencyAggregator(),
    dashboard: startTerminalDashboard(),
  };
  return _timers;
}

function stop() {
  if (!_timers) return;
  for (const t of Object.values(_timers)) if (t) clearInterval(t);
  _timers = null;
}

module.exports = { start, stop };
