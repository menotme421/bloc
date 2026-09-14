import { tryVerifySession } from "@/lib/dal";
import { HelpPageClient } from "@/components/help-page-client";

export default async function HelpPage() {
  const session = await tryVerifySession();
  return <HelpPageClient userId={session?.userId ?? ""} />;
}
