/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

// --- API Functions ---
const fetchStats = async () => (await axios.get("/api/admin/stats")).data;
const fetchProducts = async () => (await axios.get("/api/admin/products")).data;
const fetchOrders = async () => (await axios.get("/api/admin/orders")).data;
const fetchClients = async () => (await axios.get("/api/admin/clients")).data;

const createProduct = async (productData: any) =>
  (await axios.post("/api/admin/products", productData)).data;
const updateProduct = async ({
  id,
  productData,
}: {
  id: string;
  productData: any;
}) => (await axios.put(`/api/admin/products/${id}`, productData)).data;
const deleteProduct = async (id: string) =>
  (await axios.delete(`/api/admin/products/${id}`)).data;
const updateOrderStatus = async ({
  id,
  status,
}: {
  id: string;
  status: string;
}) => (await axios.patch(`/api/admin/orders/${id}`, { status })).data;

// --- React Query Hooks ---
export const useAdminStats = () =>
  useQuery({ queryKey: ["adminStats"], queryFn: fetchStats });
export const useAdminProducts = () =>
  useQuery({ queryKey: ["adminProducts"], queryFn: fetchProducts });
export const useAdminOrders = () =>
  useQuery({ queryKey: ["adminOrders"], queryFn: fetchOrders });
export const useAdminClients = () =>
  useQuery({ queryKey: ["adminClients"], queryFn: fetchClients });

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] }),
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProduct,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] }),
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] }),
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOrderStatus,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["adminOrders"] }),
  });
};
