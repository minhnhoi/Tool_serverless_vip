const router = require("express").Router();
const multer = require("multer");
const Job = require("../models/Job");
const PingLog = require("../models/PingLog");
const User = require("../models/User");
const { authRequired } = require("../middleware/auth");
const pingScheduler = require("../utils/pingScheduler");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.use(authRequired);

// ---------- helpers ----------
function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Mask the URL so non-owners only see the tail end, e.g. "******xample.com/blog".
function maskUrl(url) {
  if (!url) return "";
  const s = String(url);
  if (s.length <= 14) return "*".repeat(Math.max(6, Math.floor(s.length / 2))) + s.slice(-6);
  return "*".repeat(8) + s.slice(-Math.min(14, Math.floor(s.length * 0.5)));
}

function isOwner(job, userId) {
  return job.createdBy && String(job.createdBy) === String(userId);
}

// Decorate a job dict for the requesting user: hides url when linkVisible=false
// and the requester is neither the owner nor an admin.
function decorateJob(job, req) {
  const out = job.toObject ? job.toObject() : { ...job };
  out.isOwner = isOwner(out, req.user.sub);
  out.canEdit = out.isOwner || req.user.role === "admin";
  const reveal = out.linkVisible !== false || out.canEdit;
  out.urlVisible = reveal;
  if (!reveal) {
    out.urlMasked = maskUrl(out.url);
    out.url = out.urlMasked;
  }
  return out;
}

async function loadActor(req) {
  // Fall back to JWT payload if DB lookup fails (token already validated).
  try {
    const u = await User.findById(req.user.sub).select("name username role");
    if (u) return { id: u._id, name: u.name, username: u.username, role: u.role };
  } catch (_) {}
  return {
    id: req.user.sub,
    name: req.user.name || req.user.username || "user",
    username: req.user.username || "",
    role: req.user.role || "user"
  };
}

// ---------- list / filter ----------
router.get("/", async (req, res) => {
  const { q, status, tag } = req.query;
  const filter = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ url: rx }, { name: rx }];
  }
  if (tag) filter.tags = tag;
  if (status === "paused") filter.paused = true;
  else if (status && status !== "all") {
    filter.status = status;
    if (status === "active" || status === "dead") filter.paused = { $ne: true };
  }

  const jobs = await Job.find(filter).sort({ createdAt: -1 });
  res.json(jobs.map((j) => decorateJob(j, req)));
});

// ---------- aggregate stats ----------
router.get("/stats", async (req, res) => {
  const range = (req.query.range || "24h").toLowerCase();
  const now = new Date();
  let since = null;
  let bucketMs = 60 * 60 * 1000;

  if (range === "24h") { since = new Date(now - 24 * 3600e3); bucketMs = 3600e3; }
  else if (range === "7d") { since = new Date(now - 7 * 24 * 3600e3); bucketMs = 6 * 3600e3; }
  else if (range === "30d") { since = new Date(now - 30 * 24 * 3600e3); bucketMs = 24 * 3600e3; }
  else { since = null; bucketMs = 24 * 3600e3; }

  const filter = since ? { timestamp: { $gte: since } } : {};
  const jobs = await Job.find();
  const activeCount = jobs.filter((j) => j.status === "active" && !j.paused).length;
  const deadCount = jobs.filter((j) => j.status === "dead" && !j.paused).length;
  const pausedCount = jobs.filter((j) => j.paused).length;

  const logs = await PingLog.find(filter).sort({ timestamp: 1 });
  const total = logs.length;
  const upCount = logs.filter((l) => l.status === "up").length;
  const downCount = total - upCount;
  const successRate = total > 0 ? (upCount / total) * 100 : 0;
  const avgResponseTime = total > 0 ? logs.reduce((s, l) => s + (l.responseTime || 0), 0) / total : 0;

  let firstTs = since ? since.getTime() : (logs[0] ? new Date(logs[0].timestamp).getTime() : now.getTime());
  const lastTs = now.getTime();
  firstTs = Math.floor(firstTs / bucketMs) * bucketMs;

  const buckets = [];
  for (let t = firstTs; t <= lastTs; t += bucketMs) buckets.push({ t, up: 0, down: 0 });
  if (buckets.length === 0) buckets.push({ t: firstTs, up: 0, down: 0 });

  for (const log of logs) {
    const ts = new Date(log.timestamp).getTime();
    let idx = Math.floor((ts - firstTs) / bucketMs);
    if (idx < 0) idx = 0;
    if (idx >= buckets.length) idx = buckets.length - 1;
    if (log.status === "up") buckets[idx].up += 1;
    else buckets[idx].down += 1;
  }

  res.json({
    range,
    summary: {
      jobsActive: activeCount,
      jobsDead: deadCount,
      jobsPaused: pausedCount,
      jobsTotal: jobs.length,
      pingsTotal: total,
      pingsUp: upCount,
      pingsDown: downCount,
      successRate: Number(successRate.toFixed(2)),
      avgResponseTime: Math.round(avgResponseTime)
    },
    series: buckets.map((b) => ({ timestamp: new Date(b.t).toISOString(), up: b.up, down: b.down }))
  });
});

