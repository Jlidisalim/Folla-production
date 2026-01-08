import React, { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useSignIn } from "@clerk/clerk-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";

const ResetPassword: React.FC = () => {
  const { signIn, isLoaded } = useSignIn();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { email?: string } };
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailFromState = location.state?.email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await signIn!.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });
      if (res.status === "complete") {
        navigate("/sign-in");
      }
    } catch (err: any) {
      console.error("Reset password error:", err);
      const msg =
        err?.errors?.[0]?.message ||
        "Code invalide ou mot de passe non accepté. Réessayez.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
                Réinitialiser le mot de passe
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Saisissez le code reçu par email {emailFromState ? `pour ${emailFromState}` : ""}.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Code</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Code à 6 chiffres"
                  required
                  className="tracking-[0.2em] hover:focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nouveau mot de passe</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="hover:focus:ring-blue-500"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-2xl py-3 font-semibold"
                disabled={!code || !password || submitting || !isLoaded}
              >
                {submitting ? "Validation..." : "Réinitialiser"}
              </Button>

              <div className="flex flex-col gap-1 text-center text-sm text-gray-500">
                <Link to="/sign-in" className="text-blue-600 underline decoration-dotted hover:text-blue-700">
                  Retour à la connexion
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
