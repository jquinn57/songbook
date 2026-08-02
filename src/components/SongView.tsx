import type { CSSProperties } from 'react';
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
                  timeSignature={song.metadata.time}
                />
              );
            })}
          </section>
        ))}
      </div>
    </article>
  );
}

function LyricsLineView({ line, transposeSemitones = 0, showNashvilleNumbers = false, songKeyRoot, timeSignature }: { line: LyricsLine; transposeSemitones?: number; showNashvilleNumbers?: boolean; songKeyRoot?: string; timeSignature?: string }) {
  const measureCount = Math.max(1, line.measures.length);
  const hasMeasureBars = measureCount > 1;
  const { beats, eighthNotes } = getTimeSignatureLayout(timeSignature);

  return (
    <div className="line lyrics-line">
      <div
        className="measures"
        style={{ gridTemplateColumns: `repeat(${measureCount}, minmax(0, 1fr))` }}
      >
        {line.measures.map((measure, measureIndex) => {
          const hasLyricOffset = (measure.lyricStartOffset ?? 0) > 0;
          const lyricStartPercent = ((measure.lyricStartOffset ?? 0) / eighthNotes) * 100;
          const anchorChordIndex = hasLyricOffset
            ? measure.segments.findIndex((segment) => segment.type === 'chord')
            : -1;
          const workflowStyle = hasLyricOffset
            ? ({ '--lyric-start': `${lyricStartPercent}%` } as CSSProperties)
            : undefined;

          return (
            <div className={`measure${hasLyricOffset ? ' has-beat-grid' : ''}`} key={measureIndex}>
              {hasLyricOffset ? (
                <div className="beat-grid" aria-hidden="true">
                  {Array.from({ length: Math.max(0, beats - 1) }, (_, beatIndex) => (
                    <span
                      className="beat-line"
                      key={beatIndex}
                      style={{ left: `${((beatIndex + 1) / beats) * 100}%` }}
                    />
                  ))}
                </div>
              ) : null}
              <div className={`measure-workflow${hasLyricOffset ? ' has-lyric-offset' : ''}`} style={workflowStyle}>
                {measure.segments.map((segment, segmentIndex) => {
                  const displayChord = segment.type === 'chord'
                    ? showNashvilleNumbers
                      ? getNashvilleChord(segment.chord, songKeyRoot || undefined)
                      : transposeChord(segment.chord, transposeSemitones)
                    : '';
                  return (
                    <span className={`segment-group${segmentIndex === anchorChordIndex ? ' offset-anchor-group' : ''}`} key={segmentIndex}>
                      <span className={`segment chord${segmentIndex === anchorChordIndex ? ' offset-anchor-chord' : ''}`}>{displayChord}</span>
                      <span className="segment lyric">{segment.text}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {!hasMeasureBars && line.measures[0].segments.length === 0 ? <span className="empty-measure">&nbsp;</span> : null}
    </div>
  );
}

function getTimeSignatureLayout(timeSignature?: string): { beats: number; eighthNotes: number } {
  const match = timeSignature?.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) {
    return { beats: 4, eighthNotes: 8 };
  }

  const beats = Number(match[1]);
  const beatValue = Number(match[2]);
  if (beats < 1 || beatValue < 1) {
    return { beats: 4, eighthNotes: 8 };
  }

  return { beats, eighthNotes: beats * (8 / beatValue) };
}