// ---------- export CSV ----------
router.get("/export", async (req, res) => {
  const jobs = await Job.find().sort({ createdAt: 1 });
  const header = ["name", "url", "interval", "method", "expectedStatus", "tags", "paused", "keyword", "headers"];
  const lines = [header.join(",")];
  for (const j of jobs) {
    lines.push([
      csvEscape(j.name),
      csvEscape(j.url),
      csvEscape(j.interval),
      csvEscape(j.method),
      csvEscape(j.expectedStatus),
      csvEscape((j.tags || []).join("|")),
      csvEscape(j.paused ? "true" : "false"),
      csvEscape(j.keyword),
      csvEscape(JSON.stringify(j.headers || {}))
    ].join(","));
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=cron-monitor-jobs.csv");
  res.send(lines.join("\n"));
});

// ---------- import CSV ----------
router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const actor = await loadActor(req);
  const text = req.file.buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return res.json({ created: 0, skipped: 0 });

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = (k) => headers.indexOf(k);

  let created = 0;
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const url = (cols[idx("url")] || "").trim();
    if (!url) { skipped++; continue; }

    let parsedHeaders = {};
    try { parsedHeaders = JSON.parse(cols[idx("headers")] || "{}"); } catch {}

    await Job.create({
      name: cols[idx("name")] || "",
      url,
      interval: Number(cols[idx("interval")]) || 5,
      method: (cols[idx("method")] || "GET").toUpperCase(),
      expectedStatus: Number(cols[idx("expectedStatus")]) || 200,
      tags: (cols[idx("tags")] || "").split("|").map((t) => t.trim()).filter(Boolean),
      paused: String(cols[idx("paused")]).toLowerCase() === "true",
      keyword: cols[idx("keyword")] || "",
      headers: parsedHeaders,
      createdBy: actor.id,
      createdByName: actor.name,
      createdByUsername: actor.username,
      createdByRole: actor.role,
      linkVisible: true
    }).then((doc) => pingScheduler.scheduleJob(doc));
    created++;
  }
  res.json({ created, skipped });
});

// ---------- create ----------
router.post("/", async (req, res) => {
  const { url, name, interval, method, expectedStatus, headers, keyword, tags, paused, linkVisible } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });

  const actor = await loadActor(req);

  const job = await Job.create({
    url,
    name: name || "",
    interval: Number(interval) > 0 ? Number(interval) : 5,
    method: ["GET", "POST", "HEAD"].includes(method) ? method : "GET",
    expectedStatus: Number(expectedStatus) || 200,
    headers: headers && typeof headers === "object" ? headers : {},
    keyword: keyword || "",
    tags: Array.isArray(tags) ? tags : [],
    paused: !!paused,
    linkVisible: linkVisible === false ? false : true,
    createdBy: actor.id,
    createdByName: actor.name,
    createdByUsername: actor.username,
    createdByRole: actor.role
  });
  pingScheduler.scheduleJob(job);
  res.json(decorateJob(job, req));
});

