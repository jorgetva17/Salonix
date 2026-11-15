import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { createServerClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Salonix", template: "%s" },
  description: "Gestão para barbearias e salões: agenda, caixa, estoque e equipe.",
  applicationName: "Salonix",
  appleWebApp: { capable: true, title: "Salonix", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1B3B4B" },
    { media: "(prefers-color-scheme: dark)", color: "#0F2129" },
  ],
};

async function getUserTheme(): Promise<"light" | "dark" | "system"> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "system";
    const { data } = await supabase.from("profiles").select("theme").eq("id", user.id).maybeSingle();
    return data?.theme ?? "system";
  } catch {
    return "system";
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getUserTheme();
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider defaultTheme={theme}>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
