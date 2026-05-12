// utils/wsServer.js
// WebSocket gateway. Streams system metrics, ping events, the live log
// feed AND the raw ANSI terminal mirror to any connected client.

const WebSocket = require("ws");
const { log } = require("./colorLogger");
const { bus, buffers } = require("./realtimeBus");
const terminalCapture = require("./terminalCapture");

function broadcast(wss, payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function attach(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket, req) => {
    const ip = (req.socket && req.socket.remoteAddress) || "unknown";
    log.ws("ws", `client connected \u2190 ${ip} (clients=${wss.clients.size})`);

    // Send a welcome snapshot so the UI can hydrate immediately,
    // including the full raw-ANSI terminal replay split into the boot
    // preamble (animated by the client) and the live rolling buffer.
    const termSnap = terminalCapture.snapshot();
    socket.send(
      JSON.stringify({
        type: "snapshot",
        data: {
          logs: buffers.logs.last(50),
          pings: buffers.pings.last(50),
          metrics: buffers.metrics.last(60),
          latency: buffers.latency.last(60),
          preamble: termSnap.preamble,
          live: termSnap.live,
          // legacy field
          terminal: terminalCapture.snapshotText(),
        },
      })
    );

    socket.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m && m.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", t: Date.now() }));
        }
      } catch {
        /* ignore non-JSON */
      }
    });

    socket.on("close", () => {
      log.ws("ws", `client disconnected (clients=${wss.clients.size - 1})`);
    });

    socket.on("error", (err) => {
      log.warn("ws", `socket error: ${err.message}`);
    });
  });

  bus.on("metrics",  (m) => broadcast(wss, { type: "metrics",  data: m }));
  bus.on("ping",     (p) => broadcast(wss, { type: "ping",     data: p }));
  bus.on("log",      (l) => broadcast(wss, { type: "log",      data: l }));
  bus.on("latency",  (s) => broadcast(wss, { type: "latency",  data: s }));
  bus.on("terminal", (t) => broadcast(wss, { type: "terminal", data: t }));

  return wss;
}

module.exports = { attach };
