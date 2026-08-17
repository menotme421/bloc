import { verifySession } from "@/lib/dal";
import { LastNoteRedirect } from "@/components/last-note-redirect";

export default async function NotesPage() {
  const { userId } = await verifySession();
  return <LastNoteRedirect userId={userId} />;
}