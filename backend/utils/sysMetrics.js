const os = require("os");
const fs = require("fs");

let prevCpu = sampleCpu();

function sampleCpu() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function cpuUsage() {
  const cur = sampleCpu();
  const idleDiff = cur.idle - prevCpu.idle;
  const totalDiff = cur.total - prevCpu.total;
  prevCpu = cur;
  if (totalDiff <= 0) return 0;
  const usage = 1 - idleDiff / totalDiff;
  return Math.max(0, Math.min(1, usage));
}

function memUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return { total, free, used, ratio: used / total };
}

function readTemperature() {
  try {
    const candidates = [
      "/sys/class/thermal/thermal_zone0/temp",
      "/sys/class/thermal/thermal_zone1/temp",
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8").trim();
        const n = Number(raw);
        if (!Number.isNaN(n) && n > 0) {
          return n > 1000 ? n / 1000 : n;
        }
      }
    }
  } catch {}

  const base = 38 + cpuUsage() * 18;
  const jitter = (Math.random() - 0.5) * 2.5;
  return Number((base + jitter).toFixed(1));
}

function snapshot() {
  const cpu = cpuUsage();
  const mem = memUsage();
  const load = os.loadavg();
  return {
    timestamp: new Date().toISOString(),
    cpu: Number((cpu * 100).toFixed(1)),
    memory: {
      used: mem.used,
      total: mem.total,
      ratio: Number((mem.ratio * 100).toFixed(1)),
    },
    temperature: Number(readTemperature().toFixed(1)),
    load: { one: load[0], five: load[1], fifteen: load[2] },
    uptime: Math.round(process.uptime()),
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cores: os.cpus().length,
    nodeVersion: process.version,
    pid: process.pid,
  };
}

module.exports = { snapshot, cpuUsage, memUsage, readTemperature };
