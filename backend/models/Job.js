const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    url: { type: String, required: true },
    tags: { type: [String], default: [] },

    interval: { type: Number, default: 5 },
    paused: { type: Boolean, default: false },

    method: { type: String, enum: ["GET", "POST", "HEAD"], default: "GET" },
    expectedStatus: { type: Number, default: 200 },
    headers: { type: Object, default: {} },
    keyword: { type: String, default: "" },

    status: { type: String, default: "checking" },
    lastChecked: { type: Date, default: null },
    lastResponseTime: { type: Number, default: 0 },
    lastError: { type: String, default: "" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdByName: { type: String, default: "" },
    createdByUsername: { type: String, default: "" },
    createdByRole: { type: String, default: "user" },
    linkVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Job", JobSchema);
