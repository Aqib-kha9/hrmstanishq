"use client";

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.apaarpulse.com/api/v1";

const TOKEN_KEY = "hrms_auth_token";
const REFRESH_KEY = "hrms_refresh_token";

// ---------------------------------------------------------------------------
// Token helpers (re-exported so AuthContext can use them)
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_KEY, token);
}

export function removeRefreshToken(): void {
  localStorage.removeItem(REFRESH_KEY);
}

export function clearAuth(): void {
  removeToken();
  removeRefreshToken();
}

// ---------------------------------------------------------------------------
// API response shapes (matching backend src/utils/response.js)
// ---------------------------------------------------------------------------

export interface ApiSuccess<T = unknown> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  message: string;
  timestamp: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

export interface PaginatedData<T = unknown> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000, // 60s — Render free tier cold starts can take 30-60s
});

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — 401 refresh & unwrap
// ---------------------------------------------------------------------------

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    // Extract real backend error message so error.message never falls back to generic status code
    const resData = error.response?.data as any;
    if (resData?.message) {
      error.message = resData.message;
    } else if (resData?.error) {
      error.message = resData.error;
    } else if (Array.isArray(resData?.errors) && resData.errors.length > 0) {
      error.message = resData.errors
        .map((e: any) => (typeof e === "string" ? e : e.message || `${e.field}: ${e.message}`))
        .join(", ");
    } else if (error.response?.status === 409) {
      error.message = "An employee or record with this information already exists.";
    } else if (error.response?.status === 404) {
      error.message = "The requested resource was not found.";
    } else if (error.response?.status === 403) {
      error.message = "You do not have permission to perform this action.";
    } else if (error.response?.status === 400) {
      error.message = "Invalid request. Please check the entered information.";
    } else if (error.code === "ECONNABORTED") {
      error.message = "Request timed out. Please try again.";
    } else if (!error.response) {
      error.message = "Unable to connect to the server. Please check your network connection.";
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh on 401 and if we haven't already retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshTokenStr = getRefreshToken();
    if (!refreshTokenStr) {
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    originalRequest._retry = true;

    try {
      const { data } = await axios.post<ApiSuccess<{ token: string; refreshToken: string }>>(
        `${API_BASE_URL}/auth/refresh-token`,
        { refreshToken: refreshTokenStr }
      );

      const newToken = data.data.token;
      const newRefreshToken = data.data.refreshToken;

      setToken(newToken);
      setRefreshToken(newRefreshToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
      }

      processQueue(null, newToken);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ---------------------------------------------------------------------------
// Typed request helpers
// ---------------------------------------------------------------------------

/**
 * Calls the API and unwraps the backend's `{ success, message, data }` envelope.
 * Returns the `data` field on success, or throws on failure.
 */
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<ApiSuccess<T>>(url, { params });
  return res.data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.post<ApiSuccess<T>>(url, body);
  return res.data.data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.put<ApiSuccess<T>>(url, body);
  return res.data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.patch<ApiSuccess<T>>(url, body);
  return res.data.data;
}

export async function apiDelete(url: string): Promise<void> {
  await apiClient.delete(url);
}

/**
 * For endpoints that return paginated data.
 * Returns the full paginated structure.
 */
export async function apiGetPaginated<T>(url: string, params?: Record<string, unknown>): Promise<PaginatedData<T>> {
  const res = await apiClient.get<ApiSuccess<T[]> & { pagination: PaginatedData<T>["pagination"] }>(url, { params });
  return {
    data: res.data.data,
    pagination: (res.data as unknown as { pagination: PaginatedData<T>["pagination"] }).pagination,
  };
}

/**
 * Helper to safely extract a user-friendly error message from any caught error.
 */
export function getApiErrorMessage(err: unknown, fallback = "Operation failed. Please try again."): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  const anyErr = err as any;
  if (anyErr.response?.data?.message) return anyErr.response.data.message;
  if (anyErr.response?.data?.error) return anyErr.response.data.error;
  if (Array.isArray(anyErr.response?.data?.errors) && anyErr.response.data.errors.length > 0) {
    return anyErr.response.data.errors
      .map((e: any) => (typeof e === "string" ? e : e.message || `${e.field}: ${e.message}`))
      .join(", ");
  }
  if (anyErr.message && !anyErr.message.includes("status code")) return anyErr.message;
  if (anyErr.response?.status === 409) return "An employee or record with this information already exists.";
  if (anyErr.response?.status === 404) return "The requested resource was not found.";
  if (anyErr.response?.status === 403) return "You do not have permission to perform this action.";
  return fallback;
}

export default apiClient;
