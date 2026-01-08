/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import api from "@/lib/api";
import { MyOrdersSkeleton } from "@/components/skeletons";
import SEOHead from "@/components/SEOHead";

const MyOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // 🔗 Récupère uniquement les commandes de l’utilisateur connecté
        const res = await api.get("/orders/me");
        setOrders(res.data);
      } catch (err: any) {
        console.error(err);
        setError("Impossible de charger vos commandes.");
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background" role="status" aria-busy="true">
        <Header products={[]} />
        <MyOrdersSkeleton />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mes commandes | FollaCouffin"
        description="Consultez l'historique de vos commandes sur FollaCouffin"
        noIndex={true}
      />
      {/* ✅ Header connecté avec ton store */}
      <Header products={[]} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Mes Commandes</h1>
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && orders.length === 0 && (
          <p className="text-muted-foreground">
            Vous n’avez pas encore de commandes.
          </p>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="border rounded-lg p-4 bg-white shadow-sm"
              >
                {/* ✅ Infos commande */}
                <div className="flex justify-between items-center mb-2">
                  <h2 className="font-semibold">Commande #{order.id}</h2>
                  <span className="text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>

                <p className="mb-2 text-sm">
                  <span className="font-medium">Statut :</span> {order.status}
                </p>

                {/* ✅ Liste des produits de la commande */}
                <ul className="mb-2 text-sm">
                  {order.items.map((item: any) => (
                    <li key={item.id}>
                      {item.title} x {item.quantity} –{" "}
                      {(item.price * item.quantity).toFixed(2)} DT
                    </li>
                  ))}
                </ul>

                {/* ✅ Total */}
                <div className="font-bold">
                  Total:{" "}
                  {order.totalAmount
                    ? order.totalAmount.toFixed(2)
                    : order.items
                      .reduce(
                        (sum: number, i: any) => sum + i.price * i.quantity,
                        0
                      )
                      .toFixed(2)}{" "}
                  DT
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default MyOrders;



