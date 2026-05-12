import { motion } from "framer-motion";
import { useTheme } from "../theme/ThemeContext";
import Icon from "../components/Icon";

const LS_KEYS = {
  notif: "tp_settings_notif",
  sound: "tp_settings_sound",
  dense: "tp_settings_dense",
  lang:  "tp_settings_lang",
};

function useLocalToggle(key, initial = false) {
  const get = () => {
    const v = localStorage.getItem(key);
    if (v === null) return initial;
    return v === "true";
  };
  const set = (v) => localStorage.setItem(key, v ? "true" : "false");
  return [get, set];
}

function ToggleRow({ label, desc, lsKey, defaultOn = false, testId }) {
  const [get, set] = useLocalToggle(lsKey, defaultOn);
  const initial = get();
  const onChange = (e) => set(e.target.checked);
  return (
    <label className="tp-set-row" data-testid={testId}>
      <div className="tp-set-row-text">
        <div className="tp-set-row-label">{label}</div>
        <div className="tp-set-row-desc">{desc}</div>
      </div>
      <span className="tp-switch">
        <input type="checkbox" defaultChecked={initial} onChange={onChange} />
        <span className="tp-switch-track"><span className="tp-switch-thumb" /></span>
      </span>
    </label>
  );
}

export default function Settings() {
  const { theme, toggle } = useTheme();

  const onLangChange = (e) => localStorage.setItem(LS_KEYS.lang, e.target.value);
  const currentLang = localStorage.getItem(LS_KEYS.lang) || "vi";

  const onResetLocal = () => {
    if (!window.confirm("Xoá toàn bộ thiết lập cục bộ trong trình duyệt?")) return;
    Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="tp-section-head">
        <div>
          <h1>Thiết lập</h1>
          <div className="sub">Tuỳ chỉnh giao diện, thông báo và hành vi của Tool Ping.</div>
        </div>
      </div>

      <div className="tp-set-grid">
        <section className="tp-card" data-testid="settings-appearance">
          <h2 className="tp-card-title"><Icon name="sun" size={16} style={{ marginRight: 8, verticalAlign: -2 }} />Giao diện</h2>

          <div className="tp-set-row">
            <div className="tp-set-row-text">
              <div className="tp-set-row-label">Chế độ màu</div>
              <div className="tp-set-row-desc">Đang dùng: <b>{theme === "dark" ? "Dark mode" : "Light mode"}</b></div>
            </div>
            <button className="tp-btn tp-btn-sm" onClick={toggle} data-testid="settings-theme-toggle">
              <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
              <span>{theme === "dark" ? "Chuyển Light" : "Chuyển Dark"}</span>
            </button>
          </div>

          <ToggleRow
            label="Mật độ thông tin cao"
            desc="Giảm padding, hiển thị nhiều mục hơn trong cùng một màn hình."
            lsKey={LS_KEYS.dense}
            testId="settings-dense-toggle"
          />

          <div className="tp-set-row">
            <div className="tp-set-row-text">
              <div className="tp-set-row-label">Ngôn ngữ</div>
              <div className="tp-set-row-desc">Ngôn ngữ hiển thị mặc định trong dashboard.</div>
            </div>
            <select
              className="tp-select"
              style={{ width: 180 }}
              defaultValue={currentLang}
              onChange={onLangChange}
              data-testid="settings-lang-select"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </section>

        <section className="tp-card" data-testid="settings-notifications">
          <h2 className="tp-card-title"><Icon name="alert" size={16} style={{ marginRight: 8, verticalAlign: -2 }} />Thông báo</h2>

          <ToggleRow
            label="Cảnh báo trên trình duyệt"
            desc="Hiển thị toast khi có endpoint chuyển sang DOWN."
            lsKey={LS_KEYS.notif}
            defaultOn={true}
            testId="settings-notif-toggle"
          />
          <ToggleRow
            label="Âm thanh cảnh báo"
            desc="Phát beep khi có sự cố. (Yêu cầu tương tác đầu tiên trên trang.)"
            lsKey={LS_KEYS.sound}
            testId="settings-sound-toggle"
          />
        </section>

        <section className="tp-card" data-testid="settings-danger">
          <h2 className="tp-card-title"><Icon name="trash" size={16} style={{ marginRight: 8, verticalAlign: -2 }} />Vùng nguy hiểm</h2>
          <div className="tp-set-row">
            <div className="tp-set-row-text">
              <div className="tp-set-row-label">Xoá thiết lập cục bộ</div>
              <div className="tp-set-row-desc">Đặt lại tất cả tuỳ chọn lưu trong trình duyệt này. Không ảnh hưởng dữ liệu trên server.</div>
            </div>
            <button className="tp-btn tp-btn-sm tp-btn-danger" onClick={onResetLocal} data-testid="settings-reset-btn">
              <Icon name="trash" size={14} />
              <span>Reset</span>
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
