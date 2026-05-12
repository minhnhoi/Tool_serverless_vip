// utils/terminalCapture.js
// Mirrors EVERYTHING that gets written to the real terminal (stdout/stderr)
// into memory. The capture is split into TWO parts:
//
//   1) preamble  – an immutable list of chunks captured during the boot
//                  sequence (banner, ASCII title, progress bars, info box,
//                  architecture diagram). Once `lockPreamble()` is called
//                  this list is frozen and is NEVER overwritten/evicted.
//                  Each chunk also carries the delay (ms) since the
//                  previous chunk so the web console can replay the boot
//                  with the *original timing* — making every page load
//                  feel like a fresh "first boot".
//
//   2) live      – a normal ring buffer of post-boot runtime chunks (ping
//                  logs, live CPU/MEM dashboard line, errors, etc).
//                  These are also broadcast on the realtime bus so any
//                  connected WebSocket clients see them in real time.
//
// This solves the bug where, after running for a short while, the boot
// banner & info box would disappear from the live web console because
// they had been evicted from the rolling ring buffer.

const { bus, buffers } = require("./realtimeBus");

let _installed = false;
let _origStdout = null;
let _origStderr = null;

// Preamble state ----------------------------------------------------------
let _preambleChunks = []; // array of { text, dt }
let _preambleLocked = false;
let _lastTs = 0;

function toString(chunk, encoding) {
  if (chunk == null) return "";
  if (typeof chunk === "string") return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString(encoding || "utf8");
  try {
    return String(chunk);
  } catch {
    return "";
  }
}

function install() {
  if (_installed) return;
  _installed = true;

  _origStdout = process.stdout.write.bind(process.stdout);
  _origStderr = process.stderr.write.bind(process.stderr);
  _lastTs = Date.now();

  function capture(stream, originalWrite, chunk, encoding, cb) {
    const text = toString(chunk, encoding);
    if (text) {
      const now = Date.now();
      const dt = _lastTs ? Math.min(now - _lastTs, 250) : 0;
      _lastTs = now;

      if (!_preambleLocked) {
        // Belongs to the boot banner — store it as part of the immutable
        // preamble, with the original inter-chunk delay so we can replay
        // the boot animation at its native cadence.
        _preambleChunks.push({ text, dt });
      } else {
        // Post-boot runtime output: push to the rolling ring buffer and
        // broadcast on the realtime bus for live WS clients.
        buffers.terminal.push(text);
        bus.emit("terminal", { chunk: text, ts: now });
      }
    }
    return originalWrite(chunk, encoding, cb);
  }

  process.stdout.write = function (chunk, encoding, cb) {
    return capture(process.stdout, _origStdout, chunk, encoding, cb);
  };
  process.stderr.write = function (chunk, encoding, cb) {
    return capture(process.stderr, _origStderr, chunk, encoding, cb);
  };
}

function uninstall() {
  if (!_installed) return;
  if (_origStdout) process.stdout.write = _origStdout;
  if (_origStderr) process.stderr.write = _origStderr;
  _installed = false;
}

function lockPreamble() {
  _preambleLocked = true;
}

function isPreambleLocked() {
  return _preambleLocked;
}

// Web-friendly snapshot: returns the boot banner (as an array of replay
// chunks with timing) and the rolling live buffer (as a single string).
function snapshot() {
  return {
    preamble: _preambleChunks.slice(),
    live: buffers.terminal.toArray().join(""),
  };
}

// Backwards-compatible flat-text snapshot (everything concatenated).
function snapshotText() {
  return (
    _preambleChunks.map((c) => c.text).join("") +
    buffers.terminal.toArray().join("")
  );
}

module.exports = {
  install,
  uninstall,
  lockPreamble,
  isPreambleLocked,
  snapshot,
  snapshotText,
};
