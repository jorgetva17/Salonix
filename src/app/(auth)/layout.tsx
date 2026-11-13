import { SalonLogo } from "@/components/brand/salon-logo";
import { DEFAULT_LOGOS } from "@/lib/salon/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <SalonLogo logos={{ ...DEFAULT_LOGOS, darkNeedsPlate: false, custom: false }} alt="Salonix" className="max-h-24" />
        </div>
        {children}
      </div>
    </main>
  );
}
