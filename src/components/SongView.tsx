import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Measure, Song, SongLine } from '../types';
import { getKeyRoot, getNashvilleChord, transposeChord } from '../transpose';

interface SongViewProps {
  song: Song;
  transposeSemitones?: number;
  showNashvilleNumbers?: boolean;
}

interface MeasureLayout {
  columns: number;
  measureWidth: number;
}

type SectionBlock =
  | { type: 'measures'; measures: Measure[] }
  | { type: 'comment'; text: string };

const INITIAL_LAYOUT: MeasureLayout = { columns: 4, measureWidth: 180 };
const MEASURE_GAP = 8;

export function SongView({ song, transposeSemitones = 0, showNashvilleNumbers = false }: SongViewProps) {
  const songKeyRoot = getKeyRoot(song.metadata.key);
  const songBodyRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<MeasureLayout>(INITIAL_LAYOUT);

  useLayoutEffect(() => {
    const songBody = songBodyRef.current;
    if (!songBody) {
      return;
    }

    const calculateLayout = () => {
      const section = songBody.querySelector<HTMLElement>('.song-section');
      const measureElements = Array.from(songBody.querySelectorAll<HTMLElement>('.measure'));
      if (!section || measureElements.length === 0) {
        return;
      }

      const sectionStyle = getComputedStyle(section);
      const availableWidth = section.clientWidth
        - parseFloat(sectionStyle.paddingLeft)
        - parseFloat(sectionStyle.paddingRight);

      const measureWidth = Math.max(
        120,
        ...measureElements.map(getRequiredMeasureWidth),
      );
      const columns = getPreferredColumnCount(availableWidth, measureWidth);

      setLayout((current) => (
        current.columns === columns && Math.abs(current.measureWidth - measureWidth) < 1
          ? current
          : { columns, measureWidth }
      ));
    };

    calculateLayout();
    const resizeObserver = new ResizeObserver(calculateLayout);
    resizeObserver.observe(songBody);
    document.fonts?.ready.then(calculateLayout);

    return () => resizeObserver.disconnect();
  }, [song, transposeSemitones, showNashvilleNumbers]);

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

      <div className="song-body" ref={songBodyRef}>
        {song.sections.map((section, sectionIndex) => (
          <section className="song-section" key={`${section.name}-${sectionIndex}`}>
            <div className="section-label">{section.name}</div>
            {getSectionBlocks(section.lines).map((block, blockIndex) => {
              if (block.type === 'comment') {
                return (
                  <div className="line comment-line" key={blockIndex}>
                    {block.text}
                  </div>
                );
              }

              return (
                <MeasureGrid
                  columns={layout.columns}
                  key={blockIndex}
                  measureWidth={layout.measureWidth}
                  measures={block.measures}
                  showNashvilleNumbers={showNashvilleNumbers}
                  songKeyRoot={songKeyRoot ?? undefined}
                  timeSignature={song.metadata.time}
                  transposeSemitones={transposeSemitones}
                />
              );
            })}
          </section>
        ))}
      </div>
    </article>
  );
}

function MeasureGrid({ columns, measureWidth, measures, transposeSemitones, showNashvilleNumbers, songKeyRoot, timeSignature }: {
  columns: number;
  measureWidth: number;
  measures: Measure[];
  transposeSemitones: number;
  showNashvilleNumbers: boolean;
  songKeyRoot?: string;
  timeSignature?: string;
}) {
  const { beats, eighthNotes } = getTimeSignatureLayout(timeSignature);

  return (
    <div
      className="measures"
      style={{ gridTemplateColumns: `repeat(${columns}, ${measureWidth}px)` }}
    >
      {measures.map((measure, measureIndex) => (
        <MeasureView
          beats={beats}
          eighthNotes={eighthNotes}
          key={measureIndex}
          measure={measure}
          showNashvilleNumbers={showNashvilleNumbers}
          songKeyRoot={songKeyRoot}
          transposeSemitones={transposeSemitones}
        />
      ))}
    </div>
  );
}

