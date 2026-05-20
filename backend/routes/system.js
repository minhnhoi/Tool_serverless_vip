const router = require("express").Router();
const { authRequired } = require("../middleware/auth");
const sys = require("../utils/sysMetrics");
const { buffers } = require("../utils/realtimeBus");

router.use(authRequired);

router.get("/metrics", (_req, res) => {
  res.json(sys.snapshot());
});

router.get("/metrics/series", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 120, 600);
  res.json({ items: buffers.metrics.last(limit) });
});

router.get("/latency/series", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 120, 600);
  res.json({ items: buffers.latency.last(limit) });
});

router.get("/logs", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json({ items: buffers.logs.last(limit) });
});

router.get("/pings/recent", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json({ items: buffers.pings.last(limit) });
});

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
