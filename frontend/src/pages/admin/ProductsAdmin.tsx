/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/pages/admin/ProductsAdmin.tsx */

import {
  useEffect,
  useState,
  type ChangeEventHandler,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
import {
  Eye,
  EyeOff,
  FileSpreadsheet,
  PlusCircle,
  ChevronDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { ProductsAdminSkeleton } from "@/components/skeletons";
import DotPagination from "@/components/DotPagination";

type Product = {
  id: number;
  title: string;
  description?: string;
  pricePiece?: number | null;
  priceQuantity?: number | null;
  saleType?: string | null;
  displayPrice?: number | null;
  displayFlashPrice?: number | null;
  venteFlashActive?: boolean;
  venteFlashPercentage?: number | null;
  venteFlashPrice?: number | null;
  shippingPrice?: number | null;
  images?: string[]; // peut être "/uploads/...", "/products/uploads/...", filename, ou URL complète
  category: string;
  subCategory?: string | null;
  inStock: boolean;
  visible: boolean;  // New: true = public, false = hidden
  publishAt?: string | null; // New: scheduled publish date
  availableQuantity: number;
};

type LowStockAlert = {
  productId: number;
  productTitle: string;
  combinationId: string | null;
  combinationLabel: string;
  stock: number;
  minStockAlert: number;
};

const ModernSelect = ({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  children: ReactNode;
  className?: string;
}) => (
  <div className={`relative ${className}`}>
    <select
      value={value}
      onChange={onChange}
      className="w-full appearance-none bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg px-3 pr-10 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
    >
      {children}
    </select>
    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

export default function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filters, setFilters] = useState({
    title: "",
    category: "",
    subCategory: "",
    inStock: "all",
  });
  const [showFilters, setShowFilters] = useState(true);
  const [editingQuantity, setEditingQuantity] = useState<number | null>(null);
  const [tempQuantity, setTempQuantity] = useState("");
  const [openSaleId, setOpenSaleId] = useState<number | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [alertsExpanded, setAlertsExpanded] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;

  const navigate = useNavigate();
  const location = useLocation();

  // Fermer le dropdown "Type de vente" au clic extérieur
  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-sale-dropdown='true']")) {
        setOpenSaleId(null);
      }
    };
    document.addEventListener("click", closeOnOutside);
    return () => document.removeEventListener("click", closeOnOutside);
  }, []);

  // Pré-remplir la recherche si on arrive avec ?search=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const term = params.get("search");
    if (term !== null) {
      setFilters((prev) => ({ ...prev, title: term }));
    }
  }, [location.search]);

  // Récupérer la base API (axios peut avoir defaults.baseURL)
  function getApiBase(): string {
    try {
      const base = (api as any).defaults?.baseURL;
      if (base) return String(base).replace(/\/$/, "");
    } catch {
      // ignore
    }
    // Fallback: même host, port 4000 (à adapter si besoin)
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  function formatPrice(value?: number | null) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "-";
    }
    try {
      return new Intl.NumberFormat("fr-TN", {
        style: "currency",
        currency: "TND",
      }).format(value);
    } catch {
      return `${Number(value).toFixed(2)} DT`;
    }
  }

  const SALE_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "both", label: "Les deux" },
    { value: "piece", label: "Vente à l'unité" },
    { value: "quantity", label: "Vente en gros" },
  ];

  /**
   * normalizeImageUrl
   * Accepte une valeur renvoyée par le backend (peut être :
   *  - URL complète (http(s)://...)
   *  - root-relative "/uploads/filename"
   *  - router-relative "/products/uploads/filename"
   *  - filename "1634234.jpg"
   * Retourne une URL absolue utilisable dans <img src="...">
   */
  function normalizeImageUrl(src?: string | null) {
    if (!src) return "/placeholder.png";

    const s = String(src).trim();
    if (s.length === 0) return "/placeholder.png";

    // Déjà une URL absolue
    if (/^https?:\/\//i.test(s) || /^\/\//.test(s)) return s;

    const apiBase = getApiBase(); // ex. "http://localhost:4000"

    // Déjà en /products/uploads ou /uploads
    if (s.startsWith("/products/uploads")) {
      return `${apiBase}${s}`;
    }

    if (s.startsWith("/uploads")) {
      // Le router products expose souvent les uploads sous /products/uploads
      return `${apiBase}/products${s}`;
    }

    // Autre chemin root-relative
    if (s.startsWith("/")) {
      return `${apiBase}${s}`;
    }

    // Cas filename ou chemin relatif
    if (s.startsWith("products/uploads/")) {
      return `${apiBase}/${s}`;
    }
    if (s.startsWith("uploads/")) {
      return `${apiBase}/products/${s}`;
    }

    // Fallback: fichier dans uploads
    return `${apiBase}/products/uploads/${s.replace(/^\/+/, "")}`;
  }

  const fetchLowStock = async () => {
    try {
      const res = await api.get("/products/low-stock");
      const data: LowStockAlert[] = Array.isArray(res.data) ? res.data : [];
      setLowStockAlerts(data);
    } catch (err) {
      console.warn("Échec du chargement des alertes stock", err);
    }
  };

  // Charger les produits
  const load = async () => {
    try {
      const query = new URLSearchParams();
      if (filters.title) query.append("title", filters.title);
      if (filters.category) query.append("category", filters.category);
      if (filters.subCategory) query.append("subCategory", filters.subCategory);

      // Admin requests bypass visibility filter
      const res = await api.get(`/products?${query.toString()}`, {
        headers: { "x-admin-request": "true" }
      });
      const data: Product[] = Array.isArray(res.data) ? res.data : [];

      const normalized = data.map((p) => ({
        ...p,
        images: p.images || [],
        visible: p.visible !== false, // Default to true if undefined
        availableQuantity: p.availableQuantity ?? 0,
        inStock: p.inStock ?? (p.availableQuantity ?? 0) > 0,
      }));

      // Filtre stock côté client (au cas où l'API ne le gère pas)
      const stockFiltered =
        filters.inStock === "all"
          ? normalized
          : normalized.filter(
            (p) =>
              (p.inStock ?? (p.availableQuantity ?? 0) > 0) ===
              (filters.inStock === "true")
          );

      setProducts(stockFiltered);
      fetchLowStock();
    } catch (err) {
      console.error("Échec du chargement des produits", err);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    fetchLowStock();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Pagination computed values
  const totalPages = Math.max(1, Math.ceil(products.length / productsPerPage));
  const paginatedProducts = products.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );

  // Mettre à jour un champ produit
  const updateProduct = async (id: number, updates: Partial<Product>) => {
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return;

    const oldProducts = [...products];
    const newProducts = [...products];
    newProducts[index] = { ...newProducts[index], ...updates };
    setProducts(newProducts);

    try {
      await api.patch(`/products/${id}`, updates);
      fetchLowStock();
    } catch (err) {
      console.error("Échec de la mise à jour du produit", err);
      setProducts(oldProducts);
    }
  };

  // Édition de quantité — met à jour inStock automatiquement
  const handleQuantityEdit = (id: number, qty: number) => {
    setEditingQuantity(id);
    setTempQuantity(qty.toString());
  };

  const saveQuantity = async (id: number) => {
    const newQty = parseInt(tempQuantity, 10) || 0;
    if (newQty < 0) return;

    const inStock = newQty > 0;
    await updateProduct(id, { availableQuantity: newQty, inStock });
    setEditingQuantity(null);
    setTempQuantity("");
  };

  // Toggle statut stock — met la quantité à 0 si on passe en rupture
  const toggleStockStatus = async (p: Product) => {
    const newStatus = !p.inStock;
    const updates: Partial<Product> = { inStock: newStatus };

    if (!newStatus) {
      updates.availableQuantity = 0;
    }

    await updateProduct(p.id, updates);
  };

  // Supprimer avec confirmation
  const deleteProduct = async () => {
    if (!productToDelete) return;
    try {
      setDeleteLoading(true);
      await api.delete(`/products/${productToDelete.id}`);
      await load();
    } catch (err) {
      console.error("Échec de la suppression du produit", err);
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const askDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleAddNew = () => navigate("/admin/products/new");

  // Export Excel
  const exportToExcel = () => {
    const dataToExport = products.map((p) => ({
      ID: p.id,
      Nom: p.title,
      Catégorie: p.category,
      "Sous-catégorie": p.subCategory || "-",
      "Type de vente": p.saleType || "both",
      "Prix pièce": p.pricePiece ?? "-",
      "Prix quantité": p.priceQuantity ?? "-",
      "Vente flash active": p.venteFlashActive ? "Oui" : "Non",
      "Pourcentage flash": p.venteFlashPercentage ?? "-",
      "Prix flash":
        p.venteFlashPrice ?? p.displayFlashPrice ?? p.pricePiece ?? "-",
      "Qté disponible": p.availableQuantity,
      Statut: p.inStock ? "En stock" : "Rupture",
      Visibilité: p.visible ? "Publique" : "Masquée",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produits");
    XLSX.writeFile(wb, "liste_produits.xlsx");
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Produits</h1>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center justify-center gap-1 sm:gap-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-all h-10 sm:h-12 text-sm sm:text-base"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden xs:inline">Exporter</span>
            <span className="hidden sm:inline"> Excel</span>
          </button>
          <button
            onClick={handleAddNew}
            className="flex items-center justify-center gap-1 sm:gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-all h-10 sm:h-12 text-sm sm:text-base"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden xs:inline">Ajouter</span>
            <span className="hidden sm:inline"> un produit</span>
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="border border-gray-300 bg-white px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 h-10 sm:h-12 text-xs sm:text-sm font-medium"
          >
            {showFilters ? "Masquer" : "Filtres"}
          </button>
        </div>
      </div>

      {/* Alertes stock minimum - Modern Design */}
      <div className={`rounded-2xl mb-6 overflow-hidden transition-all duration-300 ${lowStockAlerts.length > 0
        ? "bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 border border-red-200/50 shadow-lg shadow-red-100/50"
        : "bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/50 shadow-lg shadow-emerald-100/50"
        }`}>
        <button
          onClick={() => setAlertsExpanded(!alertsExpanded)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/30 transition-all duration-200"
        >
          <div className="flex items-center gap-4">
            {/* Animated Icon */}
            <div className={`relative h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold transition-all duration-300 ${lowStockAlerts.length > 0
              ? "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-300/50"
              : "bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg shadow-emerald-300/50"
              }`}>
              {lowStockAlerts.length > 0 ? (
                <>
                  <span className="relative z-10">{lowStockAlerts.length}</span>
                  <span className="absolute inset-0 rounded-2xl animate-ping bg-red-400/30"></span>
                </>
              ) : (
                <span>✓</span>
              )}
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Alertes stock
                {lowStockAlerts.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 animate-pulse">
                    Action requise
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {lowStockAlerts.length === 0
                  ? "Tous les stocks sont au-dessus du seuil d'alerte"
                  : `${lowStockAlerts.length} produit${lowStockAlerts.length > 1 ? "s" : ""} nécessite${lowStockAlerts.length > 1 ? "nt" : ""} votre attention`}
              </p>
            </div>
          </div>
          <div className={`p-2 rounded-xl transition-all duration-300 ${alertsExpanded ? "bg-white/50 rotate-180" : "bg-white/30"
            }`}>
            <ChevronDown className="w-5 h-5 text-gray-600" />
          </div>
        </button>

        {alertsExpanded && lowStockAlerts.length > 0 && (
          <div className="px-5 pb-5 space-y-3">
            {lowStockAlerts.map((alert, index) => {
              const isCritical = alert.stock === 0;
              const stockPercentage = Math.min(100, (alert.stock / Math.max(alert.minStockAlert * 2, 1)) * 100);

              return (
                <div
                  key={`${alert.productId}-${alert.combinationId ?? "base"}`}
                  className="group bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white shadow-sm hover:shadow-md hover:bg-white transition-all duration-200"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isCritical
                          ? "bg-gradient-to-br from-red-100 to-red-200 text-red-600"
                          : "bg-gradient-to-br from-rose-100 to-red-200 text-red-600"
                          }`}>
                          <span className="text-lg font-bold">{alert.stock}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {alert.productTitle}
                          </p>
                          {alert.combinationId ? (
                            <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                              {alert.combinationLabel}
                            </span>
                          ) : (
                            <p className="text-xs text-gray-500 mt-0.5">Stock principal</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stock Progress Bar */}
                    <div className="sm:w-48">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-gray-500">Stock</span>
                        <span className={`font-semibold text-red-600`}>
                          {alert.stock} / {alert.minStockAlert * 2}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isCritical
                            ? "bg-gradient-to-r from-red-500 to-red-600"
                            : "bg-gradient-to-r from-red-400 to-rose-500"
                            }`}
                          style={{ width: `${stockPercentage}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Seuil d'alerte: {alert.minStockAlert}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className="sm:w-24 flex justify-end">
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-700 text-white text-xs font-semibold shadow-sm shadow-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                          Rupture
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-semibold shadow-sm shadow-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                          Stock bas
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {alertsExpanded && lowStockAlerts.length === 0 && (
          <div className="px-5 pb-6 pt-2">
            <div className="flex flex-col items-center justify-center py-8 bg-white/50 rounded-xl border border-emerald-100">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white text-2xl mb-3 shadow-lg shadow-emerald-200">
                ✓
              </div>
              <p className="text-gray-700 font-medium">Tout est en ordre !</p>
              <p className="text-sm text-gray-500 mt-1">Aucune alerte de stock en cours</p>
            </div>
          </div>
        )}
      </div>

      {/* Filtres */}
      {showFilters && (
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm mb-4 sm:mb-6 border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <input
              placeholder="Rechercher par titre"
              value={filters.title}
              onChange={(e) =>
                setFilters({ ...filters, title: e.target.value })
              }
              className="border border-gray-300 p-2 rounded-md text-sm"
            />
            <input
              placeholder="Catégorie"
              value={filters.category}
              onChange={(e) =>
                setFilters({ ...filters, category: e.target.value })
              }
              className="border border-gray-300 p-2 rounded-md text-sm"
            />
            <input
              placeholder="Sous-catégorie"
              value={filters.subCategory}
              onChange={(e) =>
                setFilters({ ...filters, subCategory: e.target.value })
              }
              className="border border-gray-300 p-2 rounded-md text-sm"
            />
            <ModernSelect
              value={filters.inStock}
              onChange={(e) =>
                setFilters({ ...filters, inStock: e.target.value })
              }
            >
              <option value="all">Toutes</option>
              <option value="true">En stock</option>
              <option value="false">Rupture</option>
            </ModernSelect>
          </div>
        </div>
      )}

      {/* Products - Mobile Cards + Desktop Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
        {/* Desktop Table - hidden on mobile */}
        <div className="hidden lg:block w-full overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  "Image",
                  "Nom",
                  "Catégorie",
                  "Statut",
                  "Qté",
                  "Tarifs",
                  "Vente flash",
                  "Type de vente",
                  "Visibilité",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500">
                    Aucun produit trouvé.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const rawImg = p.images?.[0] ?? null;
                  const imgSrc = normalizeImageUrl(rawImg);

                  const saleLabel =
                    SALE_TYPE_OPTIONS.find(
                      (opt) => opt.value === (p.saleType || "both")
                    )?.label ?? "Les deux";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 transition-colors duration-100"
                    >
                      <td className="px-3 py-3">
                        <img
                          src={imgSrc}
                          alt={p.title}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/placeholder.png";
                          }}
                          className="w-10 h-10 object-cover rounded-md border"
                        />
                      </td>

                      <td className="px-3 py-3 font-medium text-gray-900 max-w-[150px] truncate">
                        {p.title}
                      </td>

                      <td className="px-3 py-3 text-sm">{p.category}</td>

                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleStockStatus(p)}
                          className={`px-2 py-1 rounded-full text-xs border ${p.inStock
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-red-100 text-red-800 border-red-200"
                            }`}
                        >
                          {p.inStock ? "En stock" : "Rupture"}
                        </button>
                      </td>

                      <td className="px-3 py-3">
                        {editingQuantity === p.id ? (
                          <input
                            type="number"
                            value={tempQuantity}
                            onChange={(e) => setTempQuantity(e.target.value)}
                            onBlur={() => saveQuantity(p.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveQuantity(p.id);
                              if (e.key === "Escape") {
                                setEditingQuantity(null);
                                setTempQuantity("");
                              }
                            }}
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm w-16"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() =>
                              handleQuantityEdit(p.id, p.availableQuantity)
                            }
                            className="cursor-pointer text-blue-600 hover:underline"
                            title="Cliquer pour modifier"
                          >
                            {p.availableQuantity}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-xs">
                        <div>Pièce: {p.pricePiece ?? "-"}</div>
                        <div>Qté: {p.priceQuantity ?? "-"}</div>
                      </td>

                      <td className="px-3 py-3 text-xs">
                        {p.venteFlashActive ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                              🔥 Actif
                            </span>
                            <div className="text-xs text-gray-600">
                              -{p.venteFlashPercentage ?? 0}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">
                            Désactivée
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="relative" data-sale-dropdown="true">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenSaleId((prev) =>
                                prev === p.id ? null : p.id
                              )
                            }
                            className="w-36 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 hover:shadow-sm transition"
                          >
                            <span className="truncate">{saleLabel}</span>
                            <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
                          </button>

                          <div
                            className={`absolute z-30 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden transform origin-top transition ${openSaleId === p.id
                              ? "opacity-100 scale-100"
                              : "opacity-0 scale-95 pointer-events-none"
                              }`}
                          >
                            <div className="py-1">
                              {SALE_TYPE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    updateProduct(p.id, {
                                      saleType: opt.value,
                                    });
                                    setOpenSaleId(null);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition ${(p.saleType || "both") === opt.value
                                    ? "bg-gray-50 font-semibold"
                                    : ""
                                    }`}
                                >
                                  <span className="inline-flex h-2 w-2 rounded-full bg-gray-300" />
                                  <span>{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <button
                          onClick={() =>
                            updateProduct(p.id, {
                              visible: !p.visible,
                            })
                          }
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${p.visible
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-800 border-gray-200"
                            }`}
                        >
                          {p.visible ? (
                            <Eye className="w-3 h-3 mr-1" />
                          ) : (
                            <EyeOff className="w-3 h-3 mr-1" />
                          )}
                          {p.visible ? "Publique" : "Masquée"}
                        </button>
                      </td>

                      <td className="px-3 py-3 text-xs">
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              navigate(`/admin/products/${p.id}/edit`)
                            }
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => askDeleteProduct(p)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards - hidden on desktop */}
        <div className="lg:hidden divide-y divide-gray-100">
          {products.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucun produit trouvé.
            </div>
          ) : (
            paginatedProducts.map((p) => {
              const rawImg = p.images?.[0] ?? null;
              const imgSrc = normalizeImageUrl(rawImg);

              const saleLabel =
                SALE_TYPE_OPTIONS.find(
                  (opt) => opt.value === (p.saleType || "both")
                )?.label ?? "Les deux";

              return (
                <div
                  key={p.id}
                  className="p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Product Header - Image + Title + Status */}
                  <div className="flex items-start gap-3 mb-3">
                    <img
                      src={imgSrc}
                      alt={p.title}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.png";
                      }}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-sm sm:text-base line-clamp-2">
                        {p.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                        {p.category}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <button
                          onClick={() => toggleStockStatus(p)}
                          className={`px-2 py-0.5 rounded-full text-xs border ${p.inStock
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-red-100 text-red-800 border-red-200"
                            }`}
                        >
                          {p.inStock ? "En stock" : "Rupture"}
                        </button>
                        <button
                          onClick={() =>
                            updateProduct(p.id, {
                              visible: !p.visible,
                            })
                          }
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${p.visible
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-800 border-gray-200"
                            }`}
                        >
                          {p.visible ? (
                            <Eye className="w-3 h-3 mr-1" />
                          ) : (
                            <EyeOff className="w-3 h-3 mr-1" />
                          )}
                          {p.visible ? "Publique" : "Masquée"}
                        </button>
                        {p.venteFlashActive && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                            🔥 -{p.venteFlashPercentage ?? 0}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Product Details Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-500 text-xs">Qté disponible:</span>
                      <div className="font-medium">
                        {editingQuantity === p.id ? (
                          <input
                            type="number"
                            value={tempQuantity}
                            onChange={(e) => setTempQuantity(e.target.value)}
                            onBlur={() => saveQuantity(p.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveQuantity(p.id);
                              if (e.key === "Escape") {
                                setEditingQuantity(null);
                                setTempQuantity("");
                              }
                            }}
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm w-20"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() =>
                              handleQuantityEdit(p.id, p.availableQuantity)
                            }
                            className="cursor-pointer text-blue-600 hover:underline"
                          >
                            {p.availableQuantity}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Tarifs:</span>
                      <div className="text-xs">
                        <div>Pièce: {p.pricePiece ?? "-"}</div>
                        <div>Qté: {p.priceQuantity ?? "-"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Type de vente dropdown */}
                  <div className="mb-3" data-sale-dropdown="true">
                    <span className="text-gray-500 text-xs block mb-1">Type de vente:</span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSaleId((prev) => (prev === p.id ? null : p.id))
                        }
                        className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                      >
                        <span>{saleLabel}</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>

                      <div
                        className={`absolute z-30 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden transform origin-top transition ${openSaleId === p.id
                          ? "opacity-100 scale-100"
                          : "opacity-0 scale-95 pointer-events-none"
                          }`}
                      >
                        <div className="py-1">
                          {SALE_TYPE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                updateProduct(p.id, {
                                  saleType: opt.value,
                                });
                                setOpenSaleId(null);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition ${(p.saleType || "both") === opt.value
                                ? "bg-gray-50 font-semibold"
                                : ""
                                }`}
                            >
                              <span className="inline-flex h-2 w-2 rounded-full bg-gray-300" />
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/admin/products/${p.id}/edit`)}
                      className="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => askDeleteProduct(p)}
                      className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      <DotPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !deleteLoading) setProductToDelete(null);
        }}
        title="Supprimer ce produit ?"
        description={`Cette action retirera ${productToDelete?.title ?? "ce produit"
          } du catalogue.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        loading={deleteLoading}
        onConfirm={deleteProduct}
      />
    </div>
  );
}
