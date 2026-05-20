const mongoose = require("mongoose");

const HoneypotLogSchema = new mongoose.Schema(
  {
    usernameTried: { type: String, default: "" },
    passwordTried: { type: String, default: "" },
    ip: { type: String, default: "" },
    ipForwarded: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    referer: { type: String, default: "" },
    acceptLanguage: { type: String, default: "" },
    method: { type: String, default: "POST" },
    path: { type: String, default: "" },
    headers: { type: Object, default: {} },
  },
  { timestamps: true },
);

module.exports = mongoose.model("HoneypotLog", HoneypotLogSchema);
