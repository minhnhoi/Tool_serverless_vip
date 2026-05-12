import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import Icon from "../components/Icon";

function Row({ label, value, mono = false, testId }) {
  return (
    <div className="tp-set-row" data-testid={testId}>
      <div className="tp-set-row-text">
        <div className="tp-set-row-label">{label}</div>
      </div>
      <div className={"tp-set-row-value " + (mono ? "tp-mono" : "")}>{value || "—"}</div>
    </div>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const initial = (user?.username || "?").slice(0, 1).toUpperCase();

  const sessionStart =
    Number(localStorage.getItem("tp_session_start")) ||
    (() => {
      const t = Date.now();
      localStorage.setItem("tp_session_start", String(t));
      return t;
    })();

  const sessionStr = new Date(sessionStart).toLocaleString("vi-VN");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="tp-section-head">
        <div>
          <h1>Tài khoản</h1>
          <div className="sub">Thông tin tài khoản và phiên đăng nhập hiện tại.</div>
        </div>
      </div>

      <section className="tp-card tp-profile-hero" data-testid="profile-hero">
        <div className="tp-profile-avatar">{initial}</div>
        <div className="tp-profile-info">
          <div className="tp-profile-name">{user?.username || "Guest"}</div>
          <div className="tp-profile-role">
            <span className="tp-pill up">Active</span>
            <span style={{ marginLeft: 8, color: "var(--text-soft)", fontSize: 13 }}>
              {user?.role ? user.role : "Administrator"}
            </span>
          </div>
        </div>
        <button className="tp-btn tp-btn-sm tp-btn-danger" onClick={logout} data-testid="profile-logout-btn">
          <Icon name="logout" size={14} />
          <span>Đăng xuất</span>
        </button>
      </section>

      <div className="tp-set-grid" style={{ marginTop: 18 }}>
        <section className="tp-card" data-testid="profile-account">
          <h2 className="tp-card-title">Thông tin tài khoản</h2>
          <Row label="Tên đăng nhập" value={user?.username} mono testId="profile-username" />
          <Row label="Vai trò" value={user?.role || "admin"} testId="profile-role" />
          <Row label="ID tài khoản" value={user?.id || user?._id || "local-admin"} mono testId="profile-id" />
        </section>

        <section className="tp-card" data-testid="profile-session">
          <h2 className="tp-card-title">Phiên hiện tại</h2>
          <Row label="Bắt đầu phiên" value={sessionStr} testId="profile-session-start" />
          <Row label="Trình duyệt" value={navigator.userAgent.split(") ")[0] + ")"} mono testId="profile-ua" />
          <Row label="Múi giờ" value={Intl.DateTimeFormat().resolvedOptions().timeZone} testId="profile-tz" />
        </section>
      </div>
    </motion.div>
  );
}
