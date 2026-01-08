import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSignIn, useClerk, useUser } from "@clerk/clerk-react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { getFriendlyAuthError } from "@/lib/utils";

const gradientBtn =
  "relative overflow-hidden bg-black text-white transition hover:bg-black/90";

const SignInPage = () => {
  const { isLoaded, signIn } = useSignIn();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { setActive } = useClerk();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange =
    (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => {
      setError(null);
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || loading) return;
    if (!signIn) {
      setError(
        "Le service d'authentification démarre encore. Merci de réessayer dans quelques secondes."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signIn.create({
        identifier: form.email,
        password: form.password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/");
        return;
      }

      if (result.status === "needs_first_factor") {
        setError(
          "Une vérification supplémentaire est nécessaire. Vérifiez le code reçu par e-mail pour continuer."
        );
      } else {
        setError(
          "Connexion impossible pour le moment. Merci de réessayer dans un instant."
        );
      }
    } catch (err: any) {
      setError(
        getFriendlyAuthError(
          err,
          "Impossible de nous connecter. Vérifiez votre connexion internet ou vos identifiants puis réessayez."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLoaded && isSignedIn) {
      navigate("/", { replace: true });
    }
  }, [userLoaded, isSignedIn, navigate]);

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
                Ravi de vous revoir
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Connectez-vous avec votre e-mail et votre mot de passe.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-5">
              {/* EMAIL */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="email"
                  className="text-xs uppercase text-gray-500"
                >
                  Adresse e-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@example.com"
                  required
                  value={form.email}
                  onChange={handleChange("email")}
                />
              </div>

              {/* PASSWORD */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="password"
                  className="text-xs uppercase text-gray-500"
                >
                  Mot de passe
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={form.password}
                  onChange={handleChange("password")}
                />
              </div>

              {/* ERROR */}
              {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-amber-900">
                      Impossible de finaliser la connexion
                    </p>
                    <p className="text-amber-800">{error}</p>
                  </div>
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <Button
                type="submit"
                className={`${gradientBtn} w-full rounded-2xl py-6 text-base font-semibold`}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connexion...
                  </span>
                ) : (
                  "Se connecter"
                )}
              </Button>

              {/* FOOTER LINKS */}
              <div className="flex flex-col gap-1 text-center text-sm text-gray-500">
                <Link
                  to="/forgot-password"
                  className="text-blue-600 underline decoration-dotted hover:text-blue-700"
                >
                  Mot de passe oublié ?
                </Link>
                <span>
                  Besoin d'un compte ?{" "}
                  <Link to="/sign-up" className="text-black underline">
                    Inscrivez-vous
                  </Link>
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;



