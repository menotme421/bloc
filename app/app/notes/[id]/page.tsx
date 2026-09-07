import { NoteEditor } from "@/components/note-editor";
import { tryVerifySession } from "@/lib/dal";
import { tryGetNote } from "@/lib/notes";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await tryVerifySession();
  const note = await tryGetNote(id);

  const userId = session?.userId ?? "";

  return <NoteEditor userId={userId} note={note} />;
}