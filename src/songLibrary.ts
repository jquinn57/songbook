export interface LibrarySong {
  id: string;
  name: string;
  source: string;
  updatedAt?: number;
  builtIn: boolean;
}

interface StoredSong {
  id: string;
  name: string;
  source: string;
  updatedAt: number;
}

const DATABASE_NAME = 'songbook-library';
const DATABASE_VERSION = 1;
const SONG_STORE = 'songs';
const LAST_SONG_KEY = 'songbook:last-song';

const bundledSources = import.meta.glob('../songs/*.{cho,chopro}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export const bundledSongs: LibrarySong[] = Object.entries(bundledSources)
  .map(([path, source]) => {
    const name = path.split('/').pop() ?? path;
    return {
      id: `bundled:${name}`,
      name,
      source,
      builtIn: true,
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SONG_STORE)) {
        request.result.createObjectStore(SONG_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the local song library.'));
  });
}

export async function getImportedSongs(): Promise<LibrarySong[]> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SONG_STORE, 'readonly');
    const request = transaction.objectStore(SONG_STORE).getAll();

    request.onsuccess = () => {
      const songs = (request.result as StoredSong[])
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map((song) => ({ ...song, builtIn: false }));
      resolve(songs);
    };
    request.onerror = () => reject(request.error ?? new Error('Unable to read the local song library.'));
    transaction.oncomplete = () => database.close();
  });
}

export async function saveImportedSong(name: string, source: string): Promise<LibrarySong> {
  const normalizedName = name.trim() || 'Untitled.cho';
  const song: StoredSong = {
    id: `imported:${normalizedName.toLocaleLowerCase()}`,
    name: normalizedName,
    source,
    updatedAt: Date.now(),
  };
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SONG_STORE, 'readwrite');
    transaction.objectStore(SONG_STORE).put(song);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the song locally.'));
  });
  database.close();

  return { ...song, builtIn: false };
}

export function getLastSongId(): string | null {
  return localStorage.getItem(LAST_SONG_KEY);
}

export function setLastSongId(songId: string): void {
  localStorage.setItem(LAST_SONG_KEY, songId);
}
