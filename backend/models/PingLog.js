const mongoose = require("mongoose");

const TTL_DAYS = Number(process.env.PINGLOG_TTL_DAYS);
const TTL_SECONDS =
  Number.isFinite(TTL_DAYS) && TTL_DAYS > 0
    ? Math.floor(TTL_DAYS * 86400)
    : process.env.PINGLOG_TTL_DAYS === "0"
      ? 0
      : 30 * 86400;

const timestampField = { type: Date, default: Date.now };
if (TTL_SECONDS > 0) {
  timestampField.index = { expireAfterSeconds: TTL_SECONDS };
} else {
  timestampField.index = true;
}

const PingLogSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true,
    index: true,
  },
  url: { type: String, required: true },
  status: { type: String, enum: ["up", "down"], required: true },
  statusCode: { type: Number, default: 0 },
  responseTime: { type: Number, default: 0 },
  message: { type: String, default: "" },
  timestamp: timestampField,
});

module.exports = mongoose.model("PingLog", PingLogSchema);
