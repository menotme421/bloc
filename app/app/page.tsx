import { tryVerifySession } from "@/lib/dal";
import { LastNoteRedirect } from "@/components/last-note-redirect";

export default async function AppPage() {
  const session = await tryVerifySession();
  return <LastNoteRedirect userId={session?.userId ?? ""} />;
}