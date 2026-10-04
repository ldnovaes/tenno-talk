import type { SendMessageInput } from "@/services/chatService";
import type { Message } from "@/types/message";

export interface PendingSend {
  key: string;
  userId: string;
  input: SendMessageInput;
  message: Message;
  blobs: (Blob | null)[];
  mediaIds?: string[];
  attempts: number;
  nextAttempt: number;
  leaseUntil: number;
  blocked: boolean;
  failureCode?: string;
  storyId?: string | undefined;
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("tenno.outbox", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("sends", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  });
  return database;
}
export async function listPending(userId: string): Promise<PendingSend[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction("sends").objectStore("sends").getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as PendingSend[])
          .filter((e) => e.userId === userId)
          .sort((a, b) => a.message.createdAt.localeCompare(b.message.createdAt)),
      );
    request.onerror = () => reject(request.error);
  });
}
export async function updatePending(
  key: string,
  change: (entry: PendingSend | undefined) => PendingSend | undefined,
) {
  const database = await db();
  return new Promise<PendingSend | undefined>((resolve, reject) => {
    const tx = database.transaction("sends", "readwrite");
    const store = tx.objectStore("sends");
    let result: PendingSend | undefined;
    const read = store.get(key);
    read.onsuccess = () => {
      result = change(read.result as PendingSend | undefined);
      if (result) store.put(result);
      else store.delete(key);
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function persistSend(
  userId: string,
  input: SendMessageInput,
  message: Message,
  storyId?: string,
) {
  const key = `${userId}:${input.clientId}`;
  const blobs = await Promise.all(
    input.media.map(async (media) =>
      media.url.startsWith("blob:") || media.url.startsWith("data:")
        ? (await fetch(media.url)).blob()
        : null,
    ),
  );
  return updatePending(
    key,
    (existing) =>
      existing ?? {
        key,
        storyId,
        userId,
        input: { ...input, media: input.media.map((m, i) => (blobs[i] ? { ...m, url: "" } : m)) },
        message,
        blobs,
        attempts: 0,
        nextAttempt: 0,
        leaseUntil: 0,
        blocked: false,
      },
  );
}
