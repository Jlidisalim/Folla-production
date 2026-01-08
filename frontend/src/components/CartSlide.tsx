/* src/components/CartSlide.tsx */
/* Modern cart/wishlist slide panel with tabs and recommendations */
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/CartContext";
import { useWishlist } from "@/components/WishlistContext";
import { X, Plus, Minus, Heart, Pencil } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { trackViewCart, mapCartItemToGA4Item } from "@/lib/analytics";
import { buildProductPath } from "@/lib/utils";
import api from "@/lib/api";

interface CartSlideProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RecommendedProduct {
  id: number | string;
  title: string;
  images?: string[];
  pricePiece?: number;
  priceQuantity?: number;
  displayPrice?: number;
}

const CartSlide = ({ isOpen, onClose }: CartSlideProps) => {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    addToCart,
    totalItems,
    totalPrice,
    isFreeShipping,
    amountUntilFreeShipping,
    shippingTotal
  } = useCart();
  const { wishlist, removeFromWishlist, toggleWishlist, isInWishlist, totalItems: wishlistCount } = useWishlist();
  const navigate = useNavigate();
  const hasTrackedViewCart = useRef(false);
  const [activeTab, setActiveTab] = useState<"cart" | "wishlist">("cart");
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const baseURL = (api as any).defaults?.baseURL || "http://localhost:4000";

  function normalizeImage(src?: string | null): string {
    if (!src) return "/placeholder.png";
    const s = String(src).trim();
    if (!s) return "/placeholder.png";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/uploads/")) return `${baseURL.replace(/\/$/, "")}/products${s}`;
    if (s.startsWith("/products/uploads/")) return `${baseURL.replace(/\/$/, "")}${s}`;
    if (s.startsWith("uploads/")) return `${baseURL.replace(/\/$/, "")}/products/${s}`;
    return `${baseURL.replace(/\/$/, "")}/products/uploads/${s.replace(/^\/+/, "")}`;
  }

  // GA4: Track view_cart when cart opens
  useEffect(() => {
    if (isOpen && cart.length > 0 && !hasTrackedViewCart.current) {
      hasTrackedViewCart.current = true;
      trackViewCart(
        cart.map((item) => mapCartItemToGA4Item(item)),
        totalPrice
      );
    }
    if (!isOpen) {
      hasTrackedViewCart.current = false;
    }
  }, [isOpen, cart, totalPrice]);

  // Load recommendations when cart panel is open (for both empty and non-empty cart)
  useEffect(() => {
    if (isOpen && activeTab === "cart") {
      setLoadingRecommendations(true);
      api
        .get("/products", { params: { limit: 6 } })
        .then((res) => {
          const products = res.data?.products ?? res.data ?? [];
          setRecommendations(products.slice(0, 6));
        })
        .catch((err) => {
          console.warn("Failed to load recommendations", err);
          setRecommendations([]);
        })
        .finally(() => setLoadingRecommendations(false));
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCheckout = () => {
    onClose();
    navigate("/checkout");
  };

  const handleAddToCartFromWishlist = async (item: typeof wishlist[0]) => {
    await addToCart({
      productId: item.productId,
      title: item.title,
      unitPrice: item.price,
      pricingMode: "piece",
      image: item.image,
      quantity: 1,
    });
    removeFromWishlist(item.productId);
    setActiveTab("cart");
  };

  const getProductPrice = (product: RecommendedProduct) => {
    if (product.displayPrice) return Number(product.displayPrice);
    if (product.pricePiece) return product.pricePiece;
    if (product.priceQuantity) return product.priceQuantity;
    return 0;
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Slide Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl z-50 flex flex-col">
        {/* Header with Tabs */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("cart")}
              className={`text-sm font-medium pb-1 transition-all ${activeTab === "cart"
                ? "text-black border-b-2 border-black"
                : "text-gray-500 hover:text-black"
                }`}
            >
              Panier ({totalItems})
            </button>
            <button
              onClick={() => setActiveTab("wishlist")}
              className={`text-sm font-medium pb-1 transition-all ${activeTab === "wishlist"
                ? "text-black border-b-2 border-black font-semibold"
                : "text-gray-500 hover:text-black"
                }`}
            >
              Wishlist ({wishlistCount})
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditMode(!editMode)}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              title="Modifier"
            >
              <Pencil className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "cart" ? (
            /* Cart Tab Content */
            cart.length === 0 ? (
              /* Empty Cart State */
              <div className="flex flex-col h-full">
                <div className="text-center py-12 px-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Ton panier est vide
                  </h3>
                  <p className="text-sm text-gray-500">
                    Pourquoi ne pas l'essayer avec l'une de nos suggestions ?
                  </p>
                </div>

                {/* Recommendations Section */}
                <div className="px-4 pb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">
                    Recommandé pour toi
                  </h4>
                  {loadingRecommendations ? (
                    <div className="grid grid-cols-3 gap-3">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="aspect-[3/4] bg-gray-200 rounded mb-2" />
                          <div className="h-3 bg-gray-200 rounded w-3/4 mb-1" />
                          <div className="h-3 bg-gray-200 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {recommendations.map((product) => (
                        <Link
                          key={product.id}
                          to={buildProductPath({ id: product.id, title: product.title })}
                          onClick={onClose}
                          className="group"
                        >
                          <div className="aspect-[3/4] bg-gray-100 rounded overflow-hidden mb-2">
                            <img
                              src={normalizeImage(product.images?.[0])}
                              alt={product.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>
                          <p className="text-xs text-gray-900 line-clamp-1 mb-0.5">
                            {product.title}
                          </p>
                          <p className="text-xs font-medium text-gray-900">
                            {getProductPrice(product).toFixed(2)} DT
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Cart Items + Recommendations */
              <div className="flex flex-col">
                {/* Cart Items */}
                <div className="p-4">
                  {cart.map((item, index) => {
                    const floor = Math.max(1, item.minQty ?? 1);
                    return (
                      <div key={`${item.lineId}_${index}`} className="flex gap-3 mb-4 pb-4 border-b last:border-b-0">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-16 h-20 object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.png";
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="text-xs font-medium text-gray-900 line-clamp-2">
                              {item.title}
                            </h3>
                            {editMode && (
                              <button
                                onClick={() => removeFromCart(item.lineId)}
                                className="text-red-500 text-xs hover:underline whitespace-nowrap"
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                          {item.variantLabel && (
                            <p className="text-xs text-gray-500 mt-1">{item.variantLabel}</p>
                          )}
                          <p className="text-xs font-semibold text-gray-900 mt-1">
                            {item.unitPrice.toFixed(2)} DT
                          </p>
                          {/* Quantity Controls + Wishlist Heart */}
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                                className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                                disabled={item.quantity <= floor}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-medium w-5 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                                className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Wishlist Heart Button */}
                            <button
                              onClick={() => {
                                toggleWishlist({
                                  productId: item.productId,
                                  title: item.title,
                                  price: item.unitPrice,
                                  image: item.image,
                                });
                              }}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                              aria-label={isInWishlist(item.productId) ? "Retirer des favoris" : "Ajouter aux favoris"}
                            >
                              <Heart
                                className={`w-4 h-4 transition-colors ${isInWishlist(item.productId) ? "fill-black text-black" : "text-gray-400 hover:text-black"
                                  }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recommendations Section (also shown when cart has items) */}
                <div className="px-4 pb-6 border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Recommandé pour toi
                  </h4>
                  {loadingRecommendations ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="aspect-[3/4] bg-gray-200 rounded mb-1" />
                          <div className="h-2 bg-gray-200 rounded w-3/4 mb-1" />
                          <div className="h-2 bg-gray-200 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {recommendations.slice(0, 3).map((product) => (
                        <Link
                          key={product.id}
                          to={buildProductPath({ id: product.id, title: product.title })}
                          onClick={onClose}
                          className="group"
                        >
                          <div className="aspect-[3/4] bg-gray-100 rounded overflow-hidden mb-1">
                            <img
                              src={normalizeImage(product.images?.[0])}
                              alt={product.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>
                          <p className="text-[10px] text-gray-900 line-clamp-1">
                            {product.title}
                          </p>
                          <p className="text-[10px] font-medium text-gray-900">
                            {getProductPrice(product).toFixed(2)} DT
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            /* Wishlist Tab Content */
            wishlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6">
                <Heart className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ta wishlist est vide
                </h3>
                <p className="text-sm text-gray-500 text-center">
                  Ajoute des articles à ta wishlist en cliquant sur le cœur
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4">
                {wishlist.map((item) => (
                  <div key={item.productId} className="relative">
                    <Link
                      to={buildProductPath({ id: item.productId, title: item.title })}
                      onClick={onClose}
                    >
                      <div className="aspect-[3/4] bg-gray-100 rounded overflow-hidden mb-2 relative">
                        <img
                          src={normalizeImage(item.image)}
                          alt={item.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    </Link>
                    {/* Heart Icon */}
                    <button
                      onClick={() => removeFromWishlist(item.productId)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white transition-colors"
                    >
                      <Heart className="w-4 h-4 fill-black text-black" />
                    </button>
                    <p className="text-xs text-gray-900 line-clamp-1 mb-0.5">
                      {item.title}
                    </p>
                    <p className="text-xs font-medium text-gray-900 mb-2">
                      {item.price.toFixed(2)} DT
                    </p>
                    {/* Add to Cart Button */}
                    <button
                      onClick={() => handleAddToCartFromWishlist(item)}
                      className="w-full py-2 text-xs font-medium border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors rounded"
                    >
                      Ajouter à mon panier d'achat
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer - Checkout Button */}
        {activeTab === "cart" && cart.length > 0 && (
          <div className="border-t p-4 bg-white">
            {/* Shipping Status Message */}
            <div className="mb-3 text-sm">
              {isFreeShipping ? (
                <span className="text-green-600 font-medium">Livraison gratuite appliquée</span>
              ) : (
                <span className="text-gray-600">
                  Plus que <span className="font-semibold">{amountUntilFreeShipping.toFixed(2)} DT</span> pour la livraison gratuite
                </span>
              )}
            </div>

            {/* Subtotal and Shipping */}
            <div className="flex justify-between items-center text-sm text-gray-600 mb-1">
              <span>Sous-total</span>
              <span>{totalPrice.toFixed(2)} DT</span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-600 mb-3">
              <span>Livraison</span>
              <span>{isFreeShipping ? "Gratuite" : `${shippingTotal.toFixed(2)} DT`}</span>
            </div>

            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-lg font-bold text-gray-900">{(totalPrice + shippingTotal).toFixed(2)} DT</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full py-3 bg-black text-white font-medium rounded hover:bg-gray-800 transition-colors"
            >
              Passer la commande
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default CartSlide;
