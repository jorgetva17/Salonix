import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/states/placeholder-page";

export const metadata: Metadata = { title: "Caixa · Salonix" };

export default function Page() {
  return <PlaceholderPage href="/caixa" />;
}
