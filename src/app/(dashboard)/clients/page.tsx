import type { Metadata } from "next";
import ClientsContent from "@/components/clients/clients-content";

export const metadata: Metadata = {
  title: "Clients",
};

const ClientsPage = () => {
  return <ClientsContent />;
};

export default ClientsPage;
