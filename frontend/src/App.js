import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Manage from "./pages/Manage";
import JobDetail from "./pages/JobDetail";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import About from "./pages/About";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeContext";
import ProtectedRoute from "./auth/ProtectedRoute";

function Shell({ children }) {
  return (
    <div className="tp-shell">
      <Sidebar />
      <main className="tp-content">
        <div className="tp-content-inner">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Shell><Dashboard /></Shell></ProtectedRoute>} />
            <Route path="/manage" element={<ProtectedRoute><Shell><Manage /></Shell></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute><Shell><JobDetail /></Shell></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Shell><Settings /></Shell></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Shell><Profile /></Shell></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute><Shell><About /></Shell></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
