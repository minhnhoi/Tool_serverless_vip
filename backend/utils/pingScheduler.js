// utils/pingScheduler.js
// Per-job ping scheduler. Each job has its OWN timer driven by the
// `interval` value configured from the frontend (minutes). Replaces the
// previous "every 1 min master cron" so the cadence honors per-job setup.

const axios = require("axios");
const Job = require("../models/Job");
const PingLog = require("../models/PingLog");
const { log } = require("./colorLogger");

// Map<jobId(string), { timer: NodeJS.Timeout, interval: number }>
const _timers = new Map();

function _idStr(id) {
  return id ? String(id) : "";
}

async function _runPing(jobId) {
  // Always re-fetch the latest job state so an in-flight reschedule /
  // pause / delete is honored at execution time.
  const job = await Job.findById(jobId);
  if (!job) {
    unscheduleJob(jobId);
    return;
  }
  if (job.paused) return;

  const now = new Date();
  const start = Date.now();
  let status = "down";
  let statusCode = 0;
  let responseTime = 0;
  let message = "";

  try {
    const res = await axios({
      url: job.url,
      method: job.method || "GET",
      timeout: 10000,
      headers: job.headers && typeof job.headers === "object" ? job.headers : {},
      validateStatus: () => true,
      responseType: "text",
    });
    responseTime = Date.now() - start;
    statusCode = res.status;

    const expected = job.expectedStatus || 200;
    const statusOk = res.status === expected;

    let keywordOk = true;
    if (job.keyword && job.keyword.trim() !== "") {
      const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data || "");
      keywordOk = body.includes(job.keyword);
      if (!keywordOk) message = `Keyword "${job.keyword}" not found`;
    }

    if (statusOk && keywordOk) {
      status = "up";
      job.status = "active";
      job.lastError = "";
    } else {
      status = "down";
      job.status = "dead";
      if (!statusOk) message = `Got status ${res.status}, expected ${expected}`;
      job.lastError = message;
    }
  } catch (err) {
    responseTime = Date.now() - start;
    statusCode = err.response ? err.response.status : 0;
    status = "down";
    job.status = "dead";
    message = err.code || err.message || "Request failed";
    job.lastError = message;
  }

  job.lastChecked = now;
  job.lastResponseTime = responseTime;
  await job.save();

  await PingLog.create({
    jobId: job._id,
    url: job.url,
    status,
    statusCode,
    responseTime,
    message,
    timestamp: now,
  });
}

function unscheduleJob(jobId) {
  const id = _idStr(jobId);
  const entry = _timers.get(id);
  if (entry) {
    clearTimeout(entry.timer);
    clearInterval(entry.timer);
    _timers.delete(id);
  }
}

// Schedule (or reschedule) a single job. If `runNow` is true and the job
// has never been checked OR the interval has already elapsed since last
// check, an initial ping is fired immediately, otherwise it waits for the
// remaining time before the recurring timer kicks in.
function scheduleJob(job, { runNow = true } = {}) {
  if (!job || !job._id) return;
  const id = _idStr(job._id);
  unscheduleJob(id);

  if (job.paused) return;

  const minutes = Number(job.interval) > 0 ? Number(job.interval) : 1;
  const intervalMs = Math.max(1000, Math.round(minutes * 60 * 1000));

  let initialDelay = 0;
  if (job.lastChecked) {
    const elapsed = Date.now() - new Date(job.lastChecked).getTime();
    initialDelay = Math.max(0, intervalMs - elapsed);
  }
  if (!runNow && initialDelay === 0) initialDelay = intervalMs;

  const armRecurring = () => {
    const t = setInterval(() => {
      _runPing(id).catch((err) =>
        log.err("ping", `${job.url} → ${err.message || String(err)}`)
      );
    }, intervalMs);
    _timers.set(id, { timer: t, interval: minutes });
  };

  if (initialDelay === 0) {
    // Fire once now, then arm the recurring interval.
    _runPing(id).catch((err) =>
      log.err("ping", `${job.url} → ${err.message || String(err)}`)
    );
    armRecurring();
  } else {
    const t = setTimeout(() => {
      _runPing(id).catch((err) =>
        log.err("ping", `${job.url} → ${err.message || String(err)}`)
      );
      armRecurring();
    }, initialDelay);
    _timers.set(id, { timer: t, interval: minutes });
  }

  log.cron(
    "cron",
    `Scheduled "${job.name || job.url}" every ${minutes} min` +
      (initialDelay ? ` (next in ${Math.round(initialDelay / 1000)}s)` : " (running now)")
  );
}

async function startAll() {
  // Clear any existing timers (defensive on hot reload).
  for (const id of Array.from(_timers.keys())) unscheduleJob(id);

  const jobs = await Job.find({ paused: { $ne: true } });
  for (const j of jobs) scheduleJob(j, { runNow: true });
  log.cron(
    "cron",
    `Ping scheduler armed for ${jobs.length} job(s) — per-job interval from frontend setup`
  );
}

function stopAll() {
  for (const id of Array.from(_timers.keys())) unscheduleJob(id);
}

function listScheduled() {
  return Array.from(_timers.entries()).map(([id, e]) => ({
    id,
    intervalMinutes: e.interval,
  }));
}

module.exports = {
  scheduleJob,
  unscheduleJob,
  startAll,
  stopAll,
  listScheduled,
};
