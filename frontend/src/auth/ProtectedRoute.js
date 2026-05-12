import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg)",
        color: "var(--text-soft)",
        fontSize: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="tp-skeleton" style={{ width: 18, height: 18, borderRadius: "50%" }} />
          <span>Đang tải phiên...</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
