import { Song, LyricsLine } from '../types';
import { getKeyRoot, getNashvilleChord, transposeChord } from '../transpose';

interface SongViewProps {
  song: Song;
  transposeSemitones?: number;
  showNashvilleNumbers?: boolean;
}

export function SongView({ song, transposeSemitones = 0, showNashvilleNumbers = false }: SongViewProps) {
  const songKeyRoot = getKeyRoot(song.metadata.key);
  return (
    <article className="song-view">
      <header className="metadata-card">
        <div>
          <h2>{song.metadata.title ?? 'Untitled Song'}</h2>
          {song.metadata.subtitle ? <p className="subtitle">{song.metadata.subtitle}</p> : null}
        </div>
        <div className="meta-list">
          {song.metadata.artist ? <span>{song.metadata.artist}</span> : null}
          {song.metadata.key ? <span>Key: {song.metadata.key}</span> : null}
          {song.metadata.time ? <span>Time: {song.metadata.time}</span> : null}
          {song.metadata.tempo ? <span>Tempo: {song.metadata.tempo}</span> : null}
        </div>
      </header>

      <div className="song-body">
        {song.sections.map((section, sectionIndex) => (
          <section className="song-section" key={`${section.name}-${sectionIndex}`}>
            <div className="section-label">{section.name}</div>
            {section.lines.map((line, lineIndex) => {
              if (line.type === 'comment') {
                return (
                  <div className="line comment-line" key={lineIndex}>
                    {line.text}
                  </div>
                );
              }
              if (line.type === 'blank') {
                return <div className="line blank-line" key={lineIndex} />;
              }

              return (
                <LyricsLineView
                  line={line}
                  key={lineIndex}
                  transposeSemitones={transposeSemitones}
                  showNashvilleNumbers={showNashvilleNumbers}
                  songKeyRoot={songKeyRoot ?? undefined}
                />
              );
            })}
          </section>
        ))}
      </div>
    </article>
  );
}

function LyricsLineView({ line, transposeSemitones = 0, showNashvilleNumbers = false, songKeyRoot }: { line: LyricsLine; transposeSemitones?: number; showNashvilleNumbers?: boolean; songKeyRoot?: string }) {
  const measureCount = Math.max(1, line.measures.length);
  const hasMeasureBars = measureCount > 1;

  return (
    <div className="line lyrics-line">
      <div
        className="measures"
        style={{ gridTemplateColumns: `repeat(${measureCount}, minmax(0, 1fr))` }}
      >
        {line.measures.map((measure, measureIndex) => (
          <div className="measure" key={measureIndex}>
            <div className="measure-workflow">
              {measure.segments.map((segment, segmentIndex) => {
                const displayChord = segment.type === 'chord'
                  ? showNashvilleNumbers
                    ? getNashvilleChord(segment.chord, songKeyRoot || undefined)
                    : transposeChord(segment.chord, transposeSemitones)
                  : '';
                return (
                  <span className="segment-group" key={segmentIndex}>
                    <span className="segment chord">{displayChord}</span>
                    <span className="segment lyric">{segment.text}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!hasMeasureBars && line.measures[0].segments.length === 0 ? <span className="empty-measure">&nbsp;</span> : null}
    </div>
  );
}
