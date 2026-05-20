const { bus, buffers } = require("./realtimeBus");

let _installed = false;
let _origStdout = null;
let _origStderr = null;

let _preambleChunks = [];
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
        _preambleChunks.push({ text, dt });
      } else {
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

function snapshot() {
  return {
    preamble: _preambleChunks.slice(),
    live: buffers.terminal.toArray().join(""),
  };
}

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
