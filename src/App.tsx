import { useState } from 'react';
import { parseChordPro } from './parser';
import { Song } from './types';
import { SongView } from './components/SongView';
import { getTranspositionDisplay } from './transpose';

function App() {
  const [song, setSong] = useState<Song | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [showNashvilleNumbers, setShowNashvilleNumbers] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError(null);
    setFileName(file.name);
    const text = await file.text();
    try {
      const parsed = parseChordPro(text);
      setSong(parsed);
    } catch (err) {
      setSong(null);
      setError(err instanceof Error ? err.message : 'Unable to parse file.');
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Song Viewer</p>
        </div>
        <div className="picker-card">
          <label className="file-label">
            Select a ChordPro file
            <input
              type="file"
              accept=".cho,.chopro,text/plain"
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
