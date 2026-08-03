import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LyricsSegment, Measure, Song, SongLine } from '../types';
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

interface TimedPhrase {
  offsetEighths: number;
  segments: LyricsSegment[];
}

const INITIAL_LAYOUT: MeasureLayout = { columns: 4, measureWidth: 180 };
const MEASURE_GAP = 8;

export function SongView({ song, transposeSemitones = 0, showNashvilleNumbers = false }: SongViewProps) {
  const songKeyRoot = getKeyRoot(song.metadata.key);
  const songBodyRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<MeasureLayout>(INITIAL_LAYOUT);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    () => getInitiallyCollapsedSections(song),
  );

  useEffect(() => {
    setCollapsedSections(getInitiallyCollapsedSections(song));
  }, [song]);

  const toggleSection = (sectionIndex: number) => {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionIndex)) {
        next.delete(sectionIndex);
      } else {
        next.add(sectionIndex);
      }
      return next;
    });
  };

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
          {song.metadata.form ? <SongForm form={song.metadata.form} /> : null}
          <ScaleDegreeKey />
        </div>
        <div className="meta-list">
          {song.metadata.artist ? <span>{song.metadata.artist}</span> : null}
          {song.metadata.key ? <span>Key: {song.metadata.key}</span> : null}
          {song.metadata.time ? <span>Time: {song.metadata.time}</span> : null}
          {song.metadata.tempo ? <span>Tempo: {song.metadata.tempo}</span> : null}
        </div>
      </header>

      <div className="song-body" ref={songBodyRef}>
        {song.sections.map((section, sectionIndex) => {
          const isCollapsed = collapsedSections.has(sectionIndex);
          const sectionId = `song-section-${sectionIndex}`;

          return (
            <section className={`song-section${isCollapsed ? ' is-collapsed' : ''}`} key={`${section.name}-${sectionIndex}`}>
              <button
                aria-controls={sectionId}
                aria-expanded={!isCollapsed}
                className={`section-label section-toggle section-label-${getSectionClassName(section.name)}`}
                onClick={() => toggleSection(sectionIndex)}
                type="button"
              >
                <span className="section-toggle-icon" aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                {section.name}
              </button>
              <div className="section-content" id={sectionId} hidden={isCollapsed}>
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
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function ScaleDegreeKey() {
  return (
    <div className="scale-degree-key" aria-label="Melody scale degree colors">
      <span className="scale-degree-key-label">Melody</span>
      <div className="scale-degree-key-sequence">
        {[1, 2, 3, 4, 5, 6, 7].map((degree) => (
          <span className={`scale-degree-key-entry melody-degree-${degree}`} key={degree}>
            {degree}
          </span>
        ))}
      </div>
    </div>
  );
}

function getInitiallyCollapsedSections(song: Song): Set<number> {
  return new Set(
    song.sections.flatMap((section, index) => section.collapsedByDefault ? [index] : []),
  );
}

function SongForm({ form }: { form: string }) {
  const entries = form.split(/\s+/).filter(Boolean);

  return (
    <div className="song-form" aria-label="Song form">
      <span className="song-form-label">Form</span>
      <div className="song-form-sequence">
        {entries.map((entry, index) => {
          const { section, measureCount } = parseFormEntry(entry);
          const formType = getFormType(section);
          return (
            <span className="form-item" key={`${entry}-${index}`}>
              <span
                className={`form-entry form-entry-${formType.className}`}
                title={formType.label}
              >
                {section}
              </span>
              {measureCount ? (
                <span className="form-measure-count" title={`${measureCount} measures`}>
                  {measureCount}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function parseFormEntry(entry: string): { section: string; measureCount?: string } {
  const match = entry.match(/^(.+?)\/(\d+)$/);
  return match
    ? { section: match[1], measureCount: match[2] }
    : { section: entry };
}

function getFormType(entry: string): { className: string; label: string } {
  const normalized = entry.toUpperCase();
  if (/^(?:PC|PRE-?CHORUS)\d*$/.test(normalized)) return { className: 'pre-chorus', label: 'Pre-chorus' };
  if (/^(?:V|VERSE)\d*$/.test(normalized)) return { className: 'verse', label: 'Verse' };
  if (/^(?:C|CHORUS)\d*$/.test(normalized)) return { className: 'chorus', label: 'Chorus' };
  if (/^(?:B|BRIDGE)\d*$/.test(normalized)) return { className: 'bridge', label: 'Bridge' };
  if (/^(?:I|INTRO)\d*$/.test(normalized)) return { className: 'intro', label: 'Intro' };
  if (/^(?:O|OUTRO)\d*$/.test(normalized)) return { className: 'outro', label: 'Outro' };
  return { className: 'other', label: 'Song section' };
}

function getSectionClassName(sectionName: string): string {
  return getFormType(sectionName.replace(/\s+/g, '')).className;
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
  const phrases = getTimedPhrases(measure.segments);

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
        {phrases.map((phrase, phraseIndex) => {
          const firstSegment = phrase.segments[0];
          if (phrase.offsetEighths <= 0 || firstSegment?.type !== 'chord' || !firstSegment.anchorAtMeasureStart) {
            return null;
          }
          return (
            <span className="measure-start-chord" key={`start-chord-${phraseIndex}`}>
              {getDisplayChord(firstSegment.chord, transposeSemitones, showNashvilleNumbers, songKeyRoot)}
            </span>
          );
        })}
        {phrases.map((phrase, phraseIndex) => {
          const firstSegment = phrase.segments[0];
          const hasAnchoredChord = phrase.offsetEighths > 0
            && firstSegment?.type === 'chord'
            && firstSegment.anchorAtMeasureStart;
          const phraseStyle = {
            '--phrase-offset': `${(phrase.offsetEighths / eighthNotes) * 100}%`,
          } as CSSProperties;

          return (
            <span className="timed-phrase" key={phraseIndex} style={phraseStyle}>
              {phrase.segments.map((segment, segmentIndex) => {
                const displayChord = segment.type === 'chord'
                  ? getDisplayChord(segment.chord, transposeSemitones, showNashvilleNumbers, songKeyRoot)
                  : '';
                const hideAnchoredChord = hasAnchoredChord && segmentIndex === 0;

                return (
                  <span className={`segment-group${hideAnchoredChord ? ' anchored-chord-group' : ''}`} key={segmentIndex}>
                    <span className={`segment chord${hideAnchoredChord ? ' anchored-chord-placeholder' : ''}`}>{displayChord}</span>
                    <span className={`segment lyric${segment.scaleDegree ? ` melody-degree-${segment.scaleDegree}` : ''}`}>
                      {segment.text}
                    </span>
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function getDisplayChord(chord: string, transposeSemitones: number, showNashvilleNumbers: boolean, songKeyRoot?: string): string {
  return showNashvilleNumbers
    ? getNashvilleChord(chord, songKeyRoot || undefined)
    : transposeChord(chord, transposeSemitones);
}

function getTimedPhrases(segments: LyricsSegment[]): TimedPhrase[] {
  const phrases: TimedPhrase[] = [];
  let currentPhrase: TimedPhrase = {
    offsetEighths: 0,
    segments: [],
  };

  for (const segment of segments) {
    if (segment.lyricOffset !== undefined) {
      if (currentPhrase.segments.length > 0) {
        phrases.push(currentPhrase);
      }
      currentPhrase = {
        offsetEighths: segment.lyricOffset,
        segments: [],
      };
    }
    currentPhrase.segments.push(segment);
  }

  if (currentPhrase.segments.length > 0) {
    phrases.push(currentPhrase);
  }
  return phrases;
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
  const phrases = Array.from(measure.querySelectorAll<HTMLElement>('.timed-phrase'));
  if (!workflow || phrases.length === 0) {
    return 120;
  }

  // Timing offsets position phrases within a cell, but should not make every
  // cell in the song wider. Size the measure from visible chord/lyric content
  // alone, as if the offset markers were not present.
  const phraseGap = parseFloat(getComputedStyle(phrases[0]).columnGap) || 0;
  const lyricContentWidth = phrases.reduce(
    (width, phrase) => width + phrase.scrollWidth,
    phraseGap * Math.max(0, phrases.length - 1),
  );
  const anchoredChordWidth = measure.querySelector<HTMLElement>('.measure-start-chord')?.scrollWidth ?? 0;
  const requiredContentWidth = Math.max(lyricContentWidth, anchoredChordWidth);

  const horizontalChrome = parseFloat(measureStyle.paddingLeft)
    + parseFloat(measureStyle.paddingRight)
    + parseFloat(measureStyle.borderLeftWidth)
    + parseFloat(measureStyle.borderRightWidth);
  return Math.ceil(requiredContentWidth + horizontalChrome + 4);
}

function getPreferredColumnCount(availableWidth: number, measureWidth: number): number {
  for (const columns of [8, 4, 3, 2]) {
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
