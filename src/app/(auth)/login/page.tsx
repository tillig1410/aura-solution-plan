import type { Metadata } from "next";
import LoginContent from "@/components/auth/login-content";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

const LoginPage = () => {
  return <LoginContent />;
};

export default LoginPage;
