import type { Metadata } from "next";
import LoginContent from "@/components/auth/login-content";

export const metadata: Metadata = {
  title: "Connexion",
};

const LoginPage = () => {
  return <LoginContent />;
};

export default LoginPage;
