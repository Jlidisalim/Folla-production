/**
 * Admin Settings Page
 * 
 * Allows admin to configure shop-wide settings:
 * - Free shipping threshold (DT)
 * - Default shipping fee (DT)
 * - Store locations for footer
 */
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Settings, Truck, AlertCircle, CheckCircle2, MapPin, Plus, Pencil, Trash2, X } from "lucide-react";
import api from "@/lib/api";

interface ShopSettings {
    freeShippingThresholdDt: number;
    defaultShippingFeeDt: number;
    updatedAt?: string;
}

interface StoreLocation {
    id: number;
    name: string;
    address: string;
    phone: string;
    isActive: boolean;
    sortOrder: number;
}

const SettingsAdmin = () => {
    const queryClient = useQueryClient();

    // Form state for shipping settings
    const [threshold, setThreshold] = useState<string>("");
    const [shippingFee, setShippingFee] = useState<string>("");
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Store location form state
    const [showLocationForm, setShowLocationForm] = useState(false);
    const [editingLocation, setEditingLocation] = useState<StoreLocation | null>(null);
    const [locationName, setLocationName] = useState("");
    const [locationAddress, setLocationAddress] = useState("");
    const [locationPhone, setLocationPhone] = useState("");
    const [locationActive, setLocationActive] = useState(true);

    // Fetch current settings
    const { data: settings, isLoading } = useQuery<ShopSettings>({
        queryKey: ["shopSettings"],
        queryFn: async () => {
            const res = await api.get("/api/settings");
            return res.data;
        },
    });

    // Fetch store locations
    const { data: locations = [], isLoading: locationsLoading } = useQuery<StoreLocation[]>({
        queryKey: ["adminStoreLocations"],
        queryFn: async () => {
            const res = await api.get("/api/settings/admin/store-locations");
            return res.data;
        },
    });

    // Update form when settings load
    useEffect(() => {
        if (settings) {
            setThreshold(String(settings.freeShippingThresholdDt));
            setShippingFee(String(settings.defaultShippingFeeDt));
        }
    }, [settings]);

    // Save shipping settings mutation
    const saveMutation = useMutation({
        mutationFn: async (data: { freeShippingThresholdDt: number; defaultShippingFeeDt: number }) => {
            const res = await api.put("/api/settings/admin", data);
            return res.data;
        },
        onSuccess: () => {
            setSuccessMessage("Paramètres enregistrés avec succès");
            setErrorMessage(null);
            queryClient.invalidateQueries({ queryKey: ["shopSettings"] });
            setTimeout(() => setSuccessMessage(null), 3000);
        },
        onError: (error: any) => {
            const message = error.response?.data?.error || "Erreur lors de l'enregistrement";
            setErrorMessage(message);
            setSuccessMessage(null);
        },
    });

    // Create store location mutation
    const createLocationMutation = useMutation({
        mutationFn: async (data: { name: string; address: string; phone: string; isActive: boolean }) => {
            const res = await api.post("/api/settings/admin/store-locations", data);
            return res.data;
        },
        onSuccess: () => {
            setSuccessMessage("Point de vente ajouté avec succès");
            resetLocationForm();
            queryClient.invalidateQueries({ queryKey: ["adminStoreLocations"] });
            queryClient.invalidateQueries({ queryKey: ["storeLocations"] });
            setTimeout(() => setSuccessMessage(null), 3000);
        },
        onError: (error: any) => {
            const message = error.response?.data?.error || "Erreur lors de l'ajout";
            setErrorMessage(message);
        },
    });

    // Update store location mutation
    const updateLocationMutation = useMutation({
        mutationFn: async ({ id, ...data }: { id: number; name: string; address: string; phone: string; isActive: boolean }) => {
            const res = await api.put(`/api/settings/admin/store-locations/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            setSuccessMessage("Point de vente modifié avec succès");
            resetLocationForm();
            queryClient.invalidateQueries({ queryKey: ["adminStoreLocations"] });
            queryClient.invalidateQueries({ queryKey: ["storeLocations"] });
            setTimeout(() => setSuccessMessage(null), 3000);
        },
        onError: (error: any) => {
            const message = error.response?.data?.error || "Erreur lors de la modification";
            setErrorMessage(message);
        },
    });

    // Delete store location mutation
    const deleteLocationMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await api.delete(`/api/settings/admin/store-locations/${id}`);
            return res.data;
        },
        onSuccess: () => {
            setSuccessMessage("Point de vente supprimé");
            queryClient.invalidateQueries({ queryKey: ["adminStoreLocations"] });
            queryClient.invalidateQueries({ queryKey: ["storeLocations"] });
            setTimeout(() => setSuccessMessage(null), 3000);
        },
        onError: (error: any) => {
            const message = error.response?.data?.error || "Erreur lors de la suppression";
            setErrorMessage(message);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const thresholdValue = parseFloat(threshold);
        const shippingFeeValue = parseFloat(shippingFee);

        // Validation
        if (isNaN(thresholdValue) || thresholdValue < 0) {
            setErrorMessage("Le seuil doit être un nombre positif ou zéro");
            return;
        }
        if (isNaN(shippingFeeValue) || shippingFeeValue < 0) {
            setErrorMessage("Les frais de livraison doivent être un nombre positif ou zéro");
            return;
        }

        setErrorMessage(null);
        saveMutation.mutate({
            freeShippingThresholdDt: thresholdValue,
            defaultShippingFeeDt: shippingFeeValue,
        });
    };

    const resetLocationForm = () => {
        setShowLocationForm(false);
        setEditingLocation(null);
        setLocationName("");
        setLocationAddress("");
        setLocationPhone("");
        setLocationActive(true);
    };

    const handleEditLocation = (location: StoreLocation) => {
        setEditingLocation(location);
        setLocationName(location.name);
        setLocationAddress(location.address);
        setLocationPhone(location.phone);
        setLocationActive(location.isActive);
        setShowLocationForm(true);
    };

    const handleLocationSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!locationName.trim() || !locationAddress.trim() || !locationPhone.trim()) {
            setErrorMessage("Tous les champs sont requis");
            return;
        }

        const data = {
            name: locationName.trim(),
            address: locationAddress.trim(),
            phone: locationPhone.trim(),
            isActive: locationActive,
        };

        if (editingLocation) {
            updateLocationMutation.mutate({ id: editingLocation.id, ...data });
        } else {
            createLocationMutation.mutate(data);
        }
    };

    const handleDeleteLocation = (id: number) => {
        if (confirm("Êtes-vous sûr de vouloir supprimer ce point de vente ?")) {
            deleteLocationMutation.mutate(id);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-muted-foreground/40 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Settings className="w-6 h-6" />
                    Paramètres boutique
                </h1>
                <p className="text-gray-600 mt-1">
                    Configurez les paramètres de votre boutique
                </p>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    {successMessage}
                </div>
            )}

            {/* Error Message */}
            {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    {errorMessage}
                </div>
            )}

            {/* Shipping Settings */}
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-6 text-gray-700">
                    <Truck className="w-5 h-5" />
                    <h2 className="font-semibold">Configuration de la livraison</h2>
                </div>

                <div className="space-y-6">
                    {/* Free Shipping Threshold */}
                    <div>
                        <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 mb-1">
                            Seuil de livraison gratuite (DT)
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                            Montant minimum du panier pour bénéficier de la livraison gratuite.
                            Mettez 0 pour désactiver (livraison toujours gratuite).
                        </p>
                        <input
                            type="number"
                            id="threshold"
                            min="0"
                            step="0.01"
                            value={threshold}
                            onChange={(e) => setThreshold(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="200"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Message actuel dans le header: "Livraison gratuite dès {threshold || "0"} DT d'achat"
                        </p>
                    </div>

                    {/* Default Shipping Fee */}
                    <div>
                        <label htmlFor="shippingFee" className="block text-sm font-medium text-gray-700 mb-1">
                            Frais de livraison par défaut (DT)
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                            Frais appliqués lorsque le panier n'atteint pas le seuil de livraison gratuite.
                        </p>
                        <input
                            type="number"
                            id="shippingFee"
                            min="0"
                            step="0.01"
                            value={shippingFee}
                            onChange={(e) => setShippingFee(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="8"
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <div className="mt-8 flex justify-end">
                    <button
                        type="submit"
                        disabled={saveMutation.isPending}
                        className="flex items-center gap-2 px-6 py-2.5 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saveMutation.isPending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Enregistrement...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Enregistrer
                            </>
                        )}
                    </button>
                </div>

                {/* Last Updated */}
                {settings?.updatedAt && (
                    <p className="mt-4 text-xs text-gray-400 text-right">
                        Dernière mise à jour: {new Date(settings.updatedAt).toLocaleString("fr-FR")}
                    </p>
                )}
            </form>

            {/* Preview Section */}
            <div className="bg-gray-100 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Aperçu</h3>
                <div className="bg-black text-white text-center py-2 rounded text-sm">
                    {parseFloat(threshold) === 0
                        ? "Livraison gratuite"
                        : `Livraison gratuite dès ${threshold || "0"} DT d'achat`}
                </div>
            </div>

            {/* Store Locations Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-gray-700">
                        <MapPin className="w-5 h-5" />
                        <h2 className="font-semibold">Points de Vente</h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            resetLocationForm();
                            setShowLocationForm(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Ajouter
                    </button>
                </div>

                {/* Location Form */}
                {showLocationForm && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium text-gray-700">
                                {editingLocation ? "Modifier le point de vente" : "Nouveau point de vente"}
                            </h3>
                            <button type="button" onClick={resetLocationForm} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleLocationSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                                <input
                                    type="text"
                                    value={locationName}
                                    onChange={(e) => setLocationName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    placeholder="ex: Tunis Centre"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                                <input
                                    type="text"
                                    value={locationAddress}
                                    onChange={(e) => setLocationAddress(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    placeholder="ex: 15 Avenue Habib Bourguiba, Tunis"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                <input
                                    type="text"
                                    value={locationPhone}
                                    onChange={(e) => setLocationPhone(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    placeholder="ex: +216 71 123 456"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="locationActive"
                                    checked={locationActive}
                                    onChange={(e) => setLocationActive(e.target.checked)}
                                    className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                                />
                                <label htmlFor="locationActive" className="text-sm text-gray-700">
                                    Actif (visible dans le footer)
                                </label>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={resetLocationForm}
                                    className="px-4 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                                >
                                    {(createLocationMutation.isPending || updateLocationMutation.isPending) ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            Enregistrement...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            {editingLocation ? "Modifier" : "Ajouter"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Locations List */}
                {locationsLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-4 border-gray-300 border-t-amber-600 rounded-full animate-spin" />
                    </div>
                ) : locations.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                        Aucun point de vente configuré. Cliquez sur "Ajouter" pour en créer un.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {locations.map((location) => (
                            <div
                                key={location.id}
                                className={`flex items-center justify-between p-4 rounded-lg border ${location.isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100"
                                    }`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900">{location.name}</p>
                                        {!location.isActive && (
                                            <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                                                Inactif
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500">{location.address}</p>
                                    <p className="text-sm text-gray-500">{location.phone}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleEditLocation(location)}
                                        className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                        title="Modifier"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteLocation(location.id)}
                                        disabled={deleteLocationMutation.isPending}
                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsAdmin;

