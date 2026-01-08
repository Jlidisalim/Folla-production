import { useEffect, useRef, useCallback, useState } from "react";
import api from "@/lib/api";
import { Loader2, ExternalLink, AlertTriangle } from "lucide-react";

interface PaymeeModalProps {
    paymeeUrl: string;
    orderId: number | null;
    onSuccess: () => void;
    onFailure: (message?: string) => void;
    onCancel: () => void;
}

// Timeout after 10 minutes of polling
const POLLING_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * PaymeeModal - Payment modal with automatic status polling
 * 
 * Opens Paymee in a new window (to avoid iframe security issues)
 * and polls the backend every 2 seconds to check payment status.
 * Auto-completes on success or failure. Times out after 10 minutes.
 */
const PaymeeModal = ({
    paymeeUrl,
    orderId,
    onSuccess,
    onFailure,
    onCancel,
}: PaymeeModalProps) => {
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasRedirected = useRef(false);
    const paymentWindowRef = useRef<Window | null>(null);
    const [isTimedOut, setIsTimedOut] = useState(false);

    // Cleanup polling and timeout on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, []);

    // Open payment window on mount
    useEffect(() => {
        if (paymeeUrl && !paymentWindowRef.current) {
            paymentWindowRef.current = window.open(paymeeUrl, "_blank", "noopener,noreferrer");
            console.log("[PaymeeModal] Opened payment window");
        }
    }, [paymeeUrl]);

    // Check payment status
    const checkPaymentStatus = useCallback(async () => {
        if (!orderId || hasRedirected.current) return;

        try {
            const resp = await api.get(`/api/paymee/status/${orderId}`);
            const paymentStatus = resp.data?.paymentStatus || "";
            const normalized = String(paymentStatus).toLowerCase();

            console.log("[PaymeeModal] Payment status:", normalized);

            if (normalized.includes("paid")) {
                // Payment successful - stop polling and redirect
                hasRedirected.current = true;
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
                // Close payment window if still open
                if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
                    paymentWindowRef.current.close();
                }
                onSuccess();
            } else if (
                normalized.includes("fail") ||
                normalized.includes("cancel") ||
                normalized.includes("expired")
            ) {
                // Payment failed - stop polling and show error
                hasRedirected.current = true;
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
                // Close payment window if still open
                if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
                    paymentWindowRef.current.close();
                }
                onFailure("Le paiement a échoué ou a été annulé.");
            }
            // If still pending, continue polling
        } catch (err) {
            console.error("[PaymeeModal] Status check error:", err);
            // Don't stop polling on network errors - keep trying
        }
    }, [orderId, onSuccess, onFailure]);

    // Start polling when modal opens + set timeout
    useEffect(() => {
        if (!orderId) return;

        // Set 10-minute timeout
        timeoutRef.current = setTimeout(() => {
            console.log("[PaymeeModal] Polling timed out after 10 minutes");
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            setIsTimedOut(true);
        }, POLLING_TIMEOUT_MS);

        // Initial check after 3 seconds (give user time to interact with payment window)
        const initialTimeout = setTimeout(() => {
            checkPaymentStatus();

            // Then poll every 2 seconds
            pollingRef.current = setInterval(checkPaymentStatus, 2000);
        }, 3000);

        return () => {
            clearTimeout(initialTimeout);
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [orderId, checkPaymentStatus]);

    // Handle manual window open if popup was blocked
    const handleOpenPaymentWindow = () => {
        paymentWindowRef.current = window.open(paymeeUrl, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-500 to-blue-600">
                    <p className="text-sm text-blue-100">Paiement sécurisé Paymee</p>
                    <p className="text-xl font-semibold text-white">Finalisez votre paiement</p>
                </div>

                {/* Content */}
                <div className="p-6 text-center">
                    {isTimedOut ? (
                        /* Timeout state */
                        <div className="mb-6">
                            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-800 mb-2">
                                Délai d'attente dépassé
                            </p>
                            <p className="text-sm text-gray-500 mb-4">
                                Le paiement n'a pas été confirmé dans les 10 minutes.
                                <br />
                                Si vous avez payé, le statut sera mis à jour automatiquement.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
                                        paymentWindowRef.current.close();
                                    }
                                    onCancel();
                                }}
                                className="w-full bg-amber-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-amber-600 transition-colors"
                            >
                                Annuler et réessayer
                            </button>
                        </div>
                    ) : (
                        /* Normal polling state */
                        <>
                            <div className="mb-6">
                                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                                <p className="text-lg font-medium text-gray-800 mb-2">
                                    Paiement en cours...
                                </p>
                                <p className="text-sm text-gray-500">
                                    Une nouvelle fenêtre s'est ouverte pour le paiement.
                                    <br />
                                    Nous vérifions automatiquement le statut.
                                </p>
                            </div>

                            {/* Open payment window button (in case popup was blocked) */}
                            <button
                                type="button"
                                onClick={handleOpenPaymentWindow}
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors mb-3"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Ouvrir la page de paiement
                            </button>

                            {/* Status indicator */}
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Vérification automatique...</span>
                            </div>

                            {/* Cancel button */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
                                        paymentWindowRef.current.close();
                                    }
                                    onCancel();
                                }}
                                className="w-full text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors"
                            >
                                Annuler le paiement
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymeeModal;
