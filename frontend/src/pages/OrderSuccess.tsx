// src/pages/OrderSuccess.tsx
import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, Package, Truck } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import api from "@/lib/api";
import { trackPurchase, mapOrderItemToGA4Item } from "@/lib/analytics";

/**
 * Order item shape from backend
 */
type OrderItem = {
  productId: number | string;
  title: string;
  category?: string;
  subCategory?: string;
  unitPrice: number;
  quantity: number;
  variantLabel?: string | null;
};

/**
 * Order shape from backend API
 */
type Order = {
  id: number | string;
  total: number;
  subtotal?: number;
  shippingPrice?: number;
  region?: string;
  paymentMethod?: string;
  status: string;
  paymentStatus?: string;
  items: OrderItem[];
  createdAt?: string;
};

const OrderSuccess = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to ensure purchase event fires only once
  const hasFiredPurchase = useRef(false);

  // Fetch order from backend
  useEffect(() => {
    if (!orderId) {
      setError("ID de commande manquant");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        setLoading(true);
        // Fetch order details from backend
        // TODO: Connect to your real order endpoint
        const res = await api.get(`/orders/${orderId}`);
        setOrder(res.data);
      } catch (err: any) {
        console.error("Failed to fetch order:", err);
        setError(
          err?.response?.data?.error ||
            "Impossible de charger les détails de la commande"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // GA4: Track purchase event (fires only once per order, no PII)
  useEffect(() => {
    if (order && !hasFiredPurchase.current) {
      hasFiredPurchase.current = true;

      const items = order.items.map((item, index) =>
        mapOrderItemToGA4Item(
          {
            productId: item.productId,
            title: item.title,
            category: item.category,
            subCategory: item.subCategory,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            variantLabel: item.variantLabel,
          },
          index
        )
      );

      trackPurchase(
        `order_${order.id}`,
        order.total,
        items,
        order.shippingPrice ?? 0,
        0 // tax
      );

      console.log("[GA4] Purchase event fired for order:", order.id);
    }
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header products={[]} />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <div className="h-10 w-10 rounded-full border-2 border-b-transparent border-gray-900 animate-spin" />
            <p className="text-sm">Chargement de votre commande...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header products={[]} />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Commande non trouvée
            </h1>
            <p className="text-gray-600 mb-6">
              {error || "Nous n'avons pas pu trouver les détails de votre commande."}
            </p>
            <Link
              to="/"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Retour à l'accueil
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const subtotal = order.subtotal ?? order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const shippingCost = order.shippingPrice ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header products={[]} />

      <main className="flex-1 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Commande confirmée !
            </h1>
            <p className="text-gray-600">
              Merci pour votre achat. Votre commande #{order.id} a été reçue.
            </p>
          </div>

          {/* Order Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-5 h-5 text-gray-400" />
                <h2 className="font-semibold text-lg">Détails de la commande</h2>
              </div>

              {/* Order Items */}
              <div className="space-y-4">
                {order.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      {item.variantLabel && (
                        <p className="text-sm text-gray-500">{item.variantLabel}</p>
                      )}
                      <p className="text-sm text-gray-400">Qté: {item.quantity}</p>
                    </div>
                    <p className="font-medium">
                      {(item.unitPrice * item.quantity).toFixed(3)} DT
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="p-6 bg-gray-50">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Sous-total</span>
                <span>{subtotal.toFixed(3)} DT</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Livraison</span>
                <span>{shippingCost.toFixed(3)} DT</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{order.total.toFixed(3)} DT</span>
              </div>
            </div>
          </div>

          {/* Delivery Info */}
          {order.region && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <Truck className="w-5 h-5 text-gray-400" />
                <h2 className="font-semibold">Livraison</h2>
              </div>
              <p className="text-gray-600">Région: {order.region}</p>
            </div>
          )}

          {/* CTA */}
          <div className="text-center">
            <Link
              to="/"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Continuer mes achats
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OrderSuccess;
