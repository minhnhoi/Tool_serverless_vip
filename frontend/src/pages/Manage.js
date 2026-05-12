import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api, { API_BASE } from "../api";
import { INTERVAL_OPTIONS, STATUS_FILTERS } from "../config";
import Icon from "../components/Icon";
import { useAuth } from "../auth/AuthContext";

const METHOD_OPTIONS = ["GET", "POST", "HEAD"];

const emptyForm = {
  name: "", url: "", interval: 5, method: "GET",
  expectedStatus: 200, tagsText: "", keyword: "", headersText: ""
};

function CreatorBadge({ job }) {
  const role = job.createdByRole || "user";
  const name = job.createdByName || job.createdByUsername || "—";
  const isAdmin = role === "admin";
  return (
    <span
      className={"tp-creator-badge " + (isAdmin ? "is-admin" : "is-user")}
      title={isAdmin ? "Người tạo (Admin)" : "Người tạo"}
      data-testid={`creator-${job._id}`}
    >
      <Icon name="user" size={12} />
      <span>{name}</span>
    </span>
  );
}

export default function Manage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdv, setShowAdv] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  const loadJobs = async () => {
    try {
      const r = await api.get("/api/jobs", { params: { q, status: statusFilter } });
      setJobs(r.data);
    } catch (e) { console.log(e); }
  };

  useEffect(() => { loadJobs(); /* eslint-disable-next-line */ }, [q, statusFilter]);
  useEffect(() => {
    const id = setInterval(loadJobs, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [q, statusFilter]);

  const allTags = useMemo(() => {
    const set = new Set();
    jobs.forEach((j) => (j.tags || []).forEach((t) => set.add(t)));
    return [...set];
  }, [jobs]);

  const parseHeaders = (text) => {
    const t = (text || "").trim();
    if (!t) return {};
    try { const p = JSON.parse(t); if (p && typeof p === "object") return p; }
    catch { /* ignore */ }
    return {};
  };

  const flash = (msg, kind = "success") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2600);
  };

  const addJob = async (e) => {
    e?.preventDefault();
    if (!form.url) return;
    try {
      await api.post("/api/jobs", {
        url: form.url,
        name: form.name,
        interval: Number(form.interval),
        method: form.method,
        expectedStatus: Number(form.expectedStatus),
        keyword: form.keyword,
        tags: form.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        headers: parseHeaders(form.headersText)
      });
      setForm(emptyForm);
      setShowAdv(false);
      flash("Đã thêm link mới");
      loadJobs();
    } catch (e2) {
      flash(e2.response?.data?.error || "Không thêm được", "error");
    }
  };

  const startEdit = (job) => {
    if (!job.canEdit) return flash("Bạn không phải người tạo link này.", "error");
    setEditing(job._id);
    setEditForm({
      name: job.name || "",
      url: job.url,
      interval: job.interval,
      method: job.method || "GET",
      expectedStatus: job.expectedStatus || 200,
      keyword: job.keyword || "",
      tagsText: (job.tags || []).join(", "),
      headersText: Object.keys(job.headers || {}).length ? JSON.stringify(job.headers, null, 2) : ""
    });
  };

  const saveEdit = async () => {
    try {
      await api.put(`/api/jobs/${editing}`, {
        name: editForm.name, url: editForm.url,
        interval: Number(editForm.interval), method: editForm.method,
        expectedStatus: Number(editForm.expectedStatus),
        keyword: editForm.keyword,
        tags: editForm.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        headers: parseHeaders(editForm.headersText)
      });
      setEditing(null);
      flash("Đã lưu thay đổi");
      loadJobs();
    } catch (e) { flash(e.response?.data?.error || "Không lưu được", "error"); }
  };

  const togglePause = async (job) => {
    if (!job.canEdit) return flash("Bạn không phải người tạo link này.", "error");
    try {
      if (job.paused) await api.post(`/api/jobs/${job._id}/resume`);
      else await api.post(`/api/jobs/${job._id}/pause`);
      flash(job.paused ? "Đã tiếp tục" : "Đã tạm dừng");
      loadJobs();
    } catch (e) { flash(e.response?.data?.error || "Thao tác thất bại", "error"); }
  };

  const toggleVisibility = async (job) => {
    if (!job.canEdit) return flash("Bạn không phải người tạo link này.", "error");
    try {
      await api.post(`/api/jobs/${job._id}/visibility`, { linkVisible: !job.linkVisible });
      flash(job.linkVisible ? "Đã ẩn link với người khác" : "Đã hiện link công khai");
      loadJobs();
    } catch (e) { flash(e.response?.data?.error || "Thao tác thất bại", "error"); }
  };

  const removeJob = async (job) => {
    if (!job.canEdit) return flash("Bạn không phải người tạo link này.", "error");
    if (!window.confirm("Xoá link này?")) return;
    try {
      await api.delete(`/api/jobs/${job._id}`);
      flash("Đã xoá");
      loadJobs();
    } catch (e) { flash(e.response?.data?.error || "Không xoá được", "error"); }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post("/api/jobs/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      flash(`Đã import: ${r.data.created} mới, ${r.data.skipped} bỏ qua`);
      if (fileRef.current) fileRef.current.value = "";
      loadJobs();
    } catch (e2) { flash("Import thất bại", "error"); }
  };

  const onExport = () => {
    const token = localStorage.getItem("cm_token");
    fetch(`${API_BASE}/api/jobs/export`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "cron-monitor-jobs.csv";
        a.click();
      });
  };

  const intervalLabel = (v) => INTERVAL_OPTIONS.find((o) => o.value === v)?.label || `${v} phút`;

  // Mở link khi click vào dòng tên (dòng đầu tiên của job).
  // - Nếu tên hiển thị chính là URL hợp lệ -> mở luôn tên đó.
  // - Nếu URL đang hiển thị công khai (không bị ẩn ***) -> mở URL.
  // - Nếu URL bị ẩn -> hiện thông báo: chính sách bảo mật chặn truy cập.
  const isLikelyUrl = (s) => typeof s === "string" && /^https?:\/\/\S+/i.test(s.trim());
  const openJobLink = (job) => {
    const masked = job.urlVisible === false;
    const displayName = (job.name || "").trim();

    // Ưu tiên: nếu dòng đầu (tên) chính là 1 link -> mở luôn link đó.
    if (isLikelyUrl(displayName)) {
      window.open(displayName, "_blank", "noopener,noreferrer");
      return;
    }
    // Nếu link bị ẩn theo chính sách của chủ sở hữu -> chỉ hiện thông báo.
    if (masked) {
      flash("Không thể truy cập link do chính sách bảo mật. Vui lòng chờ chủ sở hữu mở link công khai.", "error");
      return;
    }
    // Trường hợp link công khai -> mở thẳng URL.
    if (job.url) {
      window.open(job.url, "_blank", "noopener,noreferrer");
    }
  };

  const pillCls = (job) => {
    if (job.paused) return "tp-pill paused";
    if (job.status === "active") return "tp-pill up";
    if (job.status === "dead") return "tp-pill down";
    return "tp-pill checking";
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="tp-section-head">
        <div>
          <h1>Manage Links</h1>
          <div className="sub">Quản lý danh sách endpoint cần monitor</div>
        </div>
        <div className="tp-row">
          <button className="tp-btn tp-btn-sm" onClick={onExport} data-testid="export-csv-btn">
            <Icon name="download" size={16} /><span>Export CSV</span>
          </button>
          <label className="tp-btn tp-btn-sm" data-testid="import-csv-btn" style={{ cursor: "pointer", margin: 0 }}>
            <Icon name="upload" size={16} /><span>Import CSV</span>
            <input type="file" accept=".csv,text/csv" hidden onChange={onImport} ref={fileRef} />
          </label>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            className={"tp-toast " + (toast.kind === "error" ? "error" : "")}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            data-testid="toast"
          >
            <Icon name={toast.kind === "error" ? "alert" : "check"} size={16} />
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add form */}
      <form onSubmit={addJob} className="tp-card tp-mb-3">
        <div className="tp-form-grid">
          <div className="tp-col-4">
            <label className="tp-label">Tên gợi nhớ</label>
            <input className="tp-input" value={form.name} placeholder="My API"
              onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="name-input" />
          </div>
          <div className="tp-col-5">
            <label className="tp-label">URL <span style={{ color: "var(--tp-rose)" }}>*</span></label>
            <input className="tp-input" value={form.url} placeholder="https://example.com"
              onChange={(e) => setForm({ ...form, url: e.target.value })} data-testid="url-input" required />
          </div>
          <div className="tp-col-3">
            <label className="tp-label">Interval</label>
            <select className="tp-select" value={form.interval}
              onChange={(e) => setForm({ ...form, interval: Number(e.target.value) })} data-testid="interval-select">
              {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="tp-col-6">
            <label className="tp-label">Tags (phân tách bằng dấu phẩy)</label>
            <input className="tp-input" value={form.tagsText} placeholder="api, prod, payment"
              onChange={(e) => setForm({ ...form, tagsText: e.target.value })} data-testid="tags-input" />
          </div>
        </div>

        <button type="button"
          className="tp-btn tp-btn-sm tp-btn-ghost tp-mt-2"
          onClick={() => setShowAdv((v) => !v)} data-testid="toggle-advanced"
          style={{ paddingLeft: 0, color: "var(--accent)" }}
        >
          <Icon name="arrowDown" size={14} style={{ transform: showAdv ? "rotate(180deg)" : "none", transition: "transform .2s ease" }} />
          <span>{showAdv ? "Ẩn cấu hình nâng cao" : "Cấu hình nâng cao"}</span>
        </button>

        <AnimatePresence>
          {showAdv && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div className="tp-form-grid tp-mt-2">
                <div className="tp-col-3">
                  <label className="tp-label">Method</label>
                  <select className="tp-select" value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })} data-testid="method-select">
                    {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="tp-col-3">
                  <label className="tp-label">Expected status</label>
                  <input type="number" className="tp-input" value={form.expectedStatus}
                    onChange={(e) => setForm({ ...form, expectedStatus: e.target.value })} data-testid="expected-status-input" />
                </div>
                <div className="tp-col-6">
                  <label className="tp-label">Keyword (phải xuất hiện trong response)</label>
                  <input className="tp-input" value={form.keyword} placeholder='vd: "ok"'
                    onChange={(e) => setForm({ ...form, keyword: e.target.value })} data-testid="keyword-input" />
                </div>
                <div className="tp-col-12">
                  <label className="tp-label">Headers (JSON)</label>
                  <textarea className="tp-textarea"
                    value={form.headersText}
                    placeholder='{"Authorization": "Bearer xxx"}'
                    onChange={(e) => setForm({ ...form, headersText: e.target.value })}
                    data-testid="headers-input" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" className="tp-btn tp-btn-primary tp-mt-3" data-testid="add-job-btn">
          <Icon name="plus" size={16} /><span>Thêm link</span>
        </button>
      </form>

      {/* Filters */}
      <div className="tp-card tp-mb-3">
        <div className="tp-form-grid">
          <div className="tp-col-6">
            <label className="tp-label">Tìm theo tên hoặc URL</label>
            <div className="tp-input-wrap">
              <Icon name="search" size={16} />
              <input className="tp-input" value={q}
                onChange={(e) => setQ(e.target.value)} placeholder="Search..." data-testid="search-input" />
            </div>
          </div>
          <div className="tp-col-6">
            <label className="tp-label">Trạng thái</label>
            <div className="tp-segment" role="group" data-testid="status-filter">
              {STATUS_FILTERS.map((s) => (
                <button key={s.value} type="button"
                  data-testid={`status-${s.value}`}
                  className={statusFilter === s.value ? "active" : ""}
                  onClick={() => setStatusFilter(s.value)}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>
        {allTags.length > 0 && (
          <div className="tp-mt-2">
            <small className="tp-text-mute" style={{ marginRight: 6 }}>Tags:</small>
            {allTags.map((t) => (
              <span key={t} className="tp-tag" onClick={() => setQ(t)}>{t}</span>
            ))}
          </div>
        )}
      </div>

      <div data-testid="jobs-list" className="tp-stagger" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {jobs.length === 0 && (
          <div className="tp-card tp-empty">
            <Icon name="globe" size={36} />
            <div>Không có link nào khớp.</div>
            <div className="tp-text-mute" style={{ fontSize: 13 }}>Thêm link đầu tiên ở trên để bắt đầu.</div>
          </div>
        )}

        {jobs.map((job) => {
          const masked = job.urlVisible === false;
          const canEdit = job.canEdit;
          return (
            <div key={job._id} className="tp-card hoverable">
              <div className="tp-job-row">
                <div className="tp-job-main">
                  <div className="tp-job-head">
                    <button
                      type="button"
                      className="tp-job-name as-link"
                      onClick={() => openJobLink(job)}
                      data-testid={`open-link-${job._id}`}
                      title={
                        isLikelyUrl((job.name || "").trim())
                          ? "Mở link"
                          : masked
                            ? "Link đã bị ẩn theo chính sách bảo mật"
                            : "Mở link đích trong tab mới"
                      }
                    >
                      <span className="name-text">{job.name || job.url}</span>
                      <span className={pillCls(job)}>{job.paused ? "paused" : job.status}</span>
                    </button>
                    <CreatorBadge job={job} />
                  </div>

                  {job.name && (
                    <div className={"tp-job-url" + (masked ? " masked" : "")} data-testid={`job-url-${job._id}`}>
                      {masked && <Icon name="lock" size={12} />}
                      <span>{job.url}</span>
                    </div>
                  )}
                  <div className="tp-job-meta">
                    <span><b>{job.method || "GET"}</b></span>
                    <span className="dot">·</span>
                    <span>expect <b>{job.expectedStatus || 200}</b></span>
                    <span className="dot">·</span>
                    <span>every <b>{intervalLabel(job.interval)}</b></span>
                    <span className="dot">·</span>
                    <span><b>{job.lastResponseTime || 0} ms</b></span>
                    <span className="dot">·</span>
                    <span>{job.lastChecked ? new Date(job.lastChecked).toLocaleString("vi-VN") : "Chưa ping"}</span>
                  </div>
                  {job.lastError && (
                    <div className="tp-job-error">
                      <Icon name="alert" size={14} />
                      <span>{job.lastError}</span>
                    </div>
                  )}
                  {(job.tags || []).length > 0 && (
                    <div className="tp-mt-1">
                      {(job.tags || []).map((t) => <span className="tp-tag" key={t}>{t}</span>)}
                    </div>
                  )}
                </div>

                <div className="tp-job-actions">
                  {canEdit && (
                    <button
                      className={"tp-btn tp-btn-sm " + (job.linkVisible ? "tp-btn-info" : "tp-btn-warning")}
                      onClick={() => toggleVisibility(job)}
                      data-testid={`toggle-vis-${job._id}`}
                      title={job.linkVisible ? "Đang công khai — click để ẩn" : "Đang ẩn — click để công khai"}
                    >
                      <Icon name={job.linkVisible ? "eye" : "eyeOff"} size={14} />
                      <span>{job.linkVisible ? "Công khai" : "Ẩn link"}</span>
                    </button>
                  )}
                  {canEdit ? (
                    <>
                      <button className="tp-btn tp-btn-sm" onClick={() => togglePause(job)} data-testid={`pause-${job._id}`}>
                        <Icon name={job.paused ? "play" : "pause"} size={14} />
                        <span>{job.paused ? "Resume" : "Pause"}</span>
                      </button>
                      <button className="tp-btn tp-btn-sm tp-btn-warning" onClick={() => startEdit(job)} data-testid={`edit-${job._id}`}>
                        <Icon name="edit" size={14} /><span>Edit</span>
                      </button>
                      <Link to={`/jobs/${job._id}`} className="tp-btn tp-btn-sm tp-btn-info" data-testid={`details-${job._id}`}>
                        <Icon name="info" size={14} /><span>Chi tiết</span>
                      </Link>
                      <button className="tp-btn tp-btn-sm tp-btn-danger" onClick={() => removeJob(job)} data-testid={`delete-${job._id}`}>
                        <Icon name="trash" size={14} /><span>Xoá</span>
                      </button>
                    </>
                  ) : (
                    <span className="tp-readonly-hint" data-testid={`readonly-${job._id}`}>
                      <Icon name="lock" size={12} />
                      <span>Chỉ xem</span>
                    </span>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {editing === job._id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="tp-mt-3" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                      <div className="tp-form-grid">
                        <div className="tp-col-4">
                          <label className="tp-label">Tên</label>
                          <input className="tp-input" value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        </div>
                        <div className="tp-col-5">
                          <label className="tp-label">URL</label>
                          <input className="tp-input" value={editForm.url}
                            onChange={(e) => setEditForm({ ...editForm, url: e.target.value })} />
                        </div>
                        <div className="tp-col-3">
                          <label className="tp-label">Interval</label>
                          <select className="tp-select" value={editForm.interval}
                            onChange={(e) => setEditForm({ ...editForm, interval: Number(e.target.value) })}>
                            {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div className="tp-col-3">
                          <label className="tp-label">Method</label>
                          <select className="tp-select" value={editForm.method}
                            onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}>
                            {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div className="tp-col-3">
                          <label className="tp-label">Expected status</label>
                          <input type="number" className="tp-input" value={editForm.expectedStatus}
                            onChange={(e) => setEditForm({ ...editForm, expectedStatus: e.target.value })} />
                        </div>
                        <div className="tp-col-6">
                          <label className="tp-label">Keyword</label>
                          <input className="tp-input" value={editForm.keyword}
                            onChange={(e) => setEditForm({ ...editForm, keyword: e.target.value })} />
                        </div>
                        <div className="tp-col-12">
                          <label className="tp-label">Tags (phẩy)</label>
                          <input className="tp-input" value={editForm.tagsText}
                            onChange={(e) => setEditForm({ ...editForm, tagsText: e.target.value })} />
                        </div>
                        <div className="tp-col-12">
                          <label className="tp-label">Headers JSON</label>
                          <textarea className="tp-textarea" rows={3} value={editForm.headersText}
                            onChange={(e) => setEditForm({ ...editForm, headersText: e.target.value })} />
                        </div>
                      </div>
                      <div className="tp-row tp-mt-3">
                        <button className="tp-btn tp-btn-sm tp-btn-primary" onClick={saveEdit} data-testid={`save-${job._id}`}>
                          <Icon name="check" size={14} /><span>Lưu</span>
                        </button>
                        <button className="tp-btn tp-btn-sm" onClick={() => setEditing(null)}>
                          <Icon name="close" size={14} /><span>Huỷ</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