function MeasureView({ beats, eighthNotes, measure, transposeSemitones, showNashvilleNumbers, songKeyRoot }: {
  beats: number;
  eighthNotes: number;
  measure: Measure;
  transposeSemitones: number;
  showNashvilleNumbers: boolean;
  songKeyRoot?: string;
}) {
  const hasLyricOffset = measure.segments.some((segment) => (segment.lyricOffset ?? 0) > 0);

  return (
    <div className={`measure${hasLyricOffset ? ' has-beat-grid' : ''}`}>
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
      <div className="measure-workflow">
        {measure.segments.map((segment, segmentIndex) => {
          const segmentHasOffset = (segment.lyricOffset ?? 0) > 0;
          const lyricOffsetPercent = ((segment.lyricOffset ?? 0) / eighthNotes) * 100;
          const segmentStyle = segmentHasOffset
            ? ({ '--lyric-offset': `${lyricOffsetPercent}%` } as CSSProperties)
            : undefined;
          const displayChord = segment.type === 'chord'
            ? showNashvilleNumbers
              ? getNashvilleChord(segment.chord, songKeyRoot || undefined)
              : transposeChord(segment.chord, transposeSemitones)
            : '';

          return (
            <span
              className={`segment-group${segmentHasOffset ? ' has-lyric-offset' : ''}${segmentHasOffset && segment.type === 'chord' ? ' delayed-chord-group' : ''}`}
              key={segmentIndex}
              style={segmentStyle}
            >
              <span className={`segment chord${segmentHasOffset && segment.type === 'chord' ? ' delayed-chord' : ''}`}>{displayChord}</span>
              <span className="segment lyric">{segment.text}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function getSectionBlocks(lines: SongLine[]): SectionBlock[] {
  const blocks: SectionBlock[] = [];
  let measures: Measure[] = [];

  const flushMeasures = () => {
    if (measures.length > 0) {
      blocks.push({ type: 'measures', measures });
      measures = [];
    }
  };

  for (const line of lines) {
    if (line.type === 'lyrics') {
      measures.push(...line.measures);
    } else if (line.type === 'comment') {
      flushMeasures();
      blocks.push({ type: 'comment', text: line.text });
    }
  }

  flushMeasures();
  return blocks;
}

function getRequiredMeasureWidth(measure: HTMLElement): number {
  const measureStyle = getComputedStyle(measure);
  const workflow = measure.querySelector<HTMLElement>('.measure-workflow');
  const groups = Array.from(measure.querySelectorAll<HTMLElement>('.segment-group'));
  if (!workflow || groups.length === 0) {
    return 120;
  }

  const workflowStyle = getComputedStyle(workflow);
  const gap = parseFloat(workflowStyle.columnGap) || 0;
  const baseContentWidth = groups.reduce((width, group) => {
    const chord = group.querySelector<HTMLElement>('.chord');
    const lyric = group.querySelector<HTMLElement>('.lyric');
    return width + Math.max(chord?.scrollWidth ?? 0, lyric?.scrollWidth ?? 0);
  }, gap * Math.max(0, groups.length - 1));

  const offsetFraction = groups.reduce((total, group) => {
    if (!group.classList.contains('has-lyric-offset')) {
      return total;
    }
    const value = parseFloat(group.style.getPropertyValue('--lyric-offset')) || 0;
    return total + value / 100;
  }, 0);

  const horizontalChrome = parseFloat(measureStyle.paddingLeft)
    + parseFloat(measureStyle.paddingRight)
    + parseFloat(measureStyle.borderLeftWidth)
    + parseFloat(measureStyle.borderRightWidth);
  const contentWidth = baseContentWidth / Math.max(0.15, 1 - offsetFraction);

  return Math.ceil(contentWidth + horizontalChrome + 4);
}

function getPreferredColumnCount(availableWidth: number, measureWidth: number): number {
  for (const columns of [8, 4, 2]) {
    if ((columns * measureWidth) + ((columns - 1) * MEASURE_GAP) <= availableWidth) {
      return columns;
    }
  }
  return 1;
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
