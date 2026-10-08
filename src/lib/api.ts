// src/lib/api.ts
import axios from "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    _retry?: boolean;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Intercepteur requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth-token") || sessionStorage.getItem("auth-token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur réponse (gestion du refresh token)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/api/auth/")
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh-token") || sessionStorage.getItem("refresh-token");
        if (!refreshToken) throw new Error("Aucun refresh token");
        const res = await api.post("/api/auth/refresh-token", { refreshToken });
        const newToken = res.data?.data?.token || res.data?.token;
        if (!newToken) throw new Error("Nouveau jeton manquant");

        const tokenStorage = sessionStorage.getItem("auth-token") && !localStorage.getItem("auth-token")
          ? sessionStorage
          : localStorage;
        tokenStorage.setItem("auth-token", newToken);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }

);

// Message d'erreur renvoyé par l'API. Le serveur répond { success: false, error: { message } }
// (utils/apiResponse.js) ; data.message est gardé pour les anciennes routes.
export const apiMessage = (err: any): string | undefined => err?.response?.data?.error?.message || err?.response?.data?.message;

export default api;