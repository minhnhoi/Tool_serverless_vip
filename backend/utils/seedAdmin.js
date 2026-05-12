/**
 * REAL admin seeder.
 *
 *  - The credentials in `.env` (ADMIN_USERNAME / ADMIN_PASSWORD) are the
 *    REAL admin of the system. This function makes sure that user exists
 *    in the database and is flagged as role="admin".  If the password in
 *    `.env` is later changed, the hash is refreshed on next boot so the
 *    real admin can always log in with whatever is in `.env`.
 *
 *  - The HONEYPOT account is hardcoded in `routes/auth.js`
 *    (admin / admin1234567).  It is NEVER stored in the database — any
 *    login attempt against that exact combo is captured in HoneypotLog
 *    and the user gets trolled.
 */
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { log } = require("./colorLogger");

async function seedAdmin() {
  const username = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!username || !password) {
    log.warn("seed", "ADMIN_USERNAME / ADMIN_PASSWORD missing in .env — skipped");
    return;
  }

  const existing = await User.findOne({ username });
  const passwordHash = await bcrypt.hash(password, 10);

  if (!existing) {
    await User.create({
      name: "Administrator",
      username,
      passwordHash,
      role: "admin",
      agreeTerms: true
    });
    log.ok("seed", `Real admin created: ${username}`);
    return;
  }

  // Keep the admin in sync with .env (refresh password + ensure role).
  const samePw = await bcrypt.compare(password, existing.passwordHash);
  const updates = {};
  if (!samePw) updates.passwordHash = passwordHash;
  if (existing.role !== "admin") updates.role = "admin";

  if (Object.keys(updates).length > 0) {
    await User.updateOne({ _id: existing._id }, { $set: updates });
    log.ok("seed", `Real admin refreshed: ${username}`);
  }
}

module.exports = { seedAdmin };
