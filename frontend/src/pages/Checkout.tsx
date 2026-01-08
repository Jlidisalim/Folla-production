import { useCart } from "@/components/CartContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { useNotifications } from "@/components/NotificationProvider";
import { Check, ChevronDown, MapPin, AlertCircle } from "lucide-react";
import {
  trackBeginCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  mapCartItemToGA4Item,
} from "@/lib/analytics";
import PaymeeModal from "@/components/PaymeeModal";
import SEOHead from "@/components/SEOHead";
import {
  validateName,
  validateEmail,
  validatePhone,
  validateAddress,
  validateCheckoutForm,
  isFormValid,
  sanitizeString,
  type FormErrors,
} from "@/lib/validators";

const Checkout = () => {
  const { cart, totalPrice, clearCart, shippingTotal, removeFromCart, isFreeShipping } = useCart();
  const navigate = useNavigate();
  const { notify } = useNotifications();

  const shipping = shippingTotal;
  const grandTotal = totalPrice + shipping;

  const tunisianRegions = useMemo(
    () => [
      "Ariana",
      "Beja",
      "Ben Arous",
      "Bizerte",
      "Gabes",
      "Gafsa",
      "Jendouba",
      "Kairouan",
      "Kasserine",
      "Kebili",
      "Le Kef",
      "Mahdia",
      "La Manouba",
      "Medenine",
      "Monastir",
      "Nabeul",
      "Sfax",
      "Sidi Bouzid",
      "Siliana",
      "Sousse",
      "Tataouine",
      "Tozeur",
      "Tunis",
      "Zaghouan",
    ],
    []
  );

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    region: "",
  });

  const [regionOpen, setRegionOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement | null>(null);

  const [selectedPayment, setSelectedPayment] = useState("paymee_card");
  const [agree, setAgree] = useState(false);
  const [paymeeUrl, setPaymeeUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const paymeeOrderRef = useRef<number | null>(null);

  // Form validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Paymee mode: paylink or dynamic
  const paymeeMode = (import.meta.env.VITE_PAYMEE_MODE || "dynamic").toLowerCase();
  const paymeePaylinkUrl = import.meta.env.VITE_PAYMEE_PAYLINK_URL || "";

  // GA4 tracking refs
  const hasTrackedBeginCheckout = useRef(false);
  const hasTrackedShipping = useRef(false);
  const hasTrackedPayment = useRef(false);

  // GA4: Track begin_checkout on mount (once only, no PII)
  useEffect(() => {
    if (cart.length > 0 && !hasTrackedBeginCheckout.current) {
      hasTrackedBeginCheckout.current = true;
      trackBeginCheckout(
        cart.map((item) => mapCartItemToGA4Item(item)),
        grandTotal
      );
    }
  }, [cart, grandTotal]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // Validate field on blur and sanitize
  const handleBlur = (field: keyof FormErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    // Sanitize the value
    const sanitized = sanitizeString(form[field]);
    if (sanitized !== form[field]) {
      setForm((prev) => ({ ...prev, [field]: sanitized }));
    }

    // Validate based on field
    let error: string | null = null;
    switch (field) {
      case "name":
        error = validateName(sanitized);
        break;
      case "email":
        error = validateEmail(sanitized);
        break;
      case "phone":
        error = validatePhone(sanitized);
        break;
      case "address":
        error = validateAddress(sanitized);
        break;
    }

    if (error) {
      setErrors((prev) => ({ ...prev, [field]: error }));
    } else {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Check if form is valid for submit
  const formValidation = useMemo(() => {
    return validateCheckoutForm(form);
  }, [form]);

  const canSubmit = useMemo(() => {
    return (
      cart.length > 0 &&
      agree &&
      form.region &&
      isFormValid(formValidation) &&
      !isSubmitting
    );
  }, [cart.length, agree, form.region, formValidation, isSubmitting]);

  const handleRegionSelect = (value: string) => {
    setForm((prev) => ({ ...prev, region: value }));
    setRegionOpen(false);

    // GA4: Track add_shipping_info (region as shipping tier, no PII)
    if (!hasTrackedShipping.current) {
      hasTrackedShipping.current = true;
      trackAddShippingInfo(
        cart.map((item) => mapCartItemToGA4Item(item)),
        grandTotal,
        value // region name as shipping_tier
      );
    }
  };

  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      if (regionRef.current && !regionRef.current.contains(e.target as Node)) {
        setRegionOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      // Filter out noise from React DevTools
      if (event.data?.source === 'react-devtools-content-script') return;

      // Log Paymee messages for debugging
      if (event.origin.includes('paymee.tn')) {
        console.log("[Paymee] Message from sandbox:", event.data);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cart.length) {
      notify({
        title: "Panier vide",
        message: "Ajoutez des produits avant de passer la commande.",
        type: "error",
        appearance: "light",
      });
      return;
    }

    if (!agree) {
      notify({
        title: "Action requise",
        message:
          "Veuillez accepter les conditions d'utilisation et la politique de confidentialite.",
        type: "error",
        appearance: "light",
      });
      return;
    }

    if (!form.region) {
      notify({
        title: "Region manquante",
        message: "Veuillez choisir votre gouvernorat de livraison.",
        type: "error",
        appearance: "light",
      });
      setRegionOpen(true);
      return;
    }

    // Full form validation before submit
    const validationErrors = validateCheckoutForm(form);
    if (!isFormValid(validationErrors)) {
      // Mark all fields as touched to show errors
      setTouched({ name: true, email: true, phone: true, address: true, region: true });
      setErrors(validationErrors);

      // Get first error message for toast
      const firstError = Object.values(validationErrors).find(Boolean);
      notify({
        title: "Formulaire invalide",
        message: firstError || "Veuillez corriger les erreurs dans le formulaire.",
        type: "error",
        appearance: "light",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const isPaymee = selectedPayment === "paymee_card";
      const payload = {
        address: form.address,
        region: form.region,
        total: grandTotal,
        shipping,
        items: cart.map((item) => ({
          productId: Number(item.productId),
          quantity: item.quantity,
          price: item.unitPrice,
          variant: item.variantLabel,
          attributes: {
            selectedOptions: item.selectedOptions,
            combinationId: item.combinationId,
            pricingMode: item.pricingMode,
          },
        })),
        client: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          region: form.region,
        },
        payment: {
          method: selectedPayment,
          details: null,
        },
      };

      const orderRes = await api.post("/orders", payload);
      const orderId = orderRes.data?.id;

      if (isPaymee) {
        // MODE A: Paylink - Quick bypass for dev without webhook/tunnel
        if (paymeeMode === "paylink") {
          if (!paymeePaylinkUrl) {
            throw new Error(
              "VITE_PAYMEE_PAYLINK_URL is not configured. Please add it to your .env file."
            );
          }
          // Open the paylink in a new window
          window.open(paymeePaylinkUrl, "_blank");

          // Clear the cart and redirect to home
          clearCart();
          notify({
            title: "Commande créée",
            message: "Veuillez compléter le paiement dans la nouvelle fenêtre. Vous recevrez une confirmation par email.",
            type: "success",
            appearance: "light",
          });

          // Redirect to home
          navigate("/");
          return;
        }

        // MODE B: Dynamic - Real integration with API
        const payRes = await api.post("/api/paymee/init", {
          orderId,
        });
        const { paymentUrl, token } = payRes.data || {};
        if (orderId && token) {
          paymeeOrderRef.current = orderId;
          sessionStorage.setItem(`paymee:order:${orderId}`, String(token));
        }
        if (paymentUrl) {
          setPaymeeUrl(paymentUrl);
          return;
        }
        throw new Error("Lien de paiement indisponible");
      } else {
        notify({
          title: "Commande confirmée",
          message: "Merci pour votre achat !",
          type: "success",
          appearance: "light",
        });
        clearCart();
        navigate("/");
      }
    } catch (err) {
      const apiMessage =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Une erreur est survenue. Veuillez reessayer.";
      console.error("Erreur commande:", err);
      notify({
        title: "Erreur lors de la commande",
        message: apiMessage,
        type: "error",
        appearance: "light",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead
        title="Paiement | FollaCouffin"
        description="Finalisez votre commande sur FollaCouffin"
        canonicalUrl="https://follacouffin.tn/checkout"
        noIndex={true}
      />
      <Header products={[]} />

      <div className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-2 gap-12">
        {/* Formulaire et Paiement */}
        <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
          <h1 className="text-2xl font-bold">Informations de livraison</h1>

          <div className="space-y-4">
            {/* Name field */}
            <div>
              <input
                type="text"
                name="name"
                placeholder="Nom complet *Requis"
                value={form.name}
                onChange={handleChange}
                onBlur={() => handleBlur("name")}
                className={`w-full bg-white border rounded-lg p-3 transition-all duration-300 focus:ring-2 ${touched.name && errors.name
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-300"
                  }`}
              />
              {touched.name && errors.name && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Email field */}
            <div>
              <input
                type="email"
                name="email"
                placeholder="Email *Requis"
                value={form.email}
                onChange={handleChange}
                onBlur={() => handleBlur("email")}
                className={`w-full bg-white border rounded-lg p-3 transition-all duration-300 focus:ring-2 ${touched.email && errors.email
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-300"
                  }`}
              />
              {touched.email && errors.email && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Phone field */}
            <div>
              <input
                type="tel"
                name="phone"
                placeholder="Téléphone (8 chiffres) *Requis"
                value={form.phone}
                onChange={handleChange}
                onBlur={() => handleBlur("phone")}
                maxLength={8}
                className={`w-full bg-white border rounded-lg p-3 transition-all duration-300 focus:ring-2 ${touched.phone && errors.phone
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-300"
                  }`}
              />
              {touched.phone && errors.phone && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Address field */}
            <div>
              <input
                type="text"
                name="address"
                placeholder="Adresse complète (ex: 15 Rue de la République, Tunis)"
                value={form.address}
                onChange={handleChange}
                onBlur={() => handleBlur("address")}
                className={`w-full bg-white border rounded-lg p-3 transition-all duration-300 focus:ring-2 ${touched.address && errors.address
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-300"
                  }`}
              />
              {touched.address && errors.address && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.address}
                </p>
              )}
            </div>
            <div className="relative" ref={regionRef}>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Gouvernorat</span>
                <span className="text-xs text-gray-400">Requis</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRegionOpen((prev) => !prev);
                }}
                className={`w-full text-left border rounded-lg px-3 py-3 flex items-center justify-between gap-3 bg-white shadow-sm transition-all duration-200 ${regionOpen
                  ? "border-blue-400 ring-2 ring-blue-100"
                  : "border-gray-300 hover:shadow-md"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-md bg-blue-50 text-blue-600">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs text-gray-500">Region</span>
                    <span className="text-sm font-medium text-gray-800">
                      {form.region || "Selectionnez votre region"}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform ${regionOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              <div
                className={`absolute z-30 w-full bg-white rounded-xl shadow-lg border border-gray-100 mt-2 overflow-hidden transform origin-top transition-all duration-200 ${regionOpen
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-95 pointer-events-none"
                  }`}
              >
                <div className="p-3 max-h-64 overflow-auto space-y-1">
                  <div className="space-y-1">
                    {tunisianRegions.map((region) => (
                      <button
                        key={region}
                        type="button"
                        onClick={() => handleRegionSelect(region)}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-sm transition ${form.region === region
                          ? "bg-blue-50 text-blue-700"
                          : "hover:bg-gray-50"
                          }`}
                      >
                        <span>{region}</span>
                        {form.region === region && (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-bold">Methode de paiement</h2>

          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 shadow-sm transition-all duration-300 hover:shadow-md">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="paymee_card"
                  checked={selectedPayment === "paymee_card"}
                  onChange={() => {
                    setSelectedPayment("paymee_card");
                    // GA4: Track add_payment_info (no PII)
                    if (!hasTrackedPayment.current) {
                      hasTrackedPayment.current = true;
                      trackAddPaymentInfo(
                        cart.map((item) => mapCartItemToGA4Item(item)),
                        grandTotal,
                        "paymee_card"
                      );
                    }
                  }}
                  className="form-radio text-blue-500"
                />
                <span className="font-medium">
                  Carte de crédit/débit (Konnect)
                </span>
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg"
                  alt="Visa"
                  className="h-5"
                />
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/b/b7/MasterCard_Logo.svg"
                  alt="Mastercard"
                  className="h-5"
                />
              </label>

            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm transition-all duration-300 hover:shadow-md">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="cod"
                  checked={selectedPayment === "cod"}
                  onChange={() => {
                    setSelectedPayment("cod");
                    // GA4: Track add_payment_info (no PII)
                    if (!hasTrackedPayment.current) {
                      hasTrackedPayment.current = true;
                      trackAddPaymentInfo(
                        cart.map((item) => mapCartItemToGA4Item(item)),
                        grandTotal,
                        "cod"
                      );
                    }
                  }}
                  className="form-radio text-blue-500"
                />
                <span className="font-medium">Paiement a la livraison</span>
                <span className="text-sm text-gray-500">
                  (Payer lors de la reception)
                </span>
              </label>
            </div>
          </div>
        </form>

        {/* Resume commande */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Details de la commande</h2>
          <div className="space-y-4">
            {cart.map((item, index) => (
              <div
                key={`${item.lineId}_${index}`}
                className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm transition-all duration-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">
                      Qté: {item.quantity}
                    </div>
                    {item.variantLabel && (
                      <div className="text-xs text-gray-500">
                        {item.variantLabel}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-semibold">{(item.unitPrice * item.quantity).toFixed(3)} DT</div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.lineId)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-full transition-colors"
                    aria-label="Supprimer"
                    title="Supprimer ce produit"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm space-y-2">
            <div className="flex justify-between text-sm">
              <span>Prix:</span>
              <span>{totalPrice.toFixed(3)} DT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Frais de livraison:</span>
              <span>{isFreeShipping ? "Gratuite" : `${shipping.toFixed(2)} DT`}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total:</span>
              <span>{grandTotal.toFixed(3)} DT</span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="form-checkbox text-blue-500 rounded"
            />
            En cliquant ici, vous acceptez nos Conditions d'utilisation et notre
            Politique de confidentialite.
          </label>

          {/* Validation summary */}
          {!isFormValid(formValidation) && Object.keys(touched).length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Veuillez corriger les erreurs dans le formulaire
              </p>
            </div>
          )}

          <Button
            type="submit"
            form="checkout-form"
            className="w-full bg-blue-600 text-white rounded-full py-3 font-bold transition-all duration-300 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canSubmit}
          >
            {isSubmitting ? "Traitement en cours..." : "Passer à la caisse maintenant"}
          </Button>
        </div>
      </div>

      {paymeeUrl ? (
        <PaymeeModal
          paymeeUrl={paymeeUrl}
          orderId={paymeeOrderRef.current}
          onSuccess={() => {
            clearCart();
            setPaymeeUrl(null);
            paymeeOrderRef.current = null;
            notify({
              title: "Commande confirmée",
              message: "Merci pour votre achat !",
              type: "success",
              appearance: "light",
            });
            navigate("/");
          }}
          onFailure={(message) => {
            setPaymeeUrl(null);
            paymeeOrderRef.current = null;
            notify({
              title: "Paiement échoué",
              message: message || "Le paiement n'a pas été effectué.",
              type: "error",
              appearance: "light",
            });
          }}
          onCancel={async () => {
            const orderId = paymeeOrderRef.current;
            if (orderId) {
              try {
                await api.post(`/api/paymee/cancel/${orderId}`);
                notify({
                  title: "Commande annulée",
                  message: "Votre commande a été annulée.",
                  type: "info",
                  appearance: "light",
                });
              } catch (err) {
                console.error("Cancel error:", err);
              }
              paymeeOrderRef.current = null;
            }
            setPaymeeUrl(null);
          }}
        />
      ) : null}

      <Footer />
    </div>
  );
};

export default Checkout;



