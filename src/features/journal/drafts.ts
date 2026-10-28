import type { EntryKind } from "../../lib/types";
export interface Draft {
  key: string;
  kind: EntryKind;
  initial?: Record<string, unknown>;
  id: string;
  name: string;
  category: string;
  when: string;
  amount: string;
  notes: string;
  portion: string;
  effort: string;
  removePhoto: boolean;
  photoKey?: string;
  uploaded?: string;
  updatedAt: number;
}
const prefix = "wellio:draft:";
export const draftScope = (owner: string, demo: boolean) =>
  demo ? "demo" : owner;
export function listDrafts(scope: string): Draft[] {
  const rows: Draft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (!key.startsWith(`${prefix}${scope}:`)) continue;
      const row = JSON.parse(localStorage.getItem(key)!);
      if (
        row.key === key &&
        ["meal", "activity", "water", "weight"].includes(row.kind) &&
        typeof row.id === "string" &&
        typeof row.when === "string"
      )
        rows.push(row);
    }
  } catch {
    /* A blocked browser store must not prevent entry. */
  }
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}
export function draftKey(scope: string, kind: EntryKind, id: string) {
  return `${prefix}${scope}:${kind}:${id}`;
}
export function writeDraft(draft: Draft) {
  try {
    localStorage.setItem(draft.key, JSON.stringify(draft));
    window.dispatchEvent(new Event("wellio-drafts"));
    return true;
  } catch {
    return false;
  }
}
export function deleteDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
  window.dispatchEvent(new Event("wellio-drafts"));
  void draftMedia("readwrite", (s) => {
    const r = s.openCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (c) {
        if (String(c.key) === key || String(c.key).startsWith(`${key}:photo:`))
          c.delete();
        c.continue();
      }
    };
    return r;
  }).catch(() => {});
}
export async function draftMedia<T>(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("wellio-drafts", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("photos", mode);
      const r = run(tx.objectStore("photos"));
      tx.oncomplete = () => resolve(r.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function clearDrafts(scope: string) {
  const rows = listDrafts(scope);
  for (const row of rows) deleteDraft(row.key);
}
