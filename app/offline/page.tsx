import Link from "next/link";
import { RetryButton } from "@/components/retry-button";

export const dynamic = "force-static";

export const metadata = {
  title: "Offline — Bloc",
  description: "You are offline",
};

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="max-w-md w-full space-y-6">
        <div className="mx-auto size-16 rounded-2xl bg-foreground text-background grid place-items-center text-2xl font-semibold">
          ⋯
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">You are offline</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            It looks like you lost your connection. Check your network and try again.
            Your installed app will work again once you are back online.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 transition"
          >
            Go to home
          </Link>
          <RetryButton />
        </div>
        <p className="text-xs text-muted-foreground pt-4">
          Bloc works offline for pages you have already visited.
        </p>
      </div>
    </main>
  );
}
