// utils/colorLogger.js
// Colorful terminal logger. Every line is also pushed to the realtime bus
// so the frontend (and the live ASCII dashboard) can mirror the stream.

const { c } = require("./colors");
const { publishLog } = require("./realtimeBus");

function nowStr() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const LEVELS = {
  info:    { tag: "INFO ", color: c.neonCyan,   icon: "›" },
  ok:      { tag: "OK   ", color: c.neonGreen,  icon: "✓" },
  warn:    { tag: "WARN ", color: c.neonYellow, icon: "!" },
  err:     { tag: "ERROR", color: c.neonOrange, icon: "✗" },
  ping:    { tag: "PING ", color: c.neonAqua,   icon: "•" },
  ws:      { tag: "WS   ", color: c.neonPurple, icon: "↯" },
  cron:    { tag: "CRON ", color: c.neonBlue,   icon: "⟳" },
  db:      { tag: "DB   ", color: c.neonPink,   icon: "◈" },
  boot:    { tag: "BOOT ", color: c.neonLime,   icon: "★" },
};

function format(level, scope, msg) {
  const meta = LEVELS[level] || LEVELS.info;
  const ts = c.gray(`[${nowStr()}]`);
  const lvl = meta.color(meta.tag);
  const sc = scope ? c.dim(c.cyan(`(${scope})`)) : "";
  const ico = meta.color(meta.icon);
  return `${ts} ${ico} ${lvl} ${sc} ${msg}`;
}

function emit(level, scope, msg, extra) {
  const text = format(level, scope, msg);
  // eslint-disable-next-line no-console
  console.log(text);
  publishLog({
    timestamp: new Date().toISOString(),
    level,
    scope: scope || "",
    message: typeof msg === "string" ? stripAnsi(msg) : String(msg),
    extra: extra || null,
  });
}

function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, "");
}

const log = {
  info:  (scope, msg, extra) => emit("info",  scope, msg, extra),
  ok:    (scope, msg, extra) => emit("ok",    scope, msg, extra),
  warn:  (scope, msg, extra) => emit("warn",  scope, msg, extra),
  err:   (scope, msg, extra) => emit("err",   scope, msg, extra),
  ping:  (scope, msg, extra) => emit("ping",  scope, msg, extra),
  ws:    (scope, msg, extra) => emit("ws",    scope, msg, extra),
  cron:  (scope, msg, extra) => emit("cron",  scope, msg, extra),
  db:    (scope, msg, extra) => emit("db",    scope, msg, extra),
  boot:  (scope, msg, extra) => emit("boot",  scope, msg, extra),
  raw:   (text) => {
    // eslint-disable-next-line no-console
    console.log(text);
  },
};

module.exports = { log, format };
