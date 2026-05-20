import { createContext, useContext, useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cm_user")) || null;
    } catch {
      return null;
    }
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("cm_token");

    if (!token) {
      setReady(true);
      return;
    }

    api
      .get("/api/auth/me")
      .then((r) => {
        setUser(r.data);
        localStorage.setItem("cm_user", JSON.stringify(r.data));
      })
      .catch(() => {
        localStorage.removeItem("cm_token");
        localStorage.removeItem("cm_user");
        setUser(null);
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  const login = async (username, password) => {
    const r = await api.post("/api/auth/login", {
      username,
      password,
    });

    localStorage.setItem("cm_token", r.data.token);
    localStorage.setItem("cm_user", JSON.stringify(r.data.user));

    setUser(r.data.user);

    return r.data.user;
  };

  const register = async ({ name, username, password, agreeTerms }) => {
    const r = await api.post("/api/auth/register", {
      name,
      username,
      password,
      agreeTerms,
    });

    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem("cm_token");
    localStorage.removeItem("cm_user");

    setUser(null);

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        ready,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
