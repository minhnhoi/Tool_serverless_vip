// routes/system.js
// HTTP endpoints that mirror the realtime bus, so the dashboard can
// fetch the latest system / latency / log / ping snapshots without WS.

const router = require("express").Router();
const { authRequired } = require("../middleware/auth");
const sys = require("../utils/sysMetrics");
const { buffers } = require("../utils/realtimeBus");

router.use(authRequired);

// Current system metrics snapshot (CPU / memory / temperature / uptime).
router.get("/metrics", (_req, res) => {
  res.json(sys.snapshot());
});

// Time series buffers for charts.
router.get("/metrics/series", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 120, 600);
  res.json({ items: buffers.metrics.last(limit) });
});

router.get("/latency/series", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 120, 600);
  res.json({ items: buffers.latency.last(limit) });
});

// Recent log lines (server log stream).
router.get("/logs", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json({ items: buffers.logs.last(limit) });
});

// Recent ping events from any job.
router.get("/pings/recent", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json({ items: buffers.pings.last(limit) });
});

// Single combined snapshot - convenient for one-shot dashboard hydration.
router.get("/snapshot", (_req, res) => {
  res.json({
    metrics: sys.snapshot(),
    series: {
      metrics: buffers.metrics.last(60),
      latency: buffers.latency.last(60),
    },
    logs: buffers.logs.last(40),
    pings: buffers.pings.last(40),
  });
});

module.exports = router;
