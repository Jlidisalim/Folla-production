/**
 * Cancel Order Dialog Component
 *
 * Modal dialog for canceling orders with required reason.
 * Used in admin OrdersAdmin page.
 */

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2 } from "lucide-react";
import { validateCancelReason } from "@/lib/validators";

interface CancelOrderDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => Promise<void>;
    orderId: number;
    orderCode: string;
}

export default function CancelOrderDialog({
    isOpen,
    onClose,
    onConfirm,
    orderId,
    orderCode,
}: CancelOrderDialogProps) {
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleReasonChange = (value: string) => {
        setReason(value);
        // Clear error when user types
        if (error) {
            setError(null);
        }
    };

    const handleConfirm = async () => {
        // Validate reason
        const validationError = validateCancelReason(reason);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        try {
            await onConfirm(reason.trim());
            // Reset state on success
            setReason("");
            setError(null);
        } catch (err) {
            // Error is handled by parent, just reset loading
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setReason("");
            setError(null);
            onClose();
        }
    };

    const isReasonValid = reason.trim().length >= 5;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        Annuler la commande {orderCode}
                    </DialogTitle>
                    <DialogDescription>
                        Cette action est irréversible. Le stock sera restauré et le client
                        sera notifié de l'annulation.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div>
                        <label
                            htmlFor="cancel-reason"
                            className="block text-sm font-medium text-gray-700 mb-2"
                        >
                            Raison de l'annulation <span className="text-red-500">*</span>
                        </label>
                        <Textarea
                            id="cancel-reason"
                            placeholder="Ex: Client ne souhaite plus la commande, Produit en rupture de stock..."
                            value={reason}
                            onChange={(e) => handleReasonChange(e.target.value)}
                            disabled={isLoading}
                            className={`min-h-[100px] ${error
                                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                                    : ""
                                }`}
                        />
                        <div className="flex justify-between mt-1">
                            {error ? (
                                <p className="text-sm text-red-500">{error}</p>
                            ) : (
                                <p className="text-xs text-gray-400">
                                    Minimum 5 caractères requis
                                </p>
                            )}
                            <span
                                className={`text-xs ${reason.length < 5
                                        ? "text-gray-400"
                                        : reason.length > 450
                                            ? "text-orange-500"
                                            : "text-green-500"
                                    }`}
                            >
                                {reason.length}/500
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isLoading}
                    >
                        Retour
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={!isReasonValid || isLoading}
                        className="gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Annulation...
                            </>
                        ) : (
                            "Confirmer l'annulation"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
