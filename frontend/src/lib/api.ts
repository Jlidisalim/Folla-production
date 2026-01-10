/**
 * API Client with Clerk Authentication
 * 
 * This module provides:
 * 1. `api` - Basic axios instance for public endpoints
 * 2. `createAuthenticatedApi` - Function to create authenticated axios instance
 * 3. `useAuthenticatedApi` - React hook for authenticated API calls in components
 */
import axios, { AxiosInstance } from "axios";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useCallback, useMemo } from "react";

const BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4002";

/**
 * Basic API instance for PUBLIC endpoints only.
 * Does NOT include authentication headers.
 * Use for: products, public cart operations, order creation (guest checkout)
 */
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Add basic headers for tracking (not auth)
api.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  const email = localStorage.getItem("clientEmail");
  const clerkId = localStorage.getItem("clerkId");
  const phone = localStorage.getItem("clientPhone");

  if (email) config.headers["x-user-email"] = email;
  if (clerkId) config.headers["x-clerk-id"] = clerkId;
  if (phone) config.headers["x-user-phone"] = phone;
  else delete config.headers["x-user-phone"];

  return config;
});

export default api;

/**
 * Creates an authenticated axios instance with Clerk JWT token.
 * Use this for admin/protected endpoints.
 * 
 * @param token - Clerk JWT token from getToken()
 * @returns Axios instance with Authorization header
 */
export function createAuthenticatedApi(token: string): AxiosInstance {
  const authApi = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
  });

  authApi.interceptors.request.use((config) => {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${token}`;
    return config;
  });

  return authApi;
}

/**
 * React hook for making authenticated API calls.
 * Automatically includes Clerk JWT token in requests.
 * 
 * Usage:
 * ```tsx
 * const { authApi, isLoading, isSignedIn, getToken } = useAuthenticatedApi();
 * 
 * // Make authenticated request
 * const fetchOrders = async () => {
 *   const api = await authApi();
 *   if (!api) return; // Not signed in
 *   const res = await api.get("/orders");
 *   return res.data;
 * };
 * ```
 */
export function useAuthenticatedApi() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  /**
   * Gets an authenticated axios instance.
   * Returns null if user is not signed in.
   */
  const authApi = useCallback(async (): Promise<AxiosInstance | null> => {
    if (!isSignedIn) {
      return null;
    }

    try {
      const token = await getToken();
      if (!token) {
        console.warn("[authApi] No token available");
        return null;
      }
      return createAuthenticatedApi(token);
    } catch (err) {
      console.error("[authApi] Failed to get token:", err);
      return null;
    }
  }, [getToken, isSignedIn]);

  /**
   * Makes an authenticated GET request.
   * Handles 401/403 errors gracefully.
   */
  const authGet = useCallback(
    async <T = unknown>(url: string): Promise<{ data: T | null; error: string | null; status: number }> => {
      const api = await authApi();
      if (!api) {
        return { data: null, error: "Not authenticated", status: 401 };
      }

      try {
        const res = await api.get<T>(url);
        return { data: res.data, error: null, status: res.status };
      } catch (err: any) {
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || err.message || "Request failed";
        return { data: null, error: message, status };
      }
    },
    [authApi]
  );

  /**
   * Makes an authenticated POST request.
   */
  const authPost = useCallback(
    async <T = unknown>(url: string, data?: unknown): Promise<{ data: T | null; error: string | null; status: number }> => {
      const api = await authApi();
      if (!api) {
        return { data: null, error: "Not authenticated", status: 401 };
      }

      try {
        const res = await api.post<T>(url, data);
        return { data: res.data, error: null, status: res.status };
      } catch (err: any) {
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || err.message || "Request failed";
        return { data: null, error: message, status };
      }
    },
    [authApi]
  );

  /**
   * Makes an authenticated PATCH request.
   */
  const authPatch = useCallback(
    async <T = unknown>(url: string, data?: unknown): Promise<{ data: T | null; error: string | null; status: number }> => {
      const api = await authApi();
      if (!api) {
        return { data: null, error: "Not authenticated", status: 401 };
      }

      try {
        const res = await api.patch<T>(url, data);
        return { data: res.data, error: null, status: res.status };
      } catch (err: any) {
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || err.message || "Request failed";
        return { data: null, error: message, status };
      }
    },
    [authApi]
  );

  /**
   * Makes an authenticated PUT request.
   */
  const authPut = useCallback(
    async <T = unknown>(url: string, data?: unknown): Promise<{ data: T | null; error: string | null; status: number }> => {
      const api = await authApi();
      if (!api) {
        return { data: null, error: "Not authenticated", status: 401 };
      }

      try {
        const res = await api.put<T>(url, data);
        return { data: res.data, error: null, status: res.status };
      } catch (err: any) {
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || err.message || "Request failed";
        return { data: null, error: message, status };
      }
    },
    [authApi]
  );

  /**
   * Makes an authenticated DELETE request.
   */
  const authDelete = useCallback(
    async <T = unknown>(url: string): Promise<{ data: T | null; error: string | null; status: number }> => {
      const api = await authApi();
      if (!api) {
        return { data: null, error: "Not authenticated", status: 401 };
      }

      try {
        const res = await api.delete<T>(url);
        return { data: res.data, error: null, status: res.status };
      } catch (err: any) {
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || err.message || "Request failed";
        return { data: null, error: message, status };
      }
    },
    [authApi]
  );

  return {
    authApi,
    authGet,
    authPost,
    authPut,
    authPatch,
    authDelete,
    isLoading: !isLoaded,
    isSignedIn: isSignedIn ?? false,
    user,
    getToken,
  };
}
