const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    url: { type: String, required: true },
    tags: { type: [String], default: [] },

    interval: { type: Number, default: 5 }, // minutes
    paused: { type: Boolean, default: false },

    method: { type: String, enum: ["GET", "POST", "HEAD"], default: "GET" },
    expectedStatus: { type: Number, default: 200 },
    headers: { type: Object, default: {} },
    keyword: { type: String, default: "" }, // optional substring required in body

    status: { type: String, default: "checking" }, // active | dead | paused | checking
    lastChecked: { type: Date, default: null },
    lastResponseTime: { type: Number, default: 0 },
    lastError: { type: String, default: "" },

    // --- Ownership & link visibility ---
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdByName: { type: String, default: "" },        // display name snapshot
    createdByUsername: { type: String, default: "" },    // username snapshot
    createdByRole: { type: String, default: "user" },    // "admin" | "user"
    linkVisible: { type: Boolean, default: true }        // when false, hide URL from non-owners
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", JobSchema);
