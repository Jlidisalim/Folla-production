import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSignIn } from "@clerk/clerk-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";

const ForgotPassword: React.FC = () => {
  const { signIn, isLoaded, setActive } = useSignIn();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setError(null);
    setMessage(null);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await signIn!.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      if (res.status === "needs_first_factor") {
        setMessage("We sent you a reset code to your email.");
        // stash signIn attempt for next page
        await setActive?.({ session: null });
        navigate("/reset-password", { state: { email } });
      }
    } catch (err: any) {
      console.error("Reset code error:", err);
      const msg =
        err?.errors?.[0]?.message ||
        "Unable to send reset code. Please verify your email.";
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
                Mot de passe oublié
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Entrez votre email pour recevoir un code de réinitialisation.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase text-gray-500">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@example.com"
                  required
                  className="hover:focus:ring-blue-500"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {message && <p className="text-sm text-green-600">{message}</p>}

              <Button
                type="submit"
                className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-2xl py-3 font-semibold"
                disabled={!email || submitting || !isLoaded}
              >
                {submitting ? "Envoi..." : "Envoyer le code"}
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

export default ForgotPassword;
