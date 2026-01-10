// src/pages/admin/AdminLayout.tsx
import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

// Preload admin page chunks when AdminLayout mounts for instant navigation
const preloadAdminPages = () => {
  // These imports trigger the lazy() chunks to load in the background
  import("./Dashboard");
  import("./ProductsAdmin");
  import("./OrdersAdmin");
  import("./ClientsAdmin");
  import("./EmployeesAdmin");
  import("./AddProduct");
  import("./EditProduct");
  import("./SettingsAdmin");
};
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Plus,
  Search,
  Menu,
  X,
  User,
  ShieldCheck,
  Settings,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NotificationBell from "@/components/NotificationBell";
import { useClerk, useUser, useAuth } from "@clerk/clerk-react";
import api, { createAuthenticatedApi } from "@/lib/api";

type SearchResponse = {
  products: Array<{
    id: number;
    title: string;
    category?: string | null;
    subCategory?: string | null;
    productId?: string | null;
  }>;
  orders: Array<{
    id: number;
    status: string;
    total: number;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
  clients: Array<{
    id: number;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
  employees: Array<{
    id: number;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    role: string;
    isActive: boolean;
  }>;
};

const SidebarItem: React.FC<{
  to: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}> = ({ to, label, icon, onClick }) => {
  const location = useLocation();
  const active =
    location.pathname === to ||
    (to !== "/admin" && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors truncate ${active
        ? "bg-primary text-black font-medium"
        : "text-muted-foreground hover:bg-muted hover:text-black"
        }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
};

const AdminLayout: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(
    null
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const clerk = useClerk();

  // Preload all admin page chunks on mount for instant navigation
  useEffect(() => {
    preloadAdminPages();
  }, []);

  // Employee role for role-based sidebar visibility - CACHED with React Query
  const { data: roleData } = useQuery({
    queryKey: ["employeeRole"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return null;
      const authApi = createAuthenticatedApi(token);
      const res = await authApi.get("/api/me/role");
      return res.data;
    },
    enabled: isSignedIn,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: false,
  });

  const employeeRole = roleData?.isActive ? roleData?.role : null;

  // Role-based access helpers
  const canAccessDashboard = employeeRole === "ADMIN";
  const canAccessProducts = employeeRole === "ADMIN" || employeeRole === "PRODUCT_MANAGER";
  const canAccessOrders = employeeRole === "ADMIN" || employeeRole === "ORDER_MANAGER";
  const canAccessClients = employeeRole === "ADMIN" || employeeRole === "PRODUCT_MANAGER" || employeeRole === "ORDER_MANAGER";
  const canAccessEmployees = employeeRole === "ADMIN";
  const canAccessSettings = employeeRole === "ADMIN";
  const canAccessCalendar = employeeRole === "ADMIN" || employeeRole === "PRODUCT_MANAGER" || employeeRole === "ORDER_MANAGER";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }

    if (userMenuOpen) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => document.removeEventListener("click", handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get<SearchResponse>("/admin/search", {
          params: { q: term },
        });
        setSearchResults(res.data);
        setSearchOpen(true);
      } catch (err) {
        console.error("Admin search failed", err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [searchTerm]);

  const handleReturnToClient = () => {
    navigate("/");
    setUserMenuOpen(false);
  };

  const handleOpenProfile = () => {
    clerk.openUserProfile();
    setUserMenuOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await clerk.signOut();
    } catch (err) {
      console.error("Admin sign out failed", err);
    } finally {
      setUserMenuOpen(false);
      navigate("/");
    }
  };

  const formatOrderCode = (value: number | string) => {
    const numeric = Number(value);
    const base = Number.isNaN(numeric)
      ? String(value)
      : Math.max(0, numeric).toString().padStart(3, "0");
    return `#OR${base}`;
  };

  const resetSearch = () => {
    setSearchTerm("");
    setSearchResults(null);
    setSearchOpen(false);
  };

  const makeSearchQuery = (term: string) =>
    term ? `?search=${encodeURIComponent(term)}` : "";

  const handleNavigate = (path: string, state?: Record<string, unknown>) => {
    const term = searchTerm.trim();
    navigate(`${path}${makeSearchQuery(term)}`, { state });
    resetSearch();
  };

  return (
    <div className="min-h-screen bg-muted flex">
      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-border h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="p-2 rounded hover:bg-muted"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo-removebg-preview.png"
              alt="Logo"
              className="w-10"
            />
            <div className="text-sm font-medium">Administration Folla</div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Use full NotificationBell component on mobile header too */}
          <NotificationBell />
        </div>
      </header>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col w-[240px] bg-white border-r border-border">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/logo-removebg-preview.png"
                alt="Logo"
                className="w-16"
              />
              <div className="text-xs text-black mt-1">E-commerce Admin</div>
            </Link>
          </div>
        </div>

        <nav className="p-4 space-y-1 flex-1">
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-4">
            ADMIN ACCESS
          </div>
          {canAccessDashboard && (
            <SidebarItem
              to="/admin"
              label="Dashboard"
              icon={<LayoutDashboard className="w-5 h-5" />}
            />
          )}
          {canAccessProducts && (
            <>
              <SidebarItem
                to="/admin/products"
                label="Products"
                icon={<Package className="w-5 h-5" />}
              />
              <SidebarItem
                to="/admin/products/new"
                label="Add Product"
                icon={<Plus className="w-5 h-5" />}
              />
            </>
          )}
          {canAccessOrders && (
            <SidebarItem
              to="/admin/orders"
              label="Orders"
              icon={<ShoppingCart className="w-5 h-5" />}
            />
          )}
          {canAccessClients && (
            <SidebarItem
              to="/admin/clients"
              label="Clients"
              icon={<Users className="w-5 h-5" />}
            />
          )}
          {canAccessEmployees && (
            <SidebarItem
              to="/admin/employees"
              label="Employees"
              icon={<ShieldCheck className="w-5 h-5" />}
            />
          )}
          {canAccessSettings && (
            <SidebarItem
              to="/admin/settings"
              label="Paramètres"
              icon={<Settings className="w-5 h-5" />}
            />
          )}
          {canAccessCalendar && (
            <SidebarItem
              to="/admin/calendar"
              label="Calendrier"
              icon={<Calendar className="w-5 h-5" />}
            />
          )}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
              <span className="text-black font-medium text-sm">SJ</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-black truncate">
                Salim Jlidi
              </div>
              <div className="text-xs text-black truncate">Admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar (overlay) */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-lg p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <Link to="/" onClick={() => setOpen(false)} className="flex">
                <img
                  src="/logo-removebg-preview.png"
                  alt="Logo"
                  className="w-12"
                />
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="p-2 rounded hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="space-y-2">
              {canAccessDashboard && (
                <SidebarItem
                  to="/admin"
                  label="Tableau de bord"
                  icon={<LayoutDashboard className="w-5 h-5" />}
                  onClick={() => setOpen(false)}
                />
              )}
              {canAccessProducts && (
                <>
                  <SidebarItem
                    to="/admin/products"
                    label="Produits"
                    icon={<Package className="w-5 h-5" />}
                    onClick={() => setOpen(false)}
                  />
                  <SidebarItem
                    to="/admin/products/new"
                    label="Ajouter un produit"
                    icon={<Plus className="w-5 h-5" />}
                    onClick={() => setOpen(false)}
                  />
                </>
              )}
              {canAccessOrders && (
                <SidebarItem
                  to="/admin/orders"
                  label="Commandes"
                  icon={<ShoppingCart className="w-5 h-5" />}
                  onClick={() => setOpen(false)}
                />
              )}
              {canAccessClients && (
                <SidebarItem
                  to="/admin/clients"
                  label="Clients"
                  icon={<Users className="w-5 h-5" />}
                  onClick={() => setOpen(false)}
                />
              )}
              {canAccessEmployees && (
                <SidebarItem
                  to="/admin/employees"
                  label="Employés"
                  icon={<ShieldCheck className="w-5 h-5" />}
                  onClick={() => setOpen(false)}
                />
              )}
              {canAccessSettings && (
                <SidebarItem
                  to="/admin/settings"
                  label="Paramètres"
                  icon={<Settings className="w-5 h-5" />}
                  onClick={() => setOpen(false)}
                />
              )}
              {canAccessCalendar && (
                <SidebarItem
                  to="/admin/calendar"
                  label="Calendrier"
                  icon={<Calendar className="w-5 h-5" />}
                  onClick={() => setOpen(false)}
                />
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col ">
        <main className="flex-1 flex flex-col min-w-0">
          {/* Desktop header */}
          <header className="hidden md:flex h-16 bg-white border-b border-border items-center justify-between px-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  className="pl-10 bg-background"
                  value={searchTerm}
                  onFocus={() => {
                    if (searchResults) setSearchOpen(true);
                  }}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchOpen(false);
                    }
                  }}
                />
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-muted-foreground/40 border-t-primary rounded-full animate-spin" />
                  </div>
                )}
                {searchOpen && searchResults && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-border rounded-lg shadow-lg z-30 max-h-[70vh] overflow-y-auto">
                    <div className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase">
                      Recherche globale
                    </div>

                    <div className="border-t border-border">
                      <div className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase">
                        Commandes
                      </div>
                      {searchResults.orders.length === 0 ? (
                        <div className="px-4 pb-2 text-sm text-muted-foreground">
                          Aucune commande
                        </div>
                      ) : (
                        searchResults.orders.map((order) => (
                          <button
                            key={`order-${order.id}`}
                            onClick={() =>
                              handleNavigate("/admin/orders", {
                                openOrderId: order.id,
                              })
                            }
                            className="w-full text-left px-4 py-2 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center justify-between text-sm text-black">
                              <span className="font-medium">
                                {formatOrderCode(order.id)}
                              </span>
                              <span className="text-xs text-muted-foreground capitalize">
                                {order.status}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[order.name, order.email, order.phone]
                                .filter(Boolean)
                                .join(" • ") || "Sans client"}
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="border-t border-border">
                      <div className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase">
                        Produits
                      </div>
                      {searchResults.products.length === 0 ? (
                        <div className="px-4 pb-2 text-sm text-muted-foreground">
                          Aucun produit
                        </div>
                      ) : (
                        searchResults.products.map((product) => (
                          <button
                            key={`product-${product.id}`}
                            onClick={() => handleNavigate("/admin/products")}
                            className="w-full text-left px-4 py-2 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center justify-between text-sm text-black">
                              <span className="font-medium truncate">
                                {product.title}
                              </span>
                              {product.productId ? (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {product.productId}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[product.category, product.subCategory]
                                .filter(Boolean)
                                .join(" • ") || "Non classe"}
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="border-t border-border">
                      <div className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase">
                        Clients
                      </div>
                      {searchResults.clients.length === 0 ? (
                        <div className="px-4 pb-2 text-sm text-muted-foreground">
                          Aucun client
                        </div>
                      ) : (
                        searchResults.clients.map((client) => (
                          <button
                            key={`client-${client.id}`}
                            onClick={() => handleNavigate("/admin/clients")}
                            className="w-full text-left px-4 py-2 hover:bg-muted transition-colors"
                          >
                            <div className="text-sm text-black font-medium truncate">
                              {client.name || "Client sans nom"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[client.email, client.phone]
                                .filter(Boolean)
                                .join(" • ") || "Pas de contact"}
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="border-t border-border rounded-b-lg">
                      <div className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase">
                        Employees
                      </div>
                      {searchResults.employees.length === 0 ? (
                        <div className="px-4 pb-3 text-sm text-muted-foreground">
                          Aucun employe
                        </div>
                      ) : (
                        searchResults.employees.map((employee) => (
                          <button
                            key={`employee-${employee.id}`}
                            onClick={() => handleNavigate("/admin/employees")}
                            className="w-full text-left px-4 py-2 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center justify-between text-sm text-black">
                              <span className="font-medium truncate">
                                {employee.fullName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {employee.role.toLowerCase()}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[employee.email, employee.phone]
                                .filter(Boolean)
                                .join(" • ") || "Pas de contact"}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notification bell (full dropdown UI) */}
              <NotificationBell />

              {isSignedIn ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-black hover:bg-gray-50 transition-colors"
                    aria-label="Menu administrateur"
                  >
                    <User className="w-5 h-5" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 rounded-md border border-border bg-white shadow-md z-10">
                      <ul className="py-1 text-sm text-black">
                        <li>
                          <button
                            onClick={handleReturnToClient}
                            className="w-full text-left px-4 py-2 hover:bg-muted"
                          >
                            Retour au site client
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={handleOpenProfile}
                            className="w-full text-left px-4 py-2 hover:bg-muted"
                          >
                            Paramètres
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={handleSignOut}
                            className="w-full text-left px-4 py-2 hover:bg-muted text-red-600"
                          >
                            Se déconnecter
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-black"
                  onClick={() => navigate("/sign-in")}
                >
                  <User className="w-5 h-5" />
                </Button>
              )}
            </div>
          </header>

          {/* content area */}
          <section className="pt-16 md:pt-0 flex-1 p-4 md:p-6 overflow-auto bg-gray-50">
            <Outlet />
          </section>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
