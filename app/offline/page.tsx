import { OfflineShell } from "@/components/offline-shell";

export const dynamic = "force-static";

export const metadata = {
  title: "Offline — Bloc",
  description: "Your notes, on this device",
};

export default function OfflinePage() {
  return <OfflineShell />;
}
