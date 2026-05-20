const os = require("os");
const { c, gradient, visibleLen } = require("./colors");
const sys = require("./sysMetrics");

const TITLE = [
  "████████╗ ██████╗  ██████╗ ██╗         ██████╗ ██╗███╗   ██╗ ██████╗ ",
  "╚══██╔══╝██╔═══██╗██╔═══██╗██║         ██╔══██╗██║████╗  ██║██╔════╝ ",
  "   ██║   ██║   ██║██║   ██║██║         ██████╔╝██║██╔██╗ ██║██║  ███╗",
  "   ██║   ██║   ██║██║   ██║██║         ██╔═══╝ ██║██║╚██╗██║██║   ██║",
  "   ██║   ╚██████╔╝╚██████╔╝███████╗    ██║     ██║██║ ╚████║╚██████╔╝",
  "   ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝    ╚═╝     ╚═╝╚═╝  ╚═══╝ ╚═════╝ ",
  " ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ ██╗     ███████╗███████╗",
  " ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗██║     ██╔════╝██╔════╝",
  " ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝██║     █████╗  ███████╗",
  " ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗██║     ██╔══╝  ╚════██║",
  " ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║███████╗███████╗███████║",
  " ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝",
];

const SUB = "S E R V I C E   B A C K E N D";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const WAVE_CHARS = [
  "▁",
  "▂",
  "▃",
  "▄",
  "▅",
  "▆",
  "▇",
  "█",
  "▇",
  "▆",
  "▅",
  "▄",
  "▃",
  "▂",
];

function clear() {
  process.stdout.write("\x1b[2J\x1b[H");
}
function hideCursor() {
  process.stdout.write("\x1b[?25l");
}
function showCursor() {
  process.stdout.write("\x1b[?25h");
}
function rewriteLine(text) {
  process.stdout.write(`\r\x1b[K${text}`);
}

function topBorder(width = 70) {
  const inner = "═".repeat(width - 2);
  return c.neonCyan(`╔${inner}╗`);
}
function bottomBorder(width = 70) {
  const inner = "═".repeat(width - 2);
  return c.neonCyan(`╚${inner}╝`);
}
function frameLine(content, width = 70) {
  const visible = visibleLen(content);
  const pad = Math.max(0, width - 2 - visible);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return (
    c.neonCyan("║") +
    " ".repeat(left) +
    content +
    " ".repeat(right) +
    c.neonCyan("║")
  );
}

function audioWave(width = 64) {
  let s = "";
  for (let i = 0; i < width; i++) {
    const ch = WAVE_CHARS[Math.floor(Math.random() * WAVE_CHARS.length)];
    s += ch;
  }
  return gradient(s, [0, 200, 255], [0, 255, 170]);
}

function progressBar(pct, width = 40) {
  const filled = Math.round(width * pct);
  const empty = width - filled;
  const bar = "█".repeat(filled) + c.gray("░".repeat(empty));
  return (
    gradient(bar.replace(/\x1b\[[0-9;]*m/g, ""), [0, 220, 130], [0, 200, 255]) +
    " " +
    c.neonGreen(`${Math.round(pct * 100)}%`)
  );
}

async function printBootSequence() {
  hideCursor();
  clear();

  const steps = [
    { label: "Initializing serverless runtime", ms: 220 },
    { label: "Linking ping micro-engines", ms: 260 },
    { label: "Spinning up edge gateway", ms: 220 },
    { label: "Calibrating latency probes", ms: 260 },
    { label: "Connecting to MongoDB cluster", ms: 320 },
    { label: "Activating WebSocket bus", ms: 220 },
    { label: "Igniting cron scheduler", ms: 220 },
  ];

  process.stdout.write(
    c.neonAqua(c.bold("\n  ⚡ Booting Tool Ping Serverless...\n\n")),
  );

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const total = step.ms;
    const start = Date.now();
    let frame = 0;
    while (Date.now() - start < total) {
      const pct = Math.min(1, (Date.now() - start) / total);
      const sp = c.neonCyan(SPINNER[frame % SPINNER.length]);
      rewriteLine(
        `  ${sp} ${c.white(step.label.padEnd(34))} ${progressBar(pct, 28)}`,
      );
      frame++;
      await sleep(40);
    }
    rewriteLine(
      `  ${c.neonGreen("✓")} ${c.white(step.label.padEnd(34))} ${progressBar(1, 28)}\n`,
    );
  }

  process.stdout.write("\n");
}

function printTitle() {
  const colored = TITLE.map((row) =>
    gradient(row, [0, 220, 255], [0, 255, 170]),
  );
  console.log("");
  for (const line of colored) console.log("  " + line);
  console.log("");
  console.log("  " + gradient(SUB, [120, 220, 255], [0, 255, 200]));
  console.log("");
}

function printRunningHeader() {
  const title = c.bold(c.neonCyan("Tool Ping Serverless backend running"));
  const wave = audioWave(46);
  console.log("  " + title + "  " + wave);
  console.log(
    "  " +
      c.gray("─".repeat(20)) +
      c.neonGreen(" ⬢ live ") +
      c.gray("─".repeat(20)) +
      c.neonAqua(" ⬡ realtime ") +
      c.gray("─".repeat(20)),
  );
  console.log("");
}

