import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useCart } from "@/components/CartContext";
import { Loader2, CheckCircle } from "lucide-react";

/**
 * PaymentPaymeeCallback - Handles redirect from Paymee after payment
 * 
 * This page attempts to close itself so the user returns to Tab 1.
 * Tab 1 (with PaymeeModal) will detect payment success via polling.
 */
const PaymentPaymeeCallback = () => {
    const [searchParams] = useSearchParams();
    const { clearCart } = useCart();
    const hasProcessed = useRef(false);

    useEffect(() => {
        if (hasProcessed.current) return;
        hasProcessed.current = true;

        const orderId = searchParams.get("orderId");
        console.log("[PaymentCallback] Received callback, orderId:", orderId);

        // Clear cart in this tab too (localStorage is shared)
        clearCart();

        // Wait a moment then try to close this tab
        // The original tab (Tab 1) with PaymeeModal is polling and will handle success
        setTimeout(() => {
            // Try to close the tab
            window.close();

            // If window.close() doesn't work (browser restriction), 
            // show a message telling user to close manually
        }, 1500);
    }, [searchParams, clearCart]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-white px-4">
            <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
                <div className="relative mb-6">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                </div>
                <h1 className="text-xl font-semibold text-gray-800 mb-2">
                    Paiement effectué !
                </h1>
                <p className="text-gray-500 text-sm mb-4">
                    Cet onglet va se fermer automatiquement...
                </p>
                <p className="text-gray-400 text-xs">
                    Si l'onglet ne se ferme pas, vous pouvez le fermer manuellement.
                    <br />
                    Retournez sur l'onglet précédent pour voir votre confirmation.
                </p>
            </div>
        </div>
    );
};

export default PaymentPaymeeCallback;
