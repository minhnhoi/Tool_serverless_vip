const mongoose = require("mongoose");

/**
 * Honeypot log — records every login attempt that used the FAKE admin
 * credentials defined in .env (ADMIN_USERNAME / ADMIN_PASSWORD).
 *
 * The fake account does NOT exist as a real DB user — the auth route
 * intercepts the attempt, denies login, and dumps everything we know
 * about the caller here so the real owner can review who's poking.
 */
const HoneypotLogSchema = new mongoose.Schema(
  {
    usernameTried: { type: String, default: "" },
    passwordTried: { type: String, default: "" }, // intentionally kept in clear — it's a trap
    ip: { type: String, default: "" },
    ipForwarded: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    referer: { type: String, default: "" },
    acceptLanguage: { type: String, default: "" },
    method: { type: String, default: "POST" },
    path: { type: String, default: "" },
    headers: { type: Object, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model("HoneypotLog", HoneypotLogSchema);
