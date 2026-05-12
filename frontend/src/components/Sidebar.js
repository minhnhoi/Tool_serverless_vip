import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import Icon from "./Icon";

export default function Sidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  // Close drawer when route changes
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock scroll when drawer is open on mobile
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const link = (to, label, icon, testId) => (
    <Link
      to={to}
      data-testid={testId}
      className={"tp-nav-link " + (pathname === to ? "active" : "")}
      onClick={() => setOpen(false)}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </Link>
  );

  const userInitial = (user?.username || "?").slice(0, 1).toUpperCase();

  return (
    <>
      {/* Mobile top bar */}
      <div className="tp-mobile-bar">
        <div className="brand">
          <div className="tp-brand-mark"><span className="dot" /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Tool Ping</div>
            <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Solaris</div>
          </div>
        </div>
        <button
          className="tp-hamburger"
          onClick={() => setOpen(v => !v)}
          data-testid="mobile-menu-toggle"
          aria-label="Toggle menu"
        >
          <Icon name={open ? "close" : "menu"} size={20} />
        </button>
      </div>

      <div
        className={"tp-scrim " + (open ? "open" : "")}
        onClick={() => setOpen(false)}
      />

      <aside className={"tp-sidebar " + (open ? "open" : "")}>
        <div className="tp-brand">
          <div className="tp-brand-mark"><span className="dot" /></div>
          <div className="tp-brand-name">
            Tool Ping
            <small>Solaris observatory</small>
          </div>
        </div>

        <div className="tp-nav-section">Workspace</div>
        <nav className="tp-nav">
          {link("/", "Dashboard", "dashboard", "nav-dashboard")}
          {link("/manage", "Manage Links", "list", "nav-manage")}
        </nav>

        <div className="tp-nav-section" style={{ marginTop: 14 }}>Account</div>
        <nav className="tp-nav">
          {link("/profile", "Tài khoản", "user", "nav-profile")}
          {link("/settings", "Thiết lập", "settings", "nav-settings")}
          {link("/about", "Giới thiệu", "info", "nav-about")}
        </nav>

        <div className="tp-sidebar-foot">
          <button
            onClick={toggle}
            className="tp-btn tp-btn-sm tp-mb-2"
            style={{ width: "100%" }}
            data-testid="theme-toggle"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>

          {user && (
            <>
              <div className="tp-user-card">
                <div className="tp-user-avatar">{userInitial}</div>
                <div className="tp-user-info">
                  <strong>{user.username}</strong>
                  <small>Logged in</small>
                </div>
              </div>
              <button
                onClick={logout}
                className="tp-btn tp-btn-sm tp-btn-danger"
                style={{ width: "100%" }}
                data-testid="logout-btn"
              >
                <Icon name="logout" size={16} />
                <span>Đăng xuất</span>
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
