import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import api from "../api";
import Icon from "../components/Icon";

const RANGES = [
  { value: "24h", label: "24 giờ" },
  { value: "7d",  label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "all", label: "Tất cả" }
];

function Stat({ tone, label, value, suffix = "", icon }) {
  return (
    <div className={"tp-stat is-" + tone}>
      <div className="lbl"><Icon name={icon} /><span>{label}</span></div>
      <div className="val">{value}{suffix}</div>
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [range, setRange] = useState("24h");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get(`/api/jobs/${id}`, { params: { range } }),
        api.get(`/api/jobs/${id}/logs`, { params: { limit: 50 } })
      ]);
      setData(r1.data);
      setLogs(r2.data);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range, id]);

  if (loading && !data) {
    return (
      <div className="tp-empty">
        <div className="tp-skeleton" style={{ width: 220, height: 14 }} />
        <div className="tp-skeleton" style={{ width: 320, height: 18, marginTop: 8 }} />
      </div>
    );
  }
  if (!data) return <div className="tp-empty">Không tìm thấy job</div>;

  const job = data.job;
  const stats = data.stats;
  const series = (data.series || []).map((s) => ({
    ...s,
    label: new Date(s.timestamp).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="tp-mb-2">
        <Link to="/manage" className="tp-btn tp-btn-sm tp-btn-ghost" style={{ paddingLeft: 0 }}>
          <Icon name="arrowLeft" size={14} /><span>Quay lại</span>
        </Link>
      </div>

      <div className="tp-section-head">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ wordBreak: "break-word" }}>{job.name || job.url}</h1>
          {job.name && (
            <div className={"sub tp-mono" + (job.urlVisible === false ? " tp-url-masked" : "")} style={{ wordBreak: "break-all" }}>
              {job.urlVisible === false && <Icon name="lock" size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />}
              {job.url}
            </div>
          )}
          {job.createdByName && (
            <div className="tp-mt-1" style={{ fontSize: 12 }}>
              <span style={{ color: "var(--muted)", marginRight: 6 }}>Tạo bởi:</span>
              <span
                style={{
                  fontWeight: job.createdByRole === "admin" ? 800 : 600,
                  color: job.createdByRole === "admin" ? "#ff4d5e" : "#5fc7ff"
                }}
              >{job.createdByName}</span>
            </div>
          )}
        </div>
        <div className="tp-segment">
          {RANGES.map((r) => (
            <button key={r.value} type="button"
              className={range === r.value ? "active" : ""}
              onClick={() => setRange(r.value)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="tp-stat-grid tp-stagger">
        <Stat tone="green"  icon="trending" label="Uptime"        value={stats.uptime} suffix="%" />
        <Stat tone="blue"   icon="pulse"    label="Total pings"   value={stats.total} />
        <Stat tone="red"    icon="alert"    label="Down"          value={stats.downCount} />
        <Stat tone="purple" icon="clock"    label="Avg response"  value={stats.avgResponseTime} suffix=" ms" />
      </div>

      <div className="tp-card tp-mt-4">
        <h5 className="tp-card-title">Response time</h5>
        {series.length === 0 ? (
          <div className="tp-empty">
            <Icon name="info" size={32} />
            <div>Chưa có dữ liệu trong khoảng này</div>
          </div>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 10, right: 14, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted)" tick={{ fontSize: 12 }} />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 12 }} />
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
                <Line type="monotone" dataKey="responseTime" stroke="var(--accent)" strokeWidth={2.2} dot={false} name="ms" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="tp-card tp-mt-3">
        <h5 className="tp-card-title">Lịch sử ping gần đây</h5>
        <div className="tp-table-wrap">
          <table className="tp-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Status</th>
                <th>HTTP</th>
                <th>Response</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td className="tp-mono" style={{ fontSize: 13 }}>{new Date(l.timestamp).toLocaleString("vi-VN")}</td>
                  <td><span className={"tp-pill " + (l.status === "up" ? "up" : "down")}>{l.status}</span></td>
                  <td className="tp-mono">{l.statusCode || "-"}</td>
                  <td className="tp-mono">{l.responseTime} ms</td>
                  <td className="tp-text-mute" style={{ fontSize: 13 }}>{l.message || ""}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="tp-empty" style={{ padding: 24 }}>Chưa có log</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
