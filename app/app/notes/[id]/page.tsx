import { NoteEditor } from "@/components/note-editor";
import { verifySession } from "@/lib/dal";
import { getNote } from "@/lib/notes";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = await getNote(id);

  const { userId } = await verifySession();
  return <NoteEditor userId={userId} note={note} />;
}