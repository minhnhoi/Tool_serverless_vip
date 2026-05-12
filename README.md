# Tool Ping UI v3.1.1-fixed

Web : https://www.tool-serverless.minhptit.id.vn

![Version](https://img.shields.io/badge/version-3.1.1--fixed-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-6+-brightgreen)

**Hệ thống giám sát uptime & ping scheduler** hiện đại với giao diện **Solaris Observatory** đẹp mắt, realtime dashboard và hệ thống bảo mật honeypot.

---

## ✨ Giới thiệu

**Tool Ping UI** là một công cụ giám sát website/endpoints mạnh mẽ, được thiết kế với giao diện khoa học viễn tưởng (Solaris Observatory). Hệ thống hỗ trợ theo dõi tình trạng hoạt động của nhiều URL cùng lúc, gửi thông báo, và có giao diện terminal live cực kỳ ấn tượng.

Phiên bản **v3.1.1-fixed** tập trung vào:
- Hệ thống tài khoản đa người dùng + phân quyền
- Honeypot trap thông minh
- Ownership cho từng job
- UI/UX được tinh chỉnh mạnh (floating label, responsive, theme Solaris)

---

## 🌟 Tính năng nổi bật

### Core Features
- **Realtime Dashboard** với live terminal, matrix rain, sparkline latency
- **Ping Scheduler** linh hoạt (interval theo phút)
- **System Vitals Monitoring** (CPU, RAM, Temperature, Uptime)
- **Live Feed** và **Demo Runtime Panel** cực kỳ đẹp
- **Matrix Rain + Particle Background** hiệu ứng cyberpunk

### Authentication & Security
- Đăng ký / Đăng nhập với floating label form
- **Honeypot Trap**: Tài khoản `admin/admin1234567` sẽ kích hoạt trang troll + ghi log đầy đủ
- Admin thật được cấu hình trong `.env`
- Phân quyền sở hữu job (Owner/Admin)
- Ẩn/Hiện URL công khai

### Job Management
- Tạo, chỉnh sửa, tạm dừng, xóa job ping
- Toggle ẩn/hiện link
- Lịch sử ping chi tiết
- Thống kê throughput, latency, error rate

### UI/UX
- Theme **Solaris Observatory** (plum-black + coral-amber-teal gradient)
- Font: **Fraunces** (heading) + **Plus Jakarta Sans** + **JetBrains Mono**
- Responsive hoàn hảo (Mobile → Desktop)
- Live WebSocket updates
- Animated boot sequence

---

## 🛠 Công nghệ sử dụng

### Backend
- **Node.js** + **Express**
- **MongoDB** + **Mongoose**
- **JWT** Authentication
- **bcryptjs** hash password
- **WebSocket** (ws)
- **Cron-style** scheduler

### Frontend
- **React 18**
- **CSS thuần** (design system mạnh)
- **WebSocket** client
- Canvas animations (Matrix Rain, Sparkline, Particles)

---

## 📁 Cấu trúc thư mục

```bash
Tool-Ping-UI-v3.1.1-fixed/
├── backend/                    # Backend Node.js
│   ├── utils/
│   ├── routes/
│   ├── models/
│   ├── .env.example
│   └── package.json
│
├── frontend/                   # Frontend React
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── auth/
│   │   └── styles.css
│   └── package.json
│
├── .gitignore
├── README.md
├── WORKSPACE_UPDATE_NOTES.md
├── CHANGELOG_v3.1.md
├── REGISTER_FIXES.md
└── HOTFIX_NOTES.md
