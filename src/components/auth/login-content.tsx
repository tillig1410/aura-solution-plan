"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

type Mode = "login" | "register" | "magic" | "forgot";

const registrationOpen = process.env.NEXT_PUBLIC_REGISTRATION_OPEN !== "false";

const LoginContent = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : authError.message
      );
      return;
    }

    router.push("/agenda");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!registrationOpen) {
      setError("Les inscriptions sont fermées pour le moment.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push("/onboarding");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setMagicSent(true);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setMagicSent(true);
  };

  if (magicSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Vérifiez votre email</CardTitle>
            <CardDescription>
              {mode === "forgot"
                ? <>Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.</>
                : <>Un lien de connexion a été envoyé à <strong>{email}</strong>.</>
              }
              {" "}Cliquez dessus pour continuer.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Resaapp</CardTitle>
          <CardDescription>
            {mode === "login" && "Connectez-vous à votre espace"}
            {mode === "register" && "Créez votre compte professionnel"}
            {mode === "forgot" && "Réinitialisez votre mot de passe"}
            {mode === "magic" && "Recevez un lien de connexion par email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={
              mode === "login"
                ? handleLogin
                : mode === "register"
                  ? handleRegister
                  : mode === "forgot"
                    ? handleForgotPassword
                    : handleMagicLink
            }
            className="space-y-4"
          >
            <Input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {mode !== "magic" && mode !== "forgot" && (
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Chargement..."
                : mode === "login"
                  ? "Se connecter"
                  : mode === "register"
                    ? "Créer mon compte"
                    : mode === "forgot"
                      ? "Envoyer le lien de réinitialisation"
                      : "Envoyer le lien"}
            </Button>
          </form>

          <div className="mt-4 space-y-2 text-center text-sm">
            {mode === "login" && (
              <>
                {registrationOpen ? (
                  <p>
                    Pas encore de compte ?{" "}
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => { setMode("register"); setError(""); }}
                    >
                      Créer un compte
                    </button>
                  </p>
                ) : (
                  <p className="text-gray-400">
                    Les inscriptions sont fermées pour le moment.
                  </p>
                )}
                <p>
                  <button
                    type="button"
                    className="text-gray-400 hover:underline"
                    onClick={() => { setMode("forgot"); setError(""); }}
                  >
                    Mot de passe oublié ?
                  </button>
                </p>
              </>
            )}
            {mode === "forgot" && (
              <p>
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => { setMode("login"); setError(""); }}
                >
                  Retour à la connexion
                </button>
              </p>
            )}
            {mode === "register" && (
              <p>
                Déjà un compte ?{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => { setMode("login"); setError(""); }}
                >
                  Se connecter
                </button>
              </p>
            )}
            {mode === "magic" && (
              <p>
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => { setMode("login"); setError(""); }}
                >
                  Retour à la connexion
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginContent;
