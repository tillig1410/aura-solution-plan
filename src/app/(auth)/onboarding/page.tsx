import type { Metadata } from "next";
import OnboardingContent from "@/components/auth/onboarding-content";

export const metadata: Metadata = {
  title: "Onboarding",
  robots: { index: false, follow: false },
};

const OnboardingPage = () => {
  return <OnboardingContent />;
};

export default OnboardingPage;
