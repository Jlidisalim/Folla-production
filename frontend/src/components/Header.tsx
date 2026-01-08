// src/components/Header.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, User, ShoppingBag, Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/components/CartContext";
import CartSlide from "@/components/CartSlide";
import { useUser, useClerk, useAuth } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import api, { createAuthenticatedApi } from "@/lib/api";
import { buildProductPath } from "@/lib/utils";
import NavDropdown, { SubItem } from "@/components/NavDropdown";
import { useShopSettingsWithFallback, formatDT } from "@/hooks/useShopSettings";

interface Product {
  id: string;
  title: string;
  image: string;
  category?: string;
  subCategory?: string;
}

interface HeaderProps {
  products: Product[];
}

interface NavItem {
  name: string;
  path: string;
  subItems?: SubItem[];
  isDynamic?: boolean;
}

// Mobile nav item with expandable subcategories
interface MobileNavItemProps {
  item: NavItem;
  loading?: boolean;
  onNavigate: () => void;
}

const MobileNavItem: React.FC<MobileNavItemProps> = ({
  item,
  loading = false,
  onNavigate,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSubItems = item.subItems && item.subItems.length > 0;

  const normalizeSlug = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-");
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          to={item.path}
          className="text-black py-2 flex-1"
          onClick={onNavigate}
        >
          {item.name}
        </Link>
        {hasSubItems && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-2 text-gray-600 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black rounded"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Réduire" : "Développer"}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""
                }`}
            />
          </button>
        )}
      </div>
      {hasSubItems && isExpanded && (
        <ul className="ml-4 flex flex-col gap-1 pb-2">
          {loading ? (
            // Loading skeleton
            [1, 2, 3].map((i) => (
              <li key={i}>
                <div className="h-6 w-24 bg-gray-100 rounded animate-pulse my-1" />
              </li>
            ))
          ) : (
            item.subItems!.map((sub) => (
              <li key={sub.slug}>
                <Link
                  to={`${item.path}/${normalizeSlug(sub.name)}`}
                  className="text-gray-700 py-1 block hover:text-black transition-colors"
                  onClick={onNavigate}
                >
                  {sub.name}
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ products }) => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hasVenteFlash, setHasVenteFlash] = useState(false);

  // Get shop settings for free shipping threshold
  const shopSettings = useShopSettingsWithFallback();

  const { totalItems } = useCart();
  const { isSignedIn, user } = useUser();
  const clerk = useClerk();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // debounce timer id
  const [debounceId, setDebounceId] = useState<number | null>(null);
  // loading indicator for backend search
  const [searchLoading, setSearchLoading] = useState(false);

  // Employee role from database - CACHED with React Query (shares cache with AdminLayout)
  const { getToken } = useAuth();
  const { data: roleData } = useQuery({
    queryKey: ["employeeRole"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return null;
      const authApi = createAuthenticatedApi(token);
      const res = await authApi.get("/api/me/role");
      return res.data;
    },
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: false,
  });

  const employeeRole = roleData?.isActive ? roleData?.role : null;

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("click", onDocumentClick);
    }
    return () => document.removeEventListener("click", onDocumentClick);
  }, [userMenuOpen]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/products", {
          params: { venteFlash: 1, limit: 1 },
        });
        if (!mounted) return;
        setHasVenteFlash(Array.isArray(res.data) && res.data.length > 0);
      } catch {
        if (!mounted) return;
        setHasVenteFlash(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // --- IMAGE HELPERS (make result images absolute) ---
  const baseURL = (api as any).defaults?.baseURL || "http://localhost:4000";
  function normalizeImagePath(src?: string | null) {
    if (!src) return "/placeholder.png";
    const s = String(src).trim();
    if (s.length === 0) return "/placeholder.png";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/uploads/")) return `/products${s}`; // backend serves as /products/uploads/..
    if (s.startsWith("/products/uploads/")) return s;
    if (s.startsWith("uploads/")) return `/products/${s}`;
    if (s.startsWith("products/uploads/")) return `/${s}`;
    return `/products/uploads/${s.replace(/^\/+/, "")}`;
  }
  function makeAbsolute(p: string) {
    if (!p) return p;
    if (/^https?:\/\//i.test(p)) return p;
    return `${baseURL.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  }

  // performSearch: query backend GET /products?title=...
  const performSearch = async (term: string) => {
    const q = term.trim();
    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    try {
      const res = await api.get("/products", {
        params: { title: q },
        withCredentials: true,
      });

      const raw = Array.isArray(res.data) ? res.data : [];

      // Normalize to { id, title, image } and make images absolute
      const normalized: Product[] = raw.map((r: any) => {
        // r.images may be an array of paths, r.image might be string — handle both.
        let img = "";
        if (r.images && Array.isArray(r.images) && r.images.length) {
          img = String(r.images[0]);
        } else if (r.image) {
          img = String(r.image);
        } else {
          img = "";
        }

        const finalImage = img
          ? makeAbsolute(normalizeImagePath(img))
          : `${window.location.protocol}//${window.location.host}/placeholder.png`;

        return {
          id: String(r.id ?? r._id ?? r.productId ?? ""),
          title: r.title ?? r.name ?? r.productName ?? "",
          image: finalImage,
        };
      });

      setSearchResults(normalized);
    } catch (err) {
      console.warn(
        "[Header] backend search failed, falling back to local filter",
        err
      );
      // fallback: filter the `products` prop — ensure images are absolute
      const local = products
        .filter((p) => p.title.toLowerCase().includes(q.toLowerCase()))
        .map((p) => ({
          id: p.id,
          title: p.title,
          image:
            p.image && /^https?:\/\//i.test(p.image)
              ? p.image
              : makeAbsolute(normalizeImagePath(p.image)),
        }));
      setSearchResults(local);
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounce typing: wait 300ms, then call performSearch
  useEffect(() => {
    if (!searchOpen) return;
    if (debounceId) {
      window.clearTimeout(debounceId);
      setDebounceId(null);
    }
    const id = window.setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    setDebounceId(id);
    return () => {
      window.clearTimeout(id);
      setDebounceId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchOpen]);

  // Fetch products for dynamic category/subcategory extraction
  const { data: categoryProducts, isLoading: categoriesLoading } = useQuery({
    queryKey: ["navCategories"],
    queryFn: async () => {
      const res = await api.get("/products", { params: { limit: 500 } });
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Build dynamic category tree from products
  const categoryTree = useMemo(() => {
    const products = categoryProducts || [];
    const categoryMap = new Map<string, Set<string>>();

    products.forEach((p: Product) => {
      const cat = p.category?.trim();
      const sub = p.subCategory?.trim();
      if (cat && sub) {
        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, new Set());
        }
        categoryMap.get(cat)!.add(sub);
      }
    });

    const result: Record<string, SubItem[]> = {};
    categoryMap.forEach((subs, cat) => {
      const normalizedCat = cat
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
      result[normalizedCat] = Array.from(subs).map((sub) => ({
        name: sub,
        slug: sub
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "-"),
      }));
    });
    return result;
  }, [categoryProducts]);

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { name: "Accueil", path: "/" },
      { name: "Nouveautés", path: "/category/nouveautes" },
      {
        name: "Décoration",
        path: "/category/decoration",
        subItems: categoryTree["decoration"] || [],
        isDynamic: true,
      },
      {
        name: "Sacs",
        path: "/category/sacs",
        subItems: categoryTree["sacs"] || [],
        isDynamic: true,
      },
      { name: "À propos", path: "/a-propos" },
      { name: "Contact", path: "/contact" },
    ];
    if (hasVenteFlash) {
      items.splice(1, 0, { name: "Vente Flash", path: "/vente-flash" });
    }
    return items;
  }, [hasVenteFlash, categoryTree]);
  const handleOrdersClick = () => {
    // Use employeeRole from Employee table instead of Clerk metadata
    if (employeeRole === "ADMIN" || employeeRole === "ORDER_MANAGER") {
      navigate("/admin/orders");
    } else {
      navigate("/checkout");
    }
    setUserMenuOpen(false);
  };

  // Get admin menu item based on employee role
  const getAdminMenuItem = () => {
    if (!employeeRole) return null;

    switch (employeeRole) {
      case "ADMIN":
        return { label: "Espace admin", path: "/admin" };
      case "PRODUCT_MANAGER":
        return { label: "Espace produits", path: "/admin/products" };
      case "ORDER_MANAGER":
        return { label: "Espace commandes", path: "/admin/orders" };
      default:
        return null;
    }
  };
  const adminMenuItem = getAdminMenuItem();

  return (
    <div className="relative z-50 bg-white">
      {/* Top banner */}
      <div className="text-center py-2 text-sm text-white bg-black">
        {shopSettings.freeShippingThresholdDt === 0
          ? "Livraison gratuite"
          : `Livraison gratuite dès ${formatDT(shopSettings.freeShippingThresholdDt)} d'achat`}
      </div>

      <header className="relative px-4 py-2 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between relative">
          {/* Logo with overflow effect */}
          <Link to="/" className="flex items-center">
            <img
              src="/logo-removebg-preview.png"
              alt="Logo"
              className="w-16 drop-shadow-md"
            />
          </Link>

          {/* Desktop nav (show from lg to keep medium/tablet widths clean) */}
          <nav className="hidden lg:flex items-center gap-8 text-lg font-medium">
            {navItems.map((item) => (
              <div key={item.name} className="relative">
                {item.subItems && item.subItems.length > 0 ? (
                  <NavDropdown
                    label={item.name}
                    path={item.path}
                    items={item.subItems}
                    loading={item.isDynamic && categoriesLoading}
                  />
                ) : (
                  <Link
                    to={item.path}
                    className="text-black hover:text-gray-700 transition-transform transform hover:scale-105"
                  >
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Icons */}
          <div className="flex items-center gap-3 md:gap-4 text-xl">
            {/* Search */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen((s) => !s)}
                className="text-black hover:bg-gray-100 rounded-full hover:text-black"
              >
                <Search className="h-6 w-6" />
              </Button>

              {searchOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-transparent z-40"
                    onClick={() => setSearchOpen(false)}
                  />
                  <div className="fixed top-4 left-0 right-0 mx-auto max-w-7xl z-50 px-4">
                    <div className="bg-white rounded shadow-lg p-3">
                      <input
                        type="text"
                        placeholder="Rechercher un produit..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 text-black rounded focus:outline-none"
                      />

                      {/* Loading indicator */}
                      {searchLoading && (
                        <div className="mt-2 text-sm text-gray-500">
                          Recherche…
                        </div>
                      )}

                      {searchResults.length > 0 && !searchLoading && (
                        <ul className="mt-2 max-h-64 overflow-y-auto">
                          {searchResults.map((product) => (
                            <li
                              key={product.id}
                              className="flex items-center gap-2 py-2 px-2 hover:bg-gray-100 rounded cursor-pointer"
                              onClick={() => {
                                navigate(
                                  buildProductPath({
                                    id: product.id,
                                    title: product.title,
                                  })
                                );
                                setSearchOpen(false);
                                setSearchQuery("");
                                setSearchResults([]);
                              }}
                            >
                              <img
                                src={product.image}
                                alt={product.title}
                                className="w-10 h-10 object-cover rounded"
                              />
                              <span className="text-black text-sm">
                                {product.title}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {!searchLoading &&
                        searchQuery &&
                        searchResults.length === 0 && (
                          <p className="mt-2 text-sm text-black">
                            Aucun résultat trouvé
                          </p>
                        )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User menu */}
            {!isSignedIn ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-black hover:bg-gray-100 rounded-full hover:text-black"
                onClick={() => navigate("/sign-in")}
              >
                <User className="h-6 w-6" />
              </Button>
            ) : (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((s) => !s)}
                  className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-black hover:shadow-sm"
                >
                  <User className="h-6 w-6" />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded shadow-lg ring-1 ring-black ring-opacity-5 z-50"
                    >
                      <ul className="flex flex-col divide-y">
                        <li>
                          <Link
                            to="/account"
                            className="block px-4 py-3 text-sm hover:bg-gray-50"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            Mon compte
                          </Link>
                        </li>
                        <li>
                          <button
                            onClick={handleOrdersClick}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                          >
                            Mes commandes
                          </button>
                        </li>
                        {adminMenuItem && (
                          <li>
                            <Link
                              to={adminMenuItem.path}
                              className="block px-4 py-3 text-sm hover:bg-gray-50"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              {adminMenuItem.label}
                            </Link>
                          </li>
                        )}
                        <li>
                          <button
                            onClick={async () => {
                              try {
                                await clerk.signOut();
                              } catch (e) {
                                console.error("Sign out failed", e);
                              } finally {
                                setUserMenuOpen(false);
                                navigate("/");
                              }
                            }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                          >
                            Se déconnecter
                          </button>
                        </li>
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Cart */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-black hover:bg-gray-100 rounded-full transition-all hover:scale-105 active:scale-95"
            >
              <ShoppingBag className="h-6 w-6" strokeWidth={1.5} />
              {totalItems > 0 && (
                <motion.span
                  key={totalItems}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center"
                >
                  {totalItems}
                </motion.span>
              )}
            </button>

            {/* Mobile/Tablet nav toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-black"
              onClick={() => setIsNavOpen((s) => !s)}
            >
              {isNavOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        {isNavOpen && (
          <div className="lg:hidden absolute left-0 right-0 mt-2 bg-white shadow py-4 z-40">
            <div className="max-w-7xl mx-auto flex flex-col gap-3 px-4">
              {navItems.map((item) => (
                <MobileNavItem
                  key={item.name}
                  item={item}
                  loading={item.isDynamic && categoriesLoading}
                  onNavigate={() => setIsNavOpen(false)}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Cart panel */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setIsCartOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.35 }}
              className="fixed inset-y-0 right-0 z-50 w-96 max-w-full bg-white shadow-lg"
            >
              <CartSlide
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Header;
