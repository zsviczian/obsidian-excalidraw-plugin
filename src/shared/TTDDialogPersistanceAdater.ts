import type { SavedChats, TTDPersistenceAdapter } from "@zsviczian/excalidraw";

const TTD_DB_NAME = "excalidraw-ttd";
const TTD_DB_VERSION = 1;
const TTD_STORE_NAME = "chats";
const TTD_STORE_KEY = "saved";

const openTTDDatabase = async (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  return await new Promise<IDBDatabase>((resolve: (value: IDBDatabase) => void, reject: (reason?: unknown) => void): void => {
    const request = indexedDB.open(TTD_DB_NAME, TTD_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TTD_STORE_NAME)) {
        db.createObjectStore(TTD_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((): null => null);
};

const readChatsFromStore = async (db: IDBDatabase): Promise<SavedChats | undefined> => {
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(TTD_STORE_NAME, "readonly");
    const store = tx.objectStore(TTD_STORE_NAME);
    const request = store.get(TTD_STORE_KEY);

    request.onsuccess = () => resolve(request.result as SavedChats | undefined);
    request.onerror = () => reject(request.error);
  });
};

const writeChatsToStore = async (db: IDBDatabase, chats: SavedChats): Promise<void> => {
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(TTD_STORE_NAME, "readwrite");
    const store = tx.objectStore(TTD_STORE_NAME);
    const request = store.put(chats, TTD_STORE_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const ttdPersistenceAdapter: TTDPersistenceAdapter = {
  async loadChats(): Promise<SavedChats> {
    try {
      const db = await openTTDDatabase();
      if (!db) return [];
      const chats = await readChatsFromStore(db);
      return Array.isArray(chats) ? chats : [];
    } catch (error) {
      console.warn("TTD loadChats failed", error);
      return [];
    }
  },
  async saveChats(chats: SavedChats): Promise<void> {
    try {
      const db = await openTTDDatabase();
      if (!db) return;
      await writeChatsToStore(db, chats);
    } catch (error) {
      console.warn("TTD saveChats failed", error);
    }
  },
};