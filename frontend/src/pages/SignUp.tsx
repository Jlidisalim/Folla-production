/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSignUp, useClerk, useUser } from "@clerk/clerk-react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import Header from "@/components/Header";
import { getFriendlyAuthError } from "@/lib/utils";

type Step = "form" | "verify";

const gradientBtn =
  "relative overflow-hidden bg-black text-white transition hover:bg-black/90";

const SignUpPage = () => {
  const { signUp, isLoaded } = useSignUp();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { setActive } = useClerk();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    phone: "",
  });

  useEffect(() => {
    if (userLoaded && isSignedIn) {
      navigate("/", { replace: true });
    }
  }, [userLoaded, isSignedIn, navigate]);

  const resetError = () => setError(null);

  const updateField =
    (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => {
      resetError();
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const submitBaseInfo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || loading) return;
    if (!signUp) {
      setError(
        "Le service d'authentification se lance encore. Patientez quelques secondes puis réessayez."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const trimmedUsername = form.username.trim();
      const trimmedPhone = form.phone.trim();

      // Create user in Clerk
      const createResult = await signUp.create({
        emailAddress: form.email,
        password: form.password,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        username: trimmedUsername || undefined,
      });

      // Store extra data in Clerk metadata (optional)
      const metadata: Record<string, string> = {};
      if (trimmedPhone) metadata.phone = trimmedPhone;
      if (trimmedUsername) metadata.username = trimmedUsername;

      if (Object.keys(metadata).length > 0) {
        try {
          await signUp.update({ unsafeMetadata: metadata });
        } catch (updateErr) {
          console.warn("Failed to store metadata in Clerk:", updateErr);
        }
      }

      // If Clerk completes immediately (rare), just log user in
      if (createResult.status === "complete" && createResult.createdSessionId) {
        await setActive({ session: createResult.createdSessionId });
        navigate("/");
        return;
      }

      // Otherwise, start email verification
      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setVerificationCode("");
      setStep("verify");
    } catch (err: any) {
      setError(
        getFriendlyAuthError(
          err,
          "Impossible de créer le compte pour le moment. Vérifiez votre connexion internet puis réessayez."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const completeVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || loading) return;
    if (!signUp) {
      setError(
        "Le service d'authentification se lance encore. Patientez quelques secondes puis réessayez."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signUp.reload();
      const code = verificationCode.trim();

      if (code.length < 6) {
        setLoading(false);
        return setError(
          "Veuillez saisir le code à 6 chiffres envoyé sur votre e-mail."
        );
      }

      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        // Create Clerk session
        await setActive({ session: completeSignUp.createdSessionId });

        const fullName = [form.firstName, form.lastName]
          .filter(Boolean)
          .join(" ");
        const createdUserId = completeSignUp.createdUserId;

        const trimmedPhone = form.phone.trim();
        const trimmedUsername = form.username.trim(); // ✅ defined here

        // Save to localStorage for your front UI
        localStorage.setItem("clientPhone", trimmedPhone);
        if (trimmedUsername) {
          localStorage.setItem("clientUsername", trimmedUsername);
        }

        // Sync with your backend (Node / API)
        if (createdUserId) {
          try {
            await api.post("/clients/sync", {
              clerkId: createdUserId,
              email: form.email,
              name: fullName || form.email,
              phone: trimmedPhone,
              username: trimmedUsername || undefined,
            });
          } catch (apiErr) {
            console.error("Failed to sync client phone:", apiErr);
          }
        }

        navigate("/");
        return;
      }

      const missing =
        (completeSignUp as any)?.missingFields ??
        (completeSignUp as any)?.missingRequirements ??
        [];
      if (Array.isArray(missing) && missing.length > 0) {
        setError(
          `Clerk nécessite encore : ${missing
            .map((field: string) => field.replace(/_/g, " "))
            .join(", ")}. Vérifiez la configuration de votre tableau de bord Clerk.`
        );
        return;
      }

      if (completeSignUp.status === "needs_second_factor") {
        setError(
          "Clerk exige un facteur supplémentaire (ex : SMS). Terminez cette étape ou désactivez-la dans votre tableau de bord Clerk."
        );
        return;
      }

      setError(
        `La vérification a renvoyé le statut "${completeSignUp.status}". Vérifiez votre configuration Clerk.`
      );
    } catch (err: any) {
      setError(
        getFriendlyAuthError(
          err,
          "La vérification a échoué. Vérifiez votre connexion internet puis réessayez."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const renderError = () =>
    error ? (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-0.5">
          <p className="font-semibold text-amber-900">
            Impossible de finaliser l'inscription
          </p>
          <p className="text-amber-800">{error}</p>
        </div>
      </div>
    ) : null;

  const renderForm = () => (
    <form onSubmit={submitBaseInfo} className="space-y-5">
      {/* FIRST / LAST NAME */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="firstName"
            className="text-xs uppercase text-gray-500"
          >
            Prénom
          </Label>
          <Input
            id="firstName"
            placeholder="Jane"
            value={form.firstName}
            onChange={updateField("firstName")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName" className="text-xs uppercase text-gray-500">
            Nom
          </Label>
          <Input
            id="lastName"
            placeholder="Doe"
            value={form.lastName}
            onChange={updateField("lastName")}
          />
        </div>
      </div>

      {/* USERNAME */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="username" className="text-xs uppercase text-gray-500">
          Nom d'utilisateur (obligatoire)
        </Label>
        <Input
          id="username"
          placeholder="votre.entreprise"
          required
          value={form.username}
          onChange={updateField("username")}
        />
      </div>

      {/* EMAIL */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-xs uppercase text-gray-500">
          Adresse e-mail
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="vous@example.com"
          required
          value={form.email}
          onChange={updateField("email")}
        />
      </div>

      {/* PASSWORD */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-xs uppercase text-gray-500">
          Mot de passe
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          required
          value={form.password}
          onChange={updateField("password")}
        />
      </div>

      {/* PHONE */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone" className="text-xs uppercase text-gray-500">
          Numéro de téléphone
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+216 XX XXX XXX"
          required
          value={form.phone}
          onChange={updateField("phone")}
        />
        <p className="text-xs text-gray-500">
          Nous conservons votre numéro dans votre profil client pour personnaliser
          votre expérience.
        </p>
      </div>

      {renderError()}

      {/* CLERK CAPTCHA PLACEHOLDER */}
      <div
        id="clerk-captcha"
        data-clerk-captcha
        className="clerk-captcha rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-3 text-center text-xs text-gray-500"
      >
        Inscription sécurisée propulsée par Clerk CAPTCHA
      </div>

      <Button
        type="submit"
        className={`${gradientBtn} w-full rounded-2xl py-6 text-base font-semibold`}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Création du compte...
          </span>
        ) : (
          "Créer un compte"
        )}
      </Button>
    </form>
  );

  const renderVerification = () => (
    <form onSubmit={completeVerification} className="space-y-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="code" className="text-xs uppercase text-gray-500">
          Code de vérification
        </Label>
        <Input
          id="code"
          placeholder="123456"
          value={verificationCode}
          onChange={(e) => {
            setVerificationCode(e.target.value);
            resetError();
          }}
        />
        <p className="text-xs text-gray-500">
          Nous venons d'envoyer un code à 6 chiffres à {form.email}. Saisissez-le
          pour finaliser la création de votre compte.
        </p>
      </div>

      {renderError()}

      <Button
        type="submit"
        className={`${gradientBtn} w-full rounded-2xl py-6 text-base font-semibold`}
        disabled={loading || verificationCode.length < 6}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirmation...
          </span>
        ) : (
          "Confirmer et continuer"
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={() => setStep("form")}
        className="w-full text-sm text-gray-500"
      >
        Modifier les informations du compte
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header products={[]} />
      <div className="px-4 py-12">
        <div className="mx-auto w-full max-w-lg">
          <div className="relative overflow-hidden rounded-[32px] border border-gray-100 bg-white p-10 shadow-2xl">
            <div className="pointer-events-none absolute inset-x-0 -top-48 h-64 bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-orange-500/20 blur-3xl" />

            <div className="relative mb-8 text-center">
              <div className="text-xs uppercase tracking-[0.4em] text-gray-400">
                Folla
              </div>
              <h1 className="mt-4 text-3xl font-semibold text-gray-900">
                {step === "form"
                  ? "Créez votre compte"
                  : "Vérifiez votre boîte mail"}
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {step === "form"
                  ? "Créez votre compte avec votre e-mail, votre nom d'utilisateur et votre numéro de téléphone."
                  : "Saisissez le code de vérification reçu par e-mail pour terminer l'inscription."}
              </p>
            </div>

            <div className="relative space-y-6">
              {step === "form" ? renderForm() : renderVerification()}

              <p className="text-center text-sm text-gray-500">
                Vous avez déjà un compte ?{" "}
                <Link to="/sign-in" className="text-black underline">
                  Connectez-vous
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
