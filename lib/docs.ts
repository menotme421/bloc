export const DOCS_BASE = "https://docs.blocapps.com";

export const DOCS = {
  home: `${DOCS_BASE}/`,
  introduction: `${DOCS_BASE}/introduction`,
  quickstart: `${DOCS_BASE}/quickstart`,
  installation: `${DOCS_BASE}/installation`,
  creatingNotes: `${DOCS_BASE}/notes/creating-notes`,
  editor: `${DOCS_BASE}/notes/editor`,
  organizing: `${DOCS_BASE}/notes/organizing`,
  search: `${DOCS_BASE}/notes/search-and-filter`,
  history: `${DOCS_BASE}/notes/version-history`,
  offline: `${DOCS_BASE}/sync/offline-first`,
  crossDevice: `${DOCS_BASE}/sync/cross-device`,
  profile: `${DOCS_BASE}/account/profile`,
  appearance: `${DOCS_BASE}/account/appearance`,
  language: `${DOCS_BASE}/account/language`,
  plans: `${DOCS_BASE}/account/plans`,
  faq: `${DOCS_BASE}/help/faq`,
  shortcuts: `${DOCS_BASE}/help/keyboard-shortcuts`,
  troubleshooting: `${DOCS_BASE}/help/troubleshooting`,
} as const;

export type DocKey = keyof typeof DOCS;

export function getDocUrl(key: DocKey): string {
  return DOCS[key];
}
