const { EventEmitter } = require("events");

class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.items = [];
  }
  push(item) {
    this.items.push(item);
    if (this.items.length > this.capacity) {
      this.items.splice(0, this.items.length - this.capacity);
    }
  }
  toArray() {
    return this.items.slice();
  }
  last(n) {
    return this.items.slice(-n);
  }
  clear() {
    this.items = [];
  }
}

const bus = new EventEmitter();
bus.setMaxListeners(50);

const buffers = {
  logs: new RingBuffer(300),
  pings: new RingBuffer(500),
  metrics: new RingBuffer(180),
  latency: new RingBuffer(120),
  terminal: new RingBuffer(1000),
};

function publishLog(entry) {
  buffers.logs.push(entry);
  bus.emit("log", entry);
}

function publishPing(entry) {
  buffers.pings.push(entry);
  bus.emit("ping", entry);
}

function publishMetrics(entry) {
  buffers.metrics.push(entry);
  bus.emit("metrics", entry);
}

function publishLatencySample(entry) {
  buffers.latency.push(entry);
  bus.emit("latency", entry);
}

function publishTerminal(chunk) {
  buffers.terminal.push(chunk);
  bus.emit("terminal", { chunk, ts: Date.now() });
}

module.exports = {
  bus,
  buffers,
  RingBuffer,
  publishLog,
  publishPing,
  publishMetrics,
  publishLatencySample,
  publishTerminal,
};
