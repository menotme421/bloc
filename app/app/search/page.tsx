import { verifySession } from "@/lib/dal";
import { SearchPage } from "@/components/search-page";

export default async function SearchRoutePage() {
  const { userId } = await verifySession();
  return <SearchPage userId={userId} />;
}
