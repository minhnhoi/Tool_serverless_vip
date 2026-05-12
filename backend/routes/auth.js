const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const HoneypotLog = require("../models/HoneypotLog");
const { authRequired } = require("../middleware/auth");

const TROLL_USERNAME = "admin";
const TROLL_PASSWORD = "admin1234567";

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "";
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      name: user.name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "12h" },
  );
}

function userPayload(u) {
  return { id: u._id, username: u.username, name: u.name, role: u.role };
}

async function logHoneypot(req, uname, pwd) {
  try {
    await HoneypotLog.create({
      usernameTried: uname,
      passwordTried: String(pwd),
      ip: getClientIp(req),
      ipForwarded: String(req.headers["x-forwarded-for"] || ""),
      userAgent: String(req.headers["user-agent"] || ""),
      referer: String(req.headers["referer"] || req.headers["referrer"] || ""),
      acceptLanguage: String(req.headers["accept-language"] || ""),
      method: req.method,
      path: req.originalUrl,
      headers: { ...req.headers },
    });
  } catch (e) {
    console.error("[honeypot:log]", e.message);
  }
}

router.post("/register", async (req, res) => {
  try {
    const { name, username, password, agreeTerms } = req.body || {};
    if (!name || !username || !password) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập đủ họ tên, tên đăng nhập và mật khẩu." });
    }
    if (!agreeTerms) {
      return res
        .status(400)
        .json({ error: "Bạn phải đồng ý với thỏa thuận sử dụng." });
    }
    const pwd = String(password);
    if (pwd.length < 8) {
      return res
        .status(400)
        .json({ error: "Mật khẩu phải có ít nhất 8 ký tự." });
    }
    if (!/[A-Z]/.test(pwd)) {
      return res
        .status(400)
        .json({ error: "Mật khẩu phải chứa ít nhất 1 chữ in hoa." });
    }
    if (!/[a-z]/.test(pwd)) {
      return res
        .status(400)
        .json({ error: "Mật khẩu phải chứa ít nhất 1 chữ thường." });
    }
    if (!/[0-9]/.test(pwd)) {
      return res
        .status(400)
        .json({ error: "Mật khẩu phải chứa ít nhất 1 chữ số." });
    }
    if (/\s/.test(String(username))) {
      return res
        .status(400)
        .json({ error: "Tên đăng nhập không được chứa khoảng trắng." });
    }
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(String(username))) {
      return res
        .status(400)
        .json({ error: "Tên đăng nhập 3–32 ký tự (chỉ chữ, số, _ . -)." });
    }
    if (String(name).trim().length < 2) {
      return res.status(400).json({ error: "Họ tên phải có ít nhất 2 ký tự." });
    }

    const uname = String(username).toLowerCase();

    const realAdmin = String(process.env.ADMIN_USERNAME || "").toLowerCase();
    if (
      uname === TROLL_USERNAME.toLowerCase() ||
      (realAdmin && uname === realAdmin)
    ) {
      return res
        .status(400)
        .json({ error: "Tên đăng nhập này không khả dụng." });
    }

    const dup = await User.findOne({ username: uname });
    if (dup)
      return res.status(409).json({ error: "Tên đăng nhập đã tồn tại." });

    const passwordHash = await bcrypt.hash(pwd, 10);
    const user = await User.create({
      name: String(name).trim().slice(0, 60),
      username: uname,
      passwordHash,
      role: "user",
      agreeTerms: true,
    });

    res.json({ ok: true, user: userPayload(user) });
  } catch (err) {
    console.error("[register]", err);
    res.status(500).json({ error: "Đăng ký thất bại." });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res
      .status(400)
      .json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu." });

  const uname = String(username).toLowerCase();
  const pwd = String(password);

  if (uname === TROLL_USERNAME.toLowerCase() && pwd === TROLL_PASSWORD) {
    await logHoneypot(req, uname, pwd);
    return res
      .status(401)
      .json({ error: "Bạn đã rơi vào bẫy 🤡", honeypot: true });
  }

  const user = await User.findOne({ username: uname });
  if (!user)
    return res.status(401).json({ error: "Sai tên đăng nhập hoặc mật khẩu." });

  const ok = await bcrypt.compare(pwd, user.passwordHash);
  if (!ok)
    return res.status(401).json({ error: "Sai tên đăng nhập hoặc mật khẩu." });

  const token = signToken(user);
  res.json({ token, user: userPayload(user) });
});

router.get("/me", authRequired, async (req, res) => {
  const user = await User.findById(req.user.sub).select("-passwordHash");
  if (!user) return res.status(401).json({ error: "User not found" });
  res.json(userPayload(user));
});

router.get("/honeypot-logs", authRequired, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Forbidden" });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = await HoneypotLog.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  res.json(logs);
});

module.exports = router;
