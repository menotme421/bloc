import { tryVerifySession } from "@/lib/dal";
import { LastNoteRedirect } from "@/components/last-note-redirect";

export default async function NotesPage() {
  const session = await tryVerifySession();
  return <LastNoteRedirect userId={session?.userId ?? ""} />;
}