// ---------- get one ----------
router.get("/:id", async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Not found" });

  const range = (req.query.range || "24h").toLowerCase();
  const now = new Date();
  let since = null;
  if (range === "24h") since = new Date(now - 24 * 3600e3);
  else if (range === "7d") since = new Date(now - 7 * 24 * 3600e3);
  else if (range === "30d") since = new Date(now - 30 * 24 * 3600e3);

  const filter = { jobId: job._id };
  if (since) filter.timestamp = { $gte: since };

  const logs = await PingLog.find(filter).sort({ timestamp: 1 });
  const total = logs.length;
  const upCount = logs.filter((l) => l.status === "up").length;
  const uptime = total > 0 ? Number(((upCount / total) * 100).toFixed(2)) : 0;
  const avgResponseTime = total > 0 ? Math.round(logs.reduce((s, l) => s + (l.responseTime || 0), 0) / total) : 0;

  res.json({
    job: decorateJob(job, req),
    stats: { range, total, upCount, downCount: total - upCount, uptime, avgResponseTime },
    series: logs.map((l) => ({
      timestamp: l.timestamp,
      responseTime: l.responseTime,
      status: l.status,
      statusCode: l.statusCode
    }))
  });
});

// ---------- ownership guard ----------
function ensureCanMutate(job, req) {
  if (!job) return "not_found";
  if (req.user.role === "admin") return null;
  if (isOwner(job, req.user.sub)) return null;
  return "forbidden";
}

// ---------- update ----------
router.put("/:id", async (req, res) => {
  const existing = await Job.findById(req.params.id);
  const err = ensureCanMutate(existing, req);
  if (err === "not_found") return res.status(404).json({ error: "Not found" });
  if (err === "forbidden") return res.status(403).json({ error: "Bạn không phải người tạo link này." });

  const allowed = ["url", "name", "interval", "method", "expectedStatus", "headers", "keyword", "tags", "paused", "linkVisible"];
  const update = {};
  for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];

  if (update.interval !== undefined) update.interval = Number(update.interval) || 1;
  if (update.expectedStatus !== undefined) update.expectedStatus = Number(update.expectedStatus) || 200;

  const job = await Job.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!job) return res.status(404).json({ error: "Not found" });

  if (update.paused === true) {
    job.status = "paused";
    await job.save();
  } else if (update.paused === false && job.status === "paused") {
    job.status = "checking";
    await job.save();
  }

  pingScheduler.scheduleJob(job);
  res.json(decorateJob(job, req));
});

// ---------- toggle link visibility ----------
router.post("/:id/visibility", async (req, res) => {
  const existing = await Job.findById(req.params.id);
  const err = ensureCanMutate(existing, req);
  if (err === "not_found") return res.status(404).json({ error: "Not found" });
  if (err === "forbidden") return res.status(403).json({ error: "Bạn không phải người tạo link này." });

  const next = typeof req.body?.linkVisible === "boolean"
    ? req.body.linkVisible
    : !existing.linkVisible;
  existing.linkVisible = next;
  await existing.save();
  res.json(decorateJob(existing, req));
});

// ---------- pause / resume ----------
router.post("/:id/pause", async (req, res) => {
  const existing = await Job.findById(req.params.id);
  const err = ensureCanMutate(existing, req);
  if (err === "not_found") return res.status(404).json({ error: "Not found" });
  if (err === "forbidden") return res.status(403).json({ error: "Bạn không phải người tạo link này." });

  const job = await Job.findByIdAndUpdate(req.params.id, { paused: true, status: "paused" }, { new: true });
  pingScheduler.unscheduleJob(job._id);
  res.json(decorateJob(job, req));
});

router.post("/:id/resume", async (req, res) => {
  const existing = await Job.findById(req.params.id);
  const err = ensureCanMutate(existing, req);
  if (err === "not_found") return res.status(404).json({ error: "Not found" });
  if (err === "forbidden") return res.status(403).json({ error: "Bạn không phải người tạo link này." });

  const job = await Job.findByIdAndUpdate(req.params.id, { paused: false, status: "checking" }, { new: true });
  pingScheduler.scheduleJob(job);
  res.json(decorateJob(job, req));
});

// ---------- delete ----------
router.delete("/:id", async (req, res) => {
  const existing = await Job.findById(req.params.id);
  const err = ensureCanMutate(existing, req);
  if (err === "not_found") return res.status(404).json({ error: "Not found" });
  if (err === "forbidden") return res.status(403).json({ error: "Bạn không phải người tạo link này." });

  await Job.findByIdAndDelete(req.params.id);
  await PingLog.deleteMany({ jobId: req.params.id });
  pingScheduler.unscheduleJob(req.params.id);
  res.json({ ok: true });
});

// ---------- recent logs of one job ----------
router.get("/:id/logs", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = await PingLog.find({ jobId: req.params.id })
    .sort({ timestamp: -1 })
    .limit(limit);
  res.json(logs);
});

module.exports = router;
