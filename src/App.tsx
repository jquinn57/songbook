import { useEffect, useMemo, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { parseChordPro } from './parser';
import { Song } from './types';
import { SongView } from './components/SongView';
import { getTranspositionDisplay } from './transpose';
import {
  bundledSongs,
  getImportedSongs,
  getLastSongId,
  LibrarySong,
  saveImportedSong,
  setLastSongId,
} from './songLibrary';

function App() {
  const [song, setSong] = useState<Song | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [showNashvilleNumbers, setShowNashvilleNumbers] = useState(false);
  const [importedSongs, setImportedSongs] = useState<LibrarySong[]>([]);
  const [selectedSongId, setSelectedSongId] = useState('');
  const [offlineReady, setOfflineReady] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<(() => Promise<void>) | null>(null);

  const librarySongs = useMemo(() => [...importedSongs, ...bundledSongs], [importedSongs]);

  const openLibrarySong = (librarySong: LibrarySong) => {
    try {
      setSong(parseChordPro(librarySong.source));
      setError(null);
      setFileName(librarySong.name);
      setSelectedSongId(librarySong.id);
      setLastSongId(librarySong.id);
      setTransposeSemitones(0);
    } catch (err) {
      setSong(null);
      setError(err instanceof Error ? err.message : 'Unable to parse file.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const savedSongId = getLastSongId();
    const initialBundledSong = bundledSongs.find((entry) => entry.id === savedSongId)
      ?? bundledSongs[0];

    if (initialBundledSong) openLibrarySong(initialBundledSong);

    getImportedSongs()
      .then((storedSongs) => {
        if (cancelled) return;
        setImportedSongs(storedSongs);
        const savedImportedSong = storedSongs.find((entry) => entry.id === savedSongId);
        if (savedImportedSong) openLibrarySong(savedImportedSong);
      })
      .catch(() => {
        if (!cancelled && bundledSongs[0]) {
          openLibrarySong(bundledSongs[0]);
          setError('Imported songs could not be loaded, but the built-in library is still available.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const updateSW = registerSW({
      immediate: true,
      onOfflineReady: () => setOfflineReady(true),
      onNeedRefresh: () => setNeedsRefresh(true),
      onRegisteredSW: (_serviceWorkerUrl, registration) => {
        if (registration?.active) setOfflineReady(true);
      },
      onRegisterError: () => setError('Offline installation could not be completed.'),
    });
    navigator.serviceWorker?.ready.then(() => setOfflineReady(true));
    setUpdateServiceWorker(() => updateSW);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handlePdfExport = () => {
    const originalTitle = document.title;
    const exportTitle = song?.metadata.title?.trim() || fileName.replace(/\.[^.]+$/, '') || 'chord-chart';

    document.title = exportTitle;
    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };

    window.addEventListener('afterprint', restoreTitle);
    window.print();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    try {
      const parsed = parseChordPro(text);
      const savedSong = await saveImportedSong(file.name, text);
      setImportedSongs((current) => [
        savedSong,
        ...current.filter((entry) => entry.id !== savedSong.id),
      ]);
      setSong(parsed);
      setError(null);
      setFileName(savedSong.name);
      setSelectedSongId(savedSong.id);
      setLastSongId(savedSong.id);
      setTransposeSemitones(0);
    } catch (err) {
      setSong(null);
      setError(err instanceof Error ? err.message : 'Unable to import file.');
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Song Viewer</p>
        </div>
        <div className="picker-card">
          <div className={`offline-status${isOnline ? '' : ' is-offline'}`} role="status">
            <span aria-hidden="true" className="offline-status-dot" />
            {offlineReady
              ? (isOnline ? 'Ready for offline use' : 'Running offline')
              : (isOnline ? 'Preparing offline use…' : 'Offline cache unavailable')}
          </div>
          {needsRefresh ? (
            <button
              className="update-button"
              onClick={() => updateServiceWorker?.()}
              type="button"
            >
              Update available — reload
            </button>
          ) : null}
          <label className="library-label" htmlFor="song-library">Song library</label>
          <select
            id="song-library"
            className="song-library"
            onChange={(event) => {
              const librarySong = librarySongs.find((entry) => entry.id === event.target.value);
              if (librarySong) openLibrarySong(librarySong);
            }}
            value={selectedSongId}
          >
            <option value="" disabled>Choose a song</option>
            {importedSongs.length > 0 ? (
              <optgroup label="Imported on this iPad">
                {importedSongs.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="Built in">
              {bundledSongs.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </optgroup>
          </select>
          <label className="file-label">
            Import a ChordPro file
            <input
              accept=".cho,.chopro,text/plain"
              type="file"
              onChange={handleFileChange}
            />
          </label>
          {fileName ? <p className="file-name">Loaded: {fileName}</p> : null}
          {error ? <p className="error-message">{error}</p> : null}
        </div>
        {song && (
          <div className="transpose-card">
            <div className="transpose-controls">
              <button
                className="transpose-btn transpose-down"
                onClick={() => setTransposeSemitones((t) => t - 1)}
                aria-label="Transpose down"
              >
                ♭
              </button>
              <span className="transpose-display">{getTranspositionDisplay(transposeSemitones)}</span>
              <button
                className="transpose-btn transpose-up"
                onClick={() => setTransposeSemitones((t) => t + 1)}
                aria-label="Transpose up"
              >
                ♯
              </button>
              <button
                className={`transpose-btn ${showNashvilleNumbers ? 'active' : ''}`}
                onClick={() => setShowNashvilleNumbers((current) => !current)}
                aria-label="Toggle Nashville number display"
              >
                SD
              </button>
            </div>
            {transposeSemitones !== 0 && (
              <button
                className="transpose-reset"
                onClick={() => setTransposeSemitones(0)}
              >
                Reset
              </button>
            )}
            <button
              className="pdf-export"
              onClick={handlePdfExport}
              type="button"
            >
              Export PDF
            </button>
          </div>
        )}
      </header>

      <main className="viewer-area">
        {song ? (
          <SongView
            song={song}
            transposeSemitones={transposeSemitones}
            showNashvilleNumbers={showNashvilleNumbers}
          />
        ) : (
          <div className="empty-state">Open a file to preview the song.</div>
        )}
      </main>
    </div>
  );
}

export default App;