async function animateWaveOnce(durationMs = 900) {
  const width = 56;
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    rewriteLine("  " + c.neonCyan("⌁ ") + audioWave(width));
    await sleep(70);
  }
  rewriteLine("  " + c.neonCyan("⌁ ") + audioWave(width) + "\n");
}

function printInfoBox(info) {
  const W = 70;
  const rows = [
    "",
    `${c.neonGreen("●")} ${c.bold(c.white("STATUS"))}        ${c.neonGreen("PROCESS: RUNNING")}`,
    `${c.neonAqua("◆")} ${c.bold(c.white("Mode"))}          ${c.neonCyan("Serverless / Cron Edge")}`,
    `${c.neonAqua("◆")} ${c.bold(c.white("Port"))}          ${c.neonYellow(String(info.port))}`,
    `${c.neonAqua("◆")} ${c.bold(c.white("Host"))}          ${c.neonCyan(info.hostname)}`,
    `${c.neonAqua("◆")} ${c.bold(c.white("Node"))}          ${c.neonCyan(info.nodeVersion)}`,
    `${c.neonAqua("◆")} ${c.bold(c.white("Cores"))}         ${c.neonCyan(String(info.cores))}`,
    `${c.neonAqua("◆")} ${c.bold(c.white("Started"))}       ${c.neonCyan(new Date().toLocaleString())}`,
    "",
    `${c.neonPink("✦")} ${c.bold(c.white("REST"))}          ${c.neonCyan(`http://localhost:${info.port}/api/*`)}`,
    `${c.neonPink("✦")} ${c.bold(c.white("WebSocket"))}     ${c.neonCyan(`ws://localhost:${info.port}/ws`)}`,
    "",
  ];

  console.log("  " + topBorder(W));
  for (const r of rows) console.log("  " + frameLine(r, W));
  console.log("  " + bottomBorder(W));
}

function printArchitecture() {
  const A = c.neonCyan;
  const B = c.neonGreen;
  const Y = c.neonYellow;
  const M = c.neonPink;
  const G = c.gray;
  const lines = [
    "",
    `  ${G("┌──────────┐")}      ${G("┌──────────┐")}      ${G("┌────────────┐")}      ${G("┌──────────┐")}`,
    `  ${G("│")} ${A("Client")}   ${G("│")}─${B("──▶")}─${G("│")} ${A("Gateway")}  ${G("│")}─${B("──▶")}─${G("│")} ${A("Functions")}  ${G("│")}─${B("──▶")}─${G("│")} ${A("DB Node")}  ${G("│")}`,
    `  ${G("└──────────┘")}      ${G("└────┬─────┘")}      ${G("└─────┬──────┘")}      ${G("└──────────┘")}`,
    `        ${Y("│")}                  ${Y("│")}                  ${Y("│")}                ${M("◆")} ${G("MongoDB")}`,
    `        ${Y("▼")}                  ${Y("▼")}                  ${Y("▼")}`,
    `   ${G("Device data")}      ${G("Caching Layer")}     ${G("Edge Compute Node")}`,
    "",
  ];
  for (const l of lines) console.log(l);
}

async function printAll(info) {
  await printBootSequence();
  printTitle();
  printRunningHeader();
  await animateWaveOnce(700);
  printInfoBox(info);
  printArchitecture();
  showCursor();
}

function metricBar(ratio, width = 18) {
  const filled = Math.round(width * Math.max(0, Math.min(1, ratio)));
  const empty = width - filled;
  const raw = "█".repeat(filled) + "░".repeat(empty);
  if (ratio < 0.5) return c.neonGreen(raw);
  if (ratio < 0.8) return c.neonYellow(raw);
  return c.neonOrange(raw);
}

function printLiveDashboard() {
  const m = sys.snapshot();
  const cpu = m.cpu / 100;
  const mem = m.memory.ratio / 100;
  const tempRatio = Math.max(0, Math.min(1, (m.temperature - 25) / 60));
  const line =
    c.gray("┃ ") +
    c.neonCyan("CPU ") +
    metricBar(cpu) +
    c.neonCyan(` ${m.cpu.toFixed(1)}%`) +
    c.gray("  ┃ ") +
    c.neonAqua("MEM ") +
    metricBar(mem) +
    c.neonAqua(` ${m.memory.ratio.toFixed(1)}%`) +
    c.gray("  ┃ ") +
    c.neonOrange("TEMP ") +
    metricBar(tempRatio) +
    c.neonOrange(` ${m.temperature.toFixed(1)}°C`) +
    c.gray(" ┃ ") +
    c.neonGreen("UP ") +
    c.neonGreen(`${m.uptime}s`) +
    c.gray(" ┃");
  console.log(line);
}

module.exports = {
  printAll,
  printLiveDashboard,
  printTitle,
  printRunningHeader,
  audioWave,
};
