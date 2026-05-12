import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import api from "../api";
import Icon from "../components/Icon";
import { useAuth } from "../auth/AuthContext";

const RANGES = [
  { value: "24h", label: "24 giờ" },
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "all", label: "Tất cả" },
];

function formatTime(iso, range) {
  const d = new Date(iso);
  if (range === "24h")
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (range === "7d")
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
    });
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function Stat({ tone, label, value, icon, suffix = "" }) {
  return (
    <div className={"tp-stat is-" + tone}>
      <div className="lbl">
        <Icon name={icon} />
        <span>{label}</span>
      </div>
      <div className="val">
        {value}
        {suffix}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="tp-stat">
      <div className="lbl">
        <span>{label}</span>
      </div>
      <div className="val" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState("24h");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const load = async (r) => {
    setLoading(true);
    try {
      const res = await api.get("/api/jobs/stats", { params: { range: r } });
      setData(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    const id = setInterval(() => load(range), 30000);
    return () => clearInterval(id);
  }, [range]);

  const s = data?.summary || {
    jobsActive: 0,
    jobsDead: 0,
    jobsPaused: 0,
    jobsTotal: 0,
    pingsTotal: 0,
    pingsUp: 0,
    pingsDown: 0,
    successRate: 0,
    avgResponseTime: 0,
  };
  const chartData =
    data?.series?.map((x) => ({
      ...x,
      label: formatTime(x.timestamp, range),
    })) || [];

  const now = new Date();
  const hour = now.getHours();
  const greet =
    hour < 5
      ? "Khuya rồi "
      : hour < 11
        ? "Chào buổi sáng "
        : hour < 14
          ? "Chào buổi trưa "
          : hour < 18
            ? "Chào buổi chiều "
            : "Chào buổi tối ";
  const allUp = s.jobsDead === 0 && s.jobsActive > 0;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="tp-hero tp-fade-up" data-testid="dashboard-hero">
        <div>
          <h2 className="tp-hero-greet">
            {greet},{" "}
            <span
              style={{
                background: "var(--grad-signal)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                fontStyle: "italic",
              }}
            >
              {user?.username || "observer"}
            </span>{" "}
            <span className="wave">👋</span>
          </h2>
          <div className="tp-hero-sub">
            Đang theo dõi <b style={{ color: "var(--text)" }}>{s.jobsTotal}</b>{" "}
            endpoint · Tỷ lệ thành công{" "}
            <b style={{ color: "var(--text)" }}>{s.successRate}%</b>
          </div>
        </div>
        <div
          className="tp-hero-pulse"
          data-testid="system-pulse"
          style={
            !allUp
              ? {
                  background: "rgba(244, 63, 94, 0.10)",
                  borderColor: "rgba(244, 63, 94, 0.30)",
                  color: "#fda4af",
                }
              : undefined
          }
        >
          <span
            className="blip"
            style={
              !allUp
                ? { background: "#fb7185", boxShadow: "0 0 0 0 #fb7185" }
                : undefined
            }
          />
          <span>
            {allUp
              ? "All systems nominal"
              : s.jobsDead > 0
                ? `${s.jobsDead} endpoint dead`
                : "Đang đồng bộ"}
          </span>
        </div>
      </div>

      <div className="tp-section-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">
            Tổng quan trạng thái hoạt động của các endpoint
          </div>
        </div>
        <div className="tp-segment" role="group" data-testid="range-filter">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              data-testid={`range-${r.value}`}
              className={range === r.value ? "active" : ""}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tp-stat-grid tp-stagger" data-testid="summary-cards">
        <Stat
          tone="green"
          label="Active"
          value={s.jobsActive}
          icon="activity"
        />
        <Stat tone="red" label="Dead" value={s.jobsDead} icon="alert" />
        <Stat
          tone="blue"
          label="Total Pings"
          value={s.pingsTotal}
          icon="pulse"
        />
        <Stat
          tone="purple"
          label="Success rate"
          value={s.successRate}
          icon="trending"
          suffix="%"
        />
      </div>

      <div className="tp-stat-grid tp-mt-3 tp-stagger">
        <MiniStat label="Pings Up" value={s.pingsUp} color="#34d399" />
        <MiniStat label="Pings Down" value={s.pingsDown} color="#fb7185" />
        <MiniStat label="Paused" value={s.jobsPaused} />
        <MiniStat label="Avg response" value={`${s.avgResponseTime} ms`} />
      </div>

      <div className="tp-card tp-mt-4 tp-fade-up">
        <div className="tp-spread tp-mb-3">
          <h5 className="tp-card-title" style={{ margin: 0 }}>
            Hoạt động ping · {RANGES.find((r) => r.value === range)?.label}
          </h5>
          <div className="tp-card-subtle" style={{ display: "flex", gap: 14 }}>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "#22c55e",
                }}
              />{" "}
              Up
            </span>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "#ef4444",
                }}
              />{" "}
              Down
            </span>
          </div>
        </div>

        {loading && !data ? (
          <div className="tp-empty">
            <div className="tp-skeleton" style={{ width: 220, height: 14 }} />
            <div
              className="tp-skeleton"
              style={{ width: 320, height: 280, marginTop: 8 }}
            />
          </div>
        ) : chartData.length === 0 ? (
          <div className="tp-empty">
            <Icon name="info" size={36} />
            <div>Chưa có dữ liệu ping.</div>
            <div className="tp-text-mute" style={{ fontSize: 13 }}>
              Thêm link ở trang <b>Manage</b> và đợi vài phút để hệ thống thu
              thập.
            </div>
          </div>
        ) : (
          <div style={{ width: "100%", height: 360 }} data-testid="area-chart">
            <ResponsiveContainer>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="upColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.85} />
                    <stop
                      offset="100%"
                      stopColor="#22c55e"
                      stopOpacity={0.04}
                    />
                  </linearGradient>
                  <linearGradient id="downColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                    <stop
                      offset="100%"
                      stopColor="#ef4444"
                      stopOpacity={0.04}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted)"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="var(--muted)"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel-solid)",
                    border: "1px solid var(--border-hi)",
                    borderRadius: 10,
                    color: "var(--text)",
                    fontSize: 13,
                  }}
                  labelStyle={{ color: "var(--muted)" }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Area
                  type="monotone"
                  dataKey="up"
                  stackId="1"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#upColor)"
                  name="Up"
                />
                <Area
                  type="monotone"
                  dataKey="down"
                  stackId="1"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#downColor)"
                  name="Down"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}
