const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { log } = require("./colorLogger");

async function seedAdmin() {
  const username = String(process.env.ADMIN_USERNAME || "")
    .trim()
    .toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!username || !password) {
    log.warn(
      "seed",
      "ADMIN_USERNAME / ADMIN_PASSWORD missing in .env — skipped",
    );
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
      agreeTerms: true,
    });
    log.ok("seed", `Real admin created: ${username}`);
    return;
  }

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
