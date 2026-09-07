import { Suspense } from "react";
import { tryVerifySession } from "@/lib/dal";
import { SearchPage } from "@/components/search-page";

export const dynamic = "force-dynamic";

export default async function SearchRoutePage() {
  const session = await tryVerifySession();
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading search…</div>}>
      <SearchPage userId={session?.userId ?? ""} />
    </Suspense>
  );
}
