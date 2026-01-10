/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/OrdersAdmin.tsx
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { useAuthenticatedApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Truck, RotateCcw, AlertTriangle, LogIn, XCircle, Clock, MapPin } from "lucide-react";
import { SignInButton, useUser } from "@clerk/clerk-react";
import { OrdersAdminSkeleton } from "@/components/skeletons";
import DotPagination from "@/components/DotPagination";
import CancelOrderDialog from "@/components/CancelOrderDialog";

type OrderItem = {
  id?: number;
  productId?: number;
  quantity?: number;
  price?: number;
  product?: { id?: number; title?: string; name?: string; images?: string[] };
  variant?: string | null;
  color?: string | null;
  size?: string | null;
  attributes?: Record<string, any> | null;
};

type Order = {
  id: number;
  total: number;
  status: string;
  address?: string | null;
  region?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  items?: OrderItem[] | null;
  createdAt?: string;
  read?: boolean;
  // Cancellation fields
  cancelReason?: string | null;
  canceledAt?: string | null;
  canceledBy?: string | null;
};

const formatOrderCode = (value: number | string) => {
  const numeric = Number(value);
  const base = Number.isNaN(numeric)
    ? String(value)
    : Math.max(0, numeric).toString().padStart(3, "0");
  return `#OR${base}`;
};

