import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  withCredentials: true,
});

export const useProduct = (id?: string | null) => {
  const { userId } = useAuth(); // Clerk ID

  return useQuery(
    ["product", id, userId],
    async () => {
      if (!id) return null;

      // Step 1: Fetch client info to pass clientId/clerkId for pricing
      let clientId: number | null = null;

      if (userId) {
        try {
          const clientRes = await api.get("/clients/current", {
            params: { clerkId: userId },
          });
          clientId = clientRes.data?.id || null;
        } catch (err: any) {
          if (err?.response?.status !== 404) {
            console.warn(
              "useProduct: /clients/current failed:",
              err?.response?.data ?? err?.message ?? err
            );
          }
        }
      }

      if (!clientId) {
        try {
          const clientRes = await api.get("/clients/me");
          clientId = clientRes.data?.id || null;
        } catch (err: any) {
          console.warn(
            "useProduct: no client found or not logged in",
            err?.response?.data ?? err?.message ?? err
          );
        }
      }

      // Step 2: Add client or clerk ID to query params
      const query = new URLSearchParams();
      if (clientId) query.append("clientId", String(clientId));
      else if (userId) query.append("clerkId", userId);

      // Step 3: Fetch product with dynamic pricing
      const res = await api.get(`/products/${id}?${query.toString()}`);
      return res.data;
    },
    { enabled: Boolean(id) }
  );
};
