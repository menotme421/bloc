import type { SyncStatus } from "@/lib/note-sync";

let status: SyncStatus = "synced";
const listeners = new Set<() => void>();

export function setSyncStatus(next: SyncStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}