export default function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<"unauthorized" | "forbidden" | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    | "all"
    | "completed"
    | "processed"
    | "delivered"
    | "returned"
    | "canceled"
    | "pending"
  >("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 12;

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelingOrder, setCancelingOrder] = useState<Order | null>(null);

  // highlight id when opened from notification
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const baseURL = (api as any).defaults?.baseURL || "http://localhost:4000";
  const location = useLocation();
  const navigate = useNavigate();

  // Clerk authentication
  const { authGet, authPatch, isSignedIn, isLoading: authLoading } = useAuthenticatedApi();
  const { user } = useUser();

  // Refs map to scroll to element
  const refs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  const load = async () => {
    if (!isSignedIn) {
      setAuthError("unauthorized");
      return;
    }

    setLoading(true);
    setError(null);
    setAuthError(null);

    try {
      const { data, error: apiError, status } = await authGet<Order[]>("/orders");

      if (status === 401) {
        setAuthError("unauthorized");
        setOrders([]);
        return;
      }

      if (status === 403) {
        setAuthError("forbidden");
        setOrders([]);
        return;
      }

      if (apiError) {
        setError(apiError);
        setOrders([]);
        return;
      }

      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load orders", err);
      setError(err?.message ?? "Échec du chargement des commandes");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isSignedIn) {
      load();
    } else if (!authLoading && !isSignedIn) {
      setAuthError("unauthorized");
    }
  }, [authLoading, isSignedIn]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const term = params.get("search");
    if (term !== null) {
      setSearch(term);
    }
  }, [location.search]);

  // When orders load (or location state changes), handle openOrderId from navigation state
  useEffect(() => {
    const openOrderId = (location.state as any)?.openOrderId;
    if (!openOrderId) return;

    const idNum = Number(openOrderId);
    if (Number.isNaN(idNum)) return;

    const ord = orders.find((o) => o.id === idNum);
    if (ord) {
      // If it's pending, switch filter to pending so user sees pending orders
      if (ord.status === "pending") {
        setActiveFilter("pending");
      }
      // set selected order (open sidebar)
      setSelectedOrder(ord);

      // set highlight and scroll into view
      setHighlightedId(idNum);
      setTimeout(() => setHighlightedId(null), 6000);

      // small delay to ensure DOM ref exists then scroll
      setTimeout(() => {
        const el = refs.current.get(idNum);
        if (el && typeof el.scrollIntoView === "function") {
          try {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
            el.scrollIntoView();
          }
        }
      }, 80);

      // clear location state so it won't reopen repeatedly
      navigate(location.pathname + location.search, {
        replace: true,
        state: {},
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, location.state]);

  const changeStatus = async (id: number, status: string) => {
    const targetOrder = orders.find((o) => o.id === id);
    if (!targetOrder) return;

    const previousOrders = orders.map((o) => ({ ...o }));

    setUpdatingId(id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    if (selectedOrder?.id === id) {
      setSelectedOrder({ ...selectedOrder, status });
    }

    try {
      const { error: patchError, status: httpStatus } = await authPatch(`/orders/${id}`, { status });

      if (httpStatus === 401 || httpStatus === 403) {
        console.error("Auth error updating status");
        setOrders(previousOrders);
        return;
      }

      if (patchError) {
        console.error("Failed to update order status:", patchError);
        setOrders(previousOrders);
        return;
      }

      await load();
    } catch (err) {
      console.error("Failed to update order status", err);
      setOrders(previousOrders);
      await load();
    } finally {
      setUpdatingId(null);
    }
  };

  // Open cancel dialog for an order
  const openCancelDialog = (order: Order) => {
    setCancelingOrder(order);
    setCancelDialogOpen(true);
  };

  // Handle order cancellation with reason
  const handleCancelOrder = async (reason: string) => {
    if (!cancelingOrder) return;

    const orderId = cancelingOrder.id;
    const previousOrders = orders.map((o) => ({ ...o }));

    try {
      setUpdatingId(orderId);

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: "canceled", cancelReason: reason, canceledAt: new Date().toISOString() }
            : o
        )
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: "canceled", cancelReason: reason, canceledAt: new Date().toISOString() });
      }

      // Call cancel endpoint - ONLY calls cancel, not createOrder
      const { error: cancelError, status: httpStatus } = await authPatch(
        `/api/orders/${orderId}/cancel`,
        { reason }
      );

      if (httpStatus === 401 || httpStatus === 403) {
        console.error("Auth error canceling order");
        setOrders(previousOrders);
        throw new Error("Non autorisé");
      }

      if (cancelError) {
        console.error("Failed to cancel order:", cancelError);
        setOrders(previousOrders);
        throw new Error(cancelError);
      }

      // Success - close dialog and reload
      setCancelDialogOpen(false);
      setCancelingOrder(null);
      await load();
    } catch (err) {
      console.error("Failed to cancel order", err);
      setOrders(previousOrders);
      throw err; // Re-throw so dialog can handle it
    } finally {
      setUpdatingId(null);
    }
  };

  // Check if order can be canceled
  const canCancelOrder = (order: Order) => {
    const status = order.status?.toLowerCase().trim();
    return status !== "delivered" && status !== "completed" && status !== "canceled" && status !== "cancelled";
  };

  const normalizedSearch = search.trim().toLowerCase();

  // Apply search filter first (shared between counts and table)
  const searchFilteredOrders = orders.filter((o) => {
    if (!normalizedSearch) return true;
    const matchesId =
      formatOrderCode(o.id).toLowerCase().includes(normalizedSearch) ||
      o.id.toString().includes(normalizedSearch);
    const customerFields = [o.name, o.email, o.phone, o.address].filter(
      Boolean
    ) as string[];
    const matchesCustomer = customerFields.some((field) =>
      field.toLowerCase().includes(normalizedSearch)
    );
    const matchesItems =
      o.items?.some((it) =>
        [it.product?.title, it.product?.name]
          .filter((field): field is string => Boolean(field))
          .some((field) => field.toLowerCase().includes(normalizedSearch))
      ) ?? false;
    return matchesId || matchesCustomer || matchesItems;
  });

  // Compute status counts from search-filtered orders (so counts match the table)
  const statusCounts = {
    all: searchFilteredOrders.filter((o) => o.status !== "canceled" && o.status !== "cancelled").length,
    completed: searchFilteredOrders.filter((o) => o.status === "completed").length,
    processed: searchFilteredOrders.filter((o) => o.status === "processed").length,
    delivered: searchFilteredOrders.filter((o) => o.status === "delivered").length,
    returned: searchFilteredOrders.filter((o) => o.status === "returned").length,
    canceled: searchFilteredOrders.filter((o) => o.status === "canceled" || o.status === "cancelled").length,
    pending: searchFilteredOrders.filter((o) => o.status === "pending").length,
  };

  // Apply status filter to get final table data
  const filteredOrders = searchFilteredOrders.filter((o) => {
    // "all" filter excludes cancelled orders - they are only visible under "Annulées" tab
    if (activeFilter === "all") {
      return o.status !== "canceled" && o.status !== "cancelled";
    }
    return o.status === activeFilter;
  });

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, search]);

  // Pagination computed values
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ordersPerPage,
    currentPage * ordersPerPage
  );


  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-orange-100 text-orange-800";
      case "processed":
        return "bg-yellow-100 text-yellow-800";
      case "delivered":
        return "bg-purple-100 text-purple-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "returned":
        return "bg-blue-100 text-blue-800";
      case "canceled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente";
      case "processed":
        return "En préparation";
      case "delivered":
        return "Livrée";
      case "completed":
        return "Terminée";
      case "returned":
        return "Retournée";
      case "canceled":
        return "Annulée";
      default:
        return status;
    }
  };

  // --- IMAGE HELPERS ---
  function normalizeImagePath(src?: string | null) {
    if (!src) return null;
    const s = String(src).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/uploads/")) {
      return `${baseURL.replace(/\/$/, "")}/products${s}`;
    }
    if (s.startsWith("/products/uploads/")) {
      return `${baseURL.replace(/\/$/, "")}${s}`;
    }
    if (s.startsWith("uploads/")) {
      return `${baseURL.replace(/\/$/, "")}/products/${s}`;
    }
    if (s.startsWith("products/uploads/")) {
      return `${baseURL.replace(/\/$/, "")}/${s}`;
    }
    if (s.startsWith("/")) return `${baseURL.replace(/\/$/, "")}${s}`;
    return `${baseURL.replace(/\/$/, "")}/products/uploads/${s.replace(
      /^\/+/,
      ""
    )}`;
  }

  function getImageUrlUnsafe(src?: string | null) {
    const normalized = normalizeImagePath(src);
    if (normalized) return normalized;
    return `${baseURL.replace(/\/$/, "")}/placeholder.png`;
  }

  // click order: open sidebar and highlight briefly
  const onClickOrder = (o: Order) => {
    setSelectedOrder(o);
    setHighlightedId(o.id);
    setTimeout(() => setHighlightedId(null), 3000);
  };

  const filterButtonClass = (key: typeof activeFilter) =>
    `px-3 py-1.5 rounded-full border transition-colors ${activeFilter === key
      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
    }`;

  // Show loading while checking auth
  if (authLoading) {
    return <OrdersAdminSkeleton />;
  }

  // Show sign-in prompt if not authenticated
  if (authError === "unauthorized") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <LogIn className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connexion requise</h2>
          <p className="text-gray-500 mb-6">
            Vous devez être connecté pour accéder à la gestion des commandes.
          </p>
          <SignInButton mode="modal">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
              Se connecter
            </Button>
          </SignInButton>
        </div>
      </div>
    );
  }

  // Show access denied if authenticated but not admin
  if (authError === "forbidden") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Accès refusé</h2>
          <p className="text-gray-500 mb-4">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <p className="text-sm text-gray-400">
            Connecté en tant que : {user?.emailAddresses?.[0]?.emailAddress || "Inconnu"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Commandes</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow flex items-center gap-3">
          <Package className="w-6 h-6 text-gray-500" />
          <div>
            <div className="text-sm text-gray-500">Total des commandes</div>
            <div className="text-2xl font-bold">{orders.length}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow flex items-center gap-3">
          <Truck className="w-6 h-6 text-gray-500" />
          <div>
            <div className="text-sm text-gray-500">Commandes livrées</div>
            <div className="text-2xl font-bold">{statusCounts.delivered}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow flex items-center gap-3">
          <RotateCcw className="w-6 h-6 text-gray-500" />
          <div>
            <div className="text-sm text-gray-500">Retours</div>
            <div className="text-2xl font-bold">{statusCounts.returned}</div>
          </div>
        </div>
      </div>

      <Input
        placeholder="Rechercher (ID, client, téléphone...)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full"
      />

      <div className="flex flex-wrap gap-3 md:gap-4 mb-6 text-sm">
        <button
          onClick={() => setActiveFilter("all")}
          className={filterButtonClass("all")}
        >
          Toutes {statusCounts.all}
        </button>
        <button
          onClick={() => setActiveFilter("pending")}
          className={filterButtonClass("pending")}
        >
          En attente {statusCounts.pending}
        </button>
        <button
          onClick={() => setActiveFilter("completed")}
          className={filterButtonClass("completed")}
        >
          Terminées {statusCounts.completed}
        </button>
        <button
          onClick={() => setActiveFilter("processed")}
          className={filterButtonClass("processed")}
        >
          En préparation {statusCounts.processed}
        </button>
        <button
          onClick={() => setActiveFilter("returned")}
          className={filterButtonClass("returned")}
        >
          Retournées {statusCounts.returned}
        </button>
        <button
          onClick={() => setActiveFilter("canceled")}
          className={filterButtonClass("canceled")}
        >
          Annulées {statusCounts.canceled}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-600 bg-red-50 p-3 rounded">
          Erreur : {error}
        </div>
      )}

      <div className="space-y-3">
        {paginatedOrders.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground bg-white rounded shadow">
            Aucune commande trouvée.
          </div>
        ) : (
          paginatedOrders.map((o) => {
            const firstItem = o.items?.[0];
            const imageUrl = getImageUrlUnsafe(firstItem?.product?.images?.[0]);
            const totalQty = o.items?.reduce(
              (sum, it) => sum + (it.quantity || 0),
              0
            );

            const isHighlighted = highlightedId === o.id;
            const isSelected = selectedOrder?.id === o.id;

            return (
              <div
                key={o.id}
                id={`order-${o.id}`}
                ref={(el) => refs.current.set(o.id, el)}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded shadow transition-all duration-200 hover:shadow-md hover:scale-[1.01] cursor-pointer bg-gray-50 ${isHighlighted ? "ring-2 ring-blue-400 bg-blue-50" : ""
                  } ${isSelected ? "bg-white" : ""}`}
                onClick={() => onClickOrder(o)}
              >
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                  <img
                    src={imageUrl}
                    alt={firstItem?.product?.title || "Commande"}
                    className="w-12 h-12 sm:w-10 sm:h-10 object-cover rounded"
                    onError={(e) => {
                      (
                        e.currentTarget as HTMLImageElement
                      ).src = `${baseURL.replace(/\/$/, "")}/placeholder.png`;
                    }}
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {firstItem?.product?.title || "Commande"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatOrderCode(o.id)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:gap-5 w-full sm:w-auto">
                  <div className="text-sm text-gray-500">
                    {totalQty} article{(totalQty || 0) > 1 ? "s" : ""}
                  </div>
                  <div className="font-semibold whitespace-nowrap">
                    {o.total.toFixed(2)} DT
                  </div>
                  <Badge
                    className={`${getStatusColor(
                      o.status
                    )} px-3 py-1 rounded-full whitespace-nowrap self-start sm:self-center`}
                  >
                    {getStatusLabel(o.status)}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <DotPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {selectedOrder && (
        <div className="fixed inset-x-0 bottom-0 top-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[420px] bg-white shadow-2xl p-6 overflow-y-auto z-50 border-t sm:border-t-0 sm:border-l border-gray-200 rounded-t-2xl sm:rounded-none sm:rounded-l-lg">
          <div className="flex justify-between items-start gap-3 mb-4">
            <h2 className="text-lg font-bold">
              {formatOrderCode(selectedOrder.id)}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedOrder(null)}
              aria-label="Fermer les détails de la commande"
            >
              Fermer
            </Button>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold mb-2">Articles</h3>
            {selectedOrder.items?.map((it) => (
              <div
                key={it.id ?? Math.random()}
                className="flex items-center gap-3 sm:gap-4 mb-3"
              >
                <img
                  src={getImageUrlUnsafe(it.product?.images?.[0])}
                  alt={it.product?.title}
                  className="w-12 h-12 object-cover rounded"
                  onError={(e) => {
                    (
                      e.currentTarget as HTMLImageElement
                    ).src = `${baseURL.replace(/\/$/, "")}/placeholder.png`;
                  }}
                />
                <div className="flex-1">
                  <div>{it.product?.title}</div>
                  <div className="text-sm text-gray-500">
                    {it.quantity} article{(it.quantity || 0) > 1 ? "s" : ""}
                  </div>
                  {(it.variant || it.color || it.size) && (
                    <div className="text-xs text-gray-500">
                      {[
                        it.variant,
                        it.color ? `Couleur : ${it.color}` : null,
                        it.size ? `Taille : ${it.size}` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  )}
                </div>
                <div>{(it.price || 0).toFixed(2)} DT</div>
              </div>
            ))}
          </div>

          <div className="mb-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <div className="text-gray-500">Créée le</div>
              <div>
                {new Date(selectedOrder.createdAt || "").toLocaleDateString()}
              </div>
            </div>
            <div className="flex justify-between gap-3">
              <div className="text-gray-500">Service de livraison</div>
              <div>Express</div>
            </div>
            <div className="flex justify-between gap-3 flex-wrap">
              <div className="text-gray-500">Mode de paiement</div>
              <div className="font-medium">
                {selectedOrder.paymentMethod === "card"
                  ? "Carte bancaire"
                  : selectedOrder.paymentMethod === "cod"
                    ? "Paiement à la livraison"
                    : selectedOrder.paymentMethod || "—"}
              </div>
            </div>

            <div className="flex justify-between items-center gap-3 flex-wrap">
              <div className="text-gray-500">Statut</div>
              <Select
                value={selectedOrder.status}
                onValueChange={(value) => changeStatus(selectedOrder.id, value)}
                disabled={updatingId === selectedOrder.id}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="processed">En préparation</SelectItem>
                  <SelectItem value="delivered">Livrée</SelectItem>
                  <SelectItem value="completed">Terminée</SelectItem>
                  <SelectItem value="returned">Retournée</SelectItem>
                  <SelectItem value="canceled">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between gap-3">
              <div className="text-gray-500">Client</div>
              <div>{selectedOrder.name || "Invité"}</div>
            </div>
            <div className="flex justify-between flex-wrap gap-3">
              <div className="text-gray-500">Email</div>
              <div className="text-blue-500">{selectedOrder.email || "—"}</div>
            </div>
            <div className="flex justify-between gap-3 flex-wrap">
              <div className="text-gray-500">Téléphone</div>
              <div>{selectedOrder.phone || "—"}</div>
            </div>
          </div>

          {/* Adresse de livraison */}
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Adresse de livraison</h3>
            {selectedOrder.address || selectedOrder.region ? (
              <div className="text-sm space-y-2 bg-gray-50 p-3 rounded-lg">
                {selectedOrder.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>{selectedOrder.address}</span>
                  </div>
                )}
                {selectedOrder.region && (
                  <div className="text-gray-600">
                    <span className="font-medium">Gouvernorat:</span> {selectedOrder.region}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic bg-gray-50 p-3 rounded-lg">
                Adresse non disponible
              </div>
            )}
          </div>

          <div className="mb-4">
            <h3 className="font-semibold mb-2">Historique</h3>
            <div className="space-y-4">
              {[
                {
                  label: "Commande en préparation",
                  desc: "Les produits sont en cours de préparation et d'emballage.",
                },
                {
                  label: "Paiement confirmé",
                  desc: "Le paiement a été traité et vérifié avec succès.",
                },
                {
                  label: "Commande passée",
                  desc: "Le client a validé sa commande avec succès.",
                },
              ].map((step, index) => {
                const statusOrder = [
                  "pending",
                  "processed",
                  "delivered",
                  "completed",
                ];
                const currentIndex = statusOrder.indexOf(selectedOrder.status);
                const isActive =
                  index <= currentIndex - 1 ||
                  (selectedOrder.status === "completed" && index <= 2);
                const bgColor = isActive
                  ? "bg-blue-500 text-white"
                  : "bg-gray-300 text-white";
                return (
                  <div key={index} className="flex gap-2 items-start">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs mt-1 ${bgColor}`}
                    >
                      {isActive ? "✓" : ""}
                    </div>
                    <div>
                      <div className="font-medium">{step.label}</div>
                      <div className="text-sm text-gray-500">{step.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Paiement</h3>
            {(() => {
              const subtotal =
                selectedOrder.items?.reduce(
                  (sum, it) => sum + (it.price || 0) * (it.quantity || 0),
                  0
                ) || 0;
              const shipping = selectedOrder.total - subtotal;
              return (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <div>Sous-total</div>
                    <div>{subtotal.toFixed(2)} DT</div>
                  </div>
                  <div className="flex justify-between">
                    <div>Frais de livraison</div>
                    <div>{shipping.toFixed(2)} DT</div>
                  </div>
                  <div className="flex justify-between font-bold">
                    <div>Total</div>
                    <div>{selectedOrder.total.toFixed(2)} DT</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Cancellation info (if canceled) */}
          {selectedOrder.status === "canceled" && selectedOrder.cancelReason && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-700 flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4" />
                Commande annulée
              </h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-medium">Raison :</span>{" "}
                  {selectedOrder.cancelReason}
                </p>
                {selectedOrder.canceledAt && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(selectedOrder.canceledAt).toLocaleString("fr-FR")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cancel button (if order can be canceled) */}
          {canCancelOrder(selectedOrder) && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={() => openCancelDialog(selectedOrder)}
                disabled={updatingId === selectedOrder.id}
              >
                <XCircle className="h-4 w-4" />
                Annuler cette commande
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Cancel Order Dialog */}
      <CancelOrderDialog
        isOpen={cancelDialogOpen}
        onClose={() => {
          setCancelDialogOpen(false);
          setCancelingOrder(null);
        }}
        onConfirm={handleCancelOrder}
        orderId={cancelingOrder?.id ?? 0}
        orderCode={formatOrderCode(cancelingOrder?.id ?? 0)}
      />
    </div>
  );
}
