import type { Metadata } from "next";
import OnboardingContent from "@/components/auth/onboarding-content";

export const metadata: Metadata = {
  title: "Onboarding",
};

const OnboardingPage = () => {
  return <OnboardingContent />;
};

export default OnboardingPage;
