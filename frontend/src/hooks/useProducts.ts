import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
});

type ProductQueryParams = {
  category?: string;
  subCategory?: string;
  venteFlash?: boolean;
  limit?: number;
  skip?: number;
};

export const useProducts = (params?: ProductQueryParams) => {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      const queries: string[] = [];
      if (params?.category) queries.push(`category=${params.category}`);
      if (params?.subCategory)
        queries.push(`subCategory=${params.subCategory}`);
      if (params?.venteFlash) queries.push("venteFlash=1");
      if (
        params?.limit !== undefined &&
        Number.isFinite(params.limit) &&
        params.limit > 0
      ) {
        queries.push(`limit=${params.limit}`);
      }
      if (
        params?.skip !== undefined &&
        Number.isFinite(params.skip) &&
        params.skip > 0
      ) {
        queries.push(`skip=${params.skip}`);
      }

      const queryString = queries.length ? `?${queries.join("&")}` : "";
      const res = await api.get(`/products${queryString}`);
      return res.data;
    },
    staleTime: 0,           // Data is immediately stale - always refetch
    gcTime: 0,              // Don't cache data (was cacheTime in v4)
    refetchOnMount: true,   // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
};
