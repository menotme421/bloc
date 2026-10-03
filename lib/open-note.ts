"use client";

// Offline-aware note navigation.
// Next.js router.push/replace to /app/notes/<new-uuid> needs a server RSC
// fetch. Offline + brand-new id = cache miss, so soft nav silently stays.
// A full document load instead goes through the SW navigate handler, which
// serves a cached note shell (same editor tree) and NoteEditor corrects the
// data from localStorage by URL id.
export function openNote(
  router: { push: (url: string) => void; replace: (url: string) => void },
  id: string,
  replace = false
) {
  const target = `/app/notes/${id}`;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    window.location.href = target;
    return;
  }
  if (replace) router.replace(target);
  else router.push(target);
}
