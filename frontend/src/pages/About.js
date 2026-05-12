import { motion } from "framer-motion";
import Icon from "../components/Icon";

const FAQ = [
  {
    q: "Tool Ping dùng để làm gì?",
    a: "Theo dõi (ping) hàng loạt URL / cron-job theo lịch định kỳ, thống kê uptime và cảnh báo khi có sự cố.",
  },
  {
    q: "Tôi đổi mật khẩu admin ở đâu?",
    a: "Trong file backend/.env — sửa biến ADMIN_USER và ADMIN_PASSWORD, sau đó restart backend để áp dụng.",
  },
  {
    q: "Có hỗ trợ import nhiều URL cùng lúc không?",
    a: "Có. Trang Manage Links có nút Import CSV cho phép thêm hàng loạt endpoint với chu kỳ ping riêng.",
  },
  {
    q: "Vì sao tôi nhập admin / admin123 lại bị… troll?",
    a: "Vì đó là combo mặc định kinh điển mà attacker luôn thử đầu tiên. Đừng bao giờ giữ nguyên nó trong production 😉",
  },
];

const TECH = [
  { name: "React", desc: "Frontend UI" },
  { name: "Framer Motion", desc: "Page & micro animations" },
  { name: "Recharts", desc: "Uptime / latency charts" },
  { name: "Node + Express", desc: "Backend API" },
  { name: "MongoDB", desc: "Persistent storage" },
  { name: "WebSocket", desc: "Realtime ping updates" },
];

export default function About() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="tp-section-head">
        <div>
          <h1>About & Help</h1>
          <div className="sub">Thông tin về Tool Ping và các câu hỏi thường gặp.</div>
        </div>
      </div>

      <section className="tp-card tp-about-hero" data-testid="about-hero">
        <div className="tp-about-mark">
          <div className="tp-brand-mark"><span className="dot" /></div>
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Tool Ping <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 14 }}>· Solaris edition</span></h2>
          <p className="tp-card-subtle" style={{ marginTop: 8 }}>
            Một dashboard quan sát endpoint nhỏ gọn, tự host được, ưu tiên trải nghiệm thẩm mỹ và phản hồi tức thời.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap", color: "var(--text-soft)", fontSize: 13 }}>
            <span><b>Phiên bản:</b> 3.1.0</span>
            <span><b>Build:</b> {new Date().getFullYear()}.{String(new Date().getMonth() + 1).padStart(2, "0")}</span>
            <span><b>License:</b> MIT</span>
          </div>
        </div>
      </section>

      <div className="tp-set-grid" style={{ marginTop: 18 }}>
        <section className="tp-card" data-testid="about-faq">
          <h2 className="tp-card-title"><Icon name="info" size={16} style={{ marginRight: 8, verticalAlign: -2 }} />FAQ</h2>
          <div className="tp-faq">
            {FAQ.map((f, i) => (
              <details key={i} className="tp-faq-item" data-testid={`about-faq-${i}`}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="tp-card" data-testid="about-tech">
          <h2 className="tp-card-title"><Icon name="zap" size={16} style={{ marginRight: 8, verticalAlign: -2 }} />Tech stack</h2>
          <ul className="tp-tech-list">
            {TECH.map((t, i) => (
              <li key={i}>
                <span className="tp-tech-name">{t.name}</span>
                <span className="tp-tech-desc">{t.desc}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </motion.div>
  );
}
