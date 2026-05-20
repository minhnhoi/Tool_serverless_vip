import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icon";
import TrollOverlay from "../components/TrollOverlay";

function FloatField({
  id,
  label,
  value,
  onChange,
  type = "text",
  icon,
  autoComplete,
  maxLength,
  testid,
  rightSlot,
  hint,
}) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || (value && value.length > 0);

  return (
    <div
      className={`tp-float ${lifted ? "is-lifted" : ""} ${focused ? "is-focused" : ""}`}
    >
      {icon && (
        <span className="tp-float-ico">
          <Icon name={icon} size={16} />
        </span>
      )}
      <input
        id={id}
        className="tp-float-input"
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        maxLength={maxLength}
        data-testid={testid}
        placeholder=" "
      />
      <label htmlFor={id} className="tp-float-label">
        {label}
      </label>
      {rightSlot}
      {hint && <div className="tp-float-hint">{hint}</div>}
    </div>
  );
}

/* ---------- Password strength helper ---------- */
function scorePassword(pw) {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = ["Rất yếu", "Yếu", "Trung bình", "Khá", "Mạnh", "Rất mạnh"];
  return { score: s, label: map[s] || "" };
}

export default function Login() {
  const [mode, setMode] = useState("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regAgree, setRegAgree] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);

  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [troll, setTroll] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const pwStrength = useMemo(() => scorePassword(regPassword), [regPassword]);

  const submitLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setInfo("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (e2) {
      if (e2.response?.data?.honeypot) {
        setTroll(true);
      } else {
        setErr(e2.response?.data?.error || "Đăng nhập thất bại");
      }
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setErr("");
    setInfo("");
    if (regName.trim().length < 2)
      return setErr("Họ tên phải có ít nhất 2 ký tự.");
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(regUsername))
      return setErr("Tên đăng nhập 3–32 ký tự, chỉ chữ/số/_.-");
    if (regPassword.length < 8)
      return setErr("Mật khẩu phải có ít nhất 8 ký tự.");
    if (!/[A-Z]/.test(regPassword))
      return setErr("Mật khẩu phải có ít nhất 1 chữ in hoa.");
    if (!/[a-z]/.test(regPassword))
      return setErr("Mật khẩu phải có ít nhất 1 chữ thường.");
    if (!/[0-9]/.test(regPassword))
      return setErr("Mật khẩu phải có ít nhất 1 chữ số.");
    if (regPassword !== regConfirm)
      return setErr("Mật khẩu xác nhận không khớp.");
    if (!regAgree) return setErr("Bạn phải đồng ý với thỏa thuận sử dụng.");

    setLoading(true);
    try {
      await register({
        name: regName.trim(),
        username: regUsername.trim(),
        password: regPassword,
        agreeTerms: regAgree,
      });

      setUsername(regUsername.trim());
      setPassword("");
      setRegName("");
      setRegPassword("");
      setRegConfirm("");
      setRegAgree(false);
      setMode("login");
      setInfo("Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.");
    } catch (e2) {
      setErr(e2.response?.data?.error || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tp-login">
      {troll && (
        <TrollOverlay
          onClose={() => {
            setTroll(false);
            setPassword("");
          }}
        />
      )}

      <AnimatePresence>
        {loading && (
          <motion.div
            className="tp-login-loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            data-testid="login-loader"
          >
            <div className="tp-loader-stars" aria-hidden="true">
              {Array.from({ length: 26 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    left: `${(i * 37) % 100}%`,
                    top: `${(i * 53) % 100}%`,
                    animationDelay: `${(i * 0.13).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>
            <div className="tp-loader-orb">
              <div className="ring r1" />
              <div className="ring r2" />
              <div className="ring r3" />
              <div className="sweep" />
              <div className="core" />
            </div>
            <div className="tp-loader-text">
              <span>
                {mode === "register"
                  ? "Đang khởi tạo tài khoản"
                  : "Đang xác thực"}
              </span>
              <div className="dots">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="tp-loader-bar">
              <div />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="tp-login-hero">
        <div className="tp-login-brand">
          <div className="tp-brand-mark">
            <span className="dot" />
          </div>
          <div className="tp-brand-name" style={{ color: "#fff" }}>
            Tool Ping
            <small style={{ color: "#a89887" }}>Solaris observatory</small>
          </div>
        </div>

        <div className="tp-radar" aria-hidden="true">
          <div className="ring r1" />
          <div className="ring r2" />
          <div className="ring r3" />
          <div className="ring r4" />
          <div className="sweep" />
          <div className="ping p1" />
          <div className="ping p2" />
          <div className="ping p3" />
          <div className="ping p4" />
        </div>

        <motion.div
          className="tp-login-hero-content"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1>
            Quan sát mọi <span className="accent">endpoint</span>
            <br />
            như một <span className="accent">đài thiên văn</span>.
          </h1>
          <p>
            Theo dõi hàng loạt URL & cron-job, nhận trạng thái thời gian thực,
            biểu đồ uptime và cảnh báo khi có sự cố — tất cả trong một dashboard
            duy nhất.
          </p>

          <ul className="tp-login-features">
            <li>
              <Icon name="check" size={16} /> Ping định kỳ từ 1 phút đến 24 giờ
            </li>
            <li>
              <Icon name="check" size={16} /> Thống kê uptime & response time
              chi tiết
            </li>
            <li>
              <Icon name="check" size={16} /> Import / export hàng loạt qua CSV
            </li>
            <li>
              <Icon name="check" size={16} /> Tài khoản cá nhân & quyền sở hữu
              link riêng
            </li>
          </ul>
        </motion.div>

        <div className="tp-login-foot">
          © {new Date().getFullYear()} Tool Ping · Solaris edition
        </div>
      </section>

      <section className="tp-login-panel">
        <div className="tp-panel-deco" aria-hidden="true">
          <div className="tp-panel-aurora">
            <span className="blob b1" />
            <span className="blob b2" />
            <span className="blob b3" />
            <span className="blob b4" />
            <span className="blob b5" />
          </div>
          <div className="tp-panel-stars">
            {Array.from({ length: 42 }).map((_, i) => (
              <span
                key={i}
                style={{
                  left: `${(i * 53) % 100}%`,
                  top: `${(i * 31) % 100}%`,
                  animationDelay: `${(i * 0.21).toFixed(2)}s`,
                  animationDuration: `${2.4 + ((i * 13) % 30) / 10}s`,
                }}
              />
            ))}
          </div>
          <div className="tp-panel-orbit">
            <div className="ring r1" />
            <div className="ring r2" />
            <div className="ring r3" />
            <div className="dot d1" />
            <div className="dot d2" />
            <div className="dot d3" />
          </div>
          <div className="tp-panel-glow" />
        </div>

        <div className="tp-panel-edition" aria-hidden="true">
          <span className="dot" /> v3.1 · Solaris build
        </div>

        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="tp-panel-status"
          data-testid="panel-status"
        >
          <span className="pulse-dot" />
          <span className="label">Hệ thống đang trực</span>
          <span className="sep">·</span>
          <span className="mono">All sensors nominal</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="tp-login-card"
          data-testid="login-form"
        >
          <div className="tp-auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setErr("");
              }}
              data-testid="tab-login"
            >
              Đăng nhập
            </button>
            <button
              type="button"
              role="tab"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setErr("");
                setInfo("");
              }}
              data-testid="tab-register"
            >
              Đăng ký
            </button>
          </div>

          <h3 style={{ marginTop: 22 }}>
            {mode === "login" ? "Wellcome Bro !" : "New Account !"}
          </h3>
          <div className="tp-login-sub">
            {mode === "login"
              ? "Đăng nhập để mở bảng điều khiển của bạn."
              : "Hãy tạo tài khoản để bắt đầu theo dõi các endpoint của bạn ngay hôm nay!"}
          </div>

          {info && mode === "login" && (
            <motion.div
              className="tp-login-info"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid="register-success"
            >
              <Icon name="check" size={16} />
              <span>{info}</span>
            </motion.div>
          )}

          {err && (
            <motion.div
              className="tp-login-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid="login-error"
            >
              <Icon name="alert" size={16} />
              <span>{err}</span>
            </motion.div>
          )}

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="tp-auth-form">
              <FloatField
                id="login-username"
                label="Tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                icon="user"
                autoComplete="username"
                testid="login-username"
              />

              <FloatField
                id="login-password"
                label="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPw ? "text" : "password"}
                icon="lock"
                autoComplete="current-password"
                testid="login-password"
                rightSlot={
                  <button
                    type="button"
                    className="tp-eye"
                    onClick={() => setShowPw((v) => !v)}
                    data-testid="toggle-password"
                    aria-label="Hiện/Ẩn mật khẩu"
                  >
                    <Icon name={showPw ? "eyeOff" : "eye"} size={16} />
                  </button>
                }
              />

              <button
                type="submit"
                className="tp-btn tp-btn-primary tp-auth-submit"
                disabled={loading}
                data-testid="login-submit"
              >
                <Icon name="zap" size={16} />
                <span>Đăng nhập</span>
              </button>

              <div className="tp-login-hint">
                Chưa có tài khoản? Bấm tab <b>Đăng ký</b> ở trên hoặc{" "}
                <b>admin / admin1234567</b>.
              </div>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="tp-auth-form">
              <FloatField
                id="reg-name"
                label="Họ và tên hiển thị"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                icon="user"
                maxLength={60}
                testid="register-name"
              />

              <FloatField
                id="reg-username"
                label="Tên đăng nhập"
                value={regUsername}
                onChange={(e) =>
                  setRegUsername(e.target.value.replace(/\s+/g, ""))
                }
                icon="user"
                autoComplete="username"
                maxLength={32}
                testid="register-username"
              />

              <FloatField
                id="reg-password"
                label="Mật khẩu"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                type={showRegPw ? "text" : "password"}
                icon="lock"
                autoComplete="new-password"
                testid="register-password"
                rightSlot={
                  <button
                    type="button"
                    className="tp-eye"
                    onClick={() => setShowRegPw((v) => !v)}
                    aria-label="Hiện/Ẩn mật khẩu"
                  >
                    <Icon name={showRegPw ? "eyeOff" : "eye"} size={16} />
                  </button>
                }
              />

              {regPassword && (
                <div className="tp-pw-strength" data-testid="pw-strength">
                  <div className={`tp-pw-bars s${pwStrength.score}`}>
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="tp-pw-label">{pwStrength.label}</div>
                </div>
              )}
              <div className="tp-pw-hint">
                Tối thiểu 8 ký tự, 1 chữ in hoa, 1 chữ thường, 1 chữ số
              </div>

              <FloatField
                id="reg-confirm"
                label="Xác nhận mật khẩu"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                type={showRegPw ? "text" : "password"}
                icon="shield"
                autoComplete="new-password"
                testid="register-confirm"
              />

              <label className="tp-terms" data-testid="register-terms-label">
                <input
                  type="checkbox"
                  checked={regAgree}
                  onChange={(e) => setRegAgree(e.target.checked)}
                  data-testid="register-agree"
                />
                <span>
                  Tôi đồng ý với{" "}
                  <a href="#terms" onClick={(e) => e.preventDefault()}>
                    điều khoản sử dụng
                  </a>{" "}
                  và cam kết không lạm dụng hệ thống để spam, tấn công hoặc theo
                  dõi trái phép.
                </span>
              </label>

              <button
                type="submit"
                className="tp-btn tp-btn-primary tp-auth-submit"
                disabled={loading}
                data-testid="register-submit"
              >
                <Icon name="shield" size={16} />
                <span>Tạo tài khoản</span>
              </button>

              <div className="tp-login-hint">
                Sau khi tạo xong, <b>hệ thống</b> sẽ chuyển về màn hình{" "}
                <b style={{ color: "#ff6b78" }}>Đăng nhập</b>.
              </div>
            </form>
          )}
        </motion.div>

        <motion.div
          className="tp-panel-stats"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          aria-hidden="true"
        >
          <div className="tp-panel-stat">
            <div className="val">
              <span className="tick">●</span> 99.98
              <span className="pct">%</span>
            </div>
            <div className="lab">Uptime trung bình</div>
          </div>
          <div className="tp-panel-stat">
            <div className="val">
              1<span className="sep">′</span>00<span className="sep">″</span>
            </div>
            <div className="lab">Chu kỳ ping nhỏ nhất</div>
          </div>
          <div className="tp-panel-stat">
            <div className="val">
              24<span className="sep">/</span>7
            </div>
            <div className="lab">Cảnh báo thời gian thực</div>
          </div>
        </motion.div>

        <div className="tp-panel-foot" aria-hidden="true">
          <span className="tp-panel-foot-line" />
          <span className="tp-panel-foot-text">
            Mã hoá <b>bcrypt</b> · Phiên <b>JWT 12h</b> · Mở mã nguồn riêng tư
          </span>
          <span className="tp-panel-foot-line" />
        </div>
      </section>
    </div>
  );
}
