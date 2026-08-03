import { ChordSegment, LyricsLine, Measure, Metadata, PlainTextSegment, ScaleDegree, Song, SongSection } from './types';

const metadataKeys = ['title', 'subtitle', 'artist', 'key', 'time', 'tempo'] as const;

type MetadataKey = (typeof metadataKeys)[number];

const metadataPattern = /^\{\s*([a-zA-Z]+)\s*:\s*(.*?)\s*\}$/;
const sectionStartPattern = /^\{\s*(?:start_of_)?(verse|chorus|bridge|intro|outro|pre-chorus|solo|repeat|tag|coda|section)\s*(?:[:=]\s*(.*?)\s*)?\}$/i;
const sectionEndPattern = /^\{\s*(?:end_of_)?(?:verse|chorus|bridge|intro|outro|pre-chorus|solo|repeat|tag|coda|section)\s*\}$/i;
const sectionReferencePattern = /^\{\s*(verse|chorus|bridge|intro|outro|pre-chorus|solo|repeat|tag|coda)\s*\}$/i;
const commentPattern = /^(?:\s*[#;]|\s*\/\/)/;

export function parseChordPro(source: string): Song {
  const metadata: Metadata = {};
  const sections: SongSection[] = [];
  let currentSection: SongSection = { name: 'Default', lines: [] };

  const normalizeSectionName = (name: string) => name.trim() || 'Section';

  const hasMeaningfulLines = (section: SongSection) =>
    section.lines.some((line) => line.type === 'lyrics');

  const addSection = (section: SongSection) => {
    if (section.name === 'Default' && !hasMeaningfulLines(section)) {
      return;
    }

    if (section.lines.length > 0 || section.name !== 'Default') {
      sections.push(section);
    }
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '    ').replace(/^\uFEFF/, '');
    if (!line.trim()) {
      currentSection.lines.push({ type: 'blank' });
      continue;
    }

    const metadataMatch = line.match(metadataPattern);
    if (metadataMatch) {
      const key = metadataMatch[1].toLowerCase();
      const value = metadataMatch[2].trim();
      if (metadataKeys.includes(key as MetadataKey)) {
        metadata[key as MetadataKey] = value;
        continue;
      }
      if (key === 'meta') {
        const formMatch = value.match(/^form\s*:?[\s]+(.+)$/i);
        if (formMatch) {
          metadata.form = formMatch[1].trim();
        }
        // Other extended metadata is valid but not currently displayed.
        continue;
      }
    }

    if (commentPattern.test(line)) {
      currentSection.lines.push({ type: 'comment', text: line.trim() });
      continue;
    }

    const sectionReferenceMatch = line.match(sectionReferencePattern);
    if (sectionReferenceMatch) {
      addSection(currentSection);
      const referenceKind = sectionReferenceMatch[1].toLowerCase();
      sections.push({
        name: normalizeSectionName(sectionReferenceMatch[1]),
        kind: referenceKind,
        lines: [],
        collapsedByDefault: true,
        referenceKind,
      });
      currentSection = { name: 'Default', lines: [] };
      continue;
    }

    const sectionStartMatch = line.match(sectionStartPattern);
    if (sectionStartMatch) {
      addSection(currentSection);
      currentSection = {
        name: normalizeSectionName(sectionStartMatch[2] ?? sectionStartMatch[1]),
        kind: sectionStartMatch[1].toLowerCase(),
        lines: [],
      };
      continue;
    }

    if (sectionEndPattern.test(line)) {
      addSection(currentSection);
      currentSection = { name: 'Default', lines: [] };
      continue;
    }

    currentSection.lines.push(parseLyricsLine(line));
  }

  addSection(currentSection);

  const resolvedSections = sections.map((section, sectionIndex) => {
    if (!section.referenceKind) {
      return section;
    }

    const referenceName = section.referenceKind.toLowerCase();
    const precedingSource = sections
      .slice(0, sectionIndex)
      .reverse()
      .find((candidate) => !candidate.referenceKind && sectionMatchesReference(candidate, referenceName));
    const source = precedingSource
      ?? sections.find((candidate) => !candidate.referenceKind && sectionMatchesReference(candidate, referenceName));

    return source ? { ...section, name: source.name, lines: source.lines } : section;
  });

  return {
    metadata,
    sections: resolvedSections,
  };
}

function sectionMatchesReference(section: SongSection, referenceName: string): boolean {
  return section.kind?.toLowerCase() === referenceName
    || section.name.trim().toLowerCase() === referenceName;
}

function parseLyricsLine(line: string): LyricsLine {
  const hasBar = line.includes('|');
  const rawMeasures = line.split('|').map((segment) => segment.replace(/\s+$/g, ''));
  const measures: Measure[] = rawMeasures
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map(parseMeasure);

  if (!hasBar) {
    return { type: 'lyrics', measures: [parseMeasure(line)] };
  }

  return { type: 'lyrics', measures: measures.length ? measures : [{ segments: [] }] };
}

function parseMeasure(text: string): Measure {
  const parsedSegments = parseSegments(text);
  if (text.startsWith('[') && parsedSegments[0]?.type === 'chord') {
    parsedSegments[0].anchorAtMeasureStart = true;
  }
  let segments: Array<ChordSegment | PlainTextSegment> = [];
  let pendingOffset = 0;
  let currentOffset = 0;

  for (const segment of parsedSegments) {
    const markerPattern = /~+/g;
    let cursor = 0;
    let chordPlaced = false;
    let markerMatch: RegExpExecArray | null;

    const appendText = (lyricText: string) => {
      if (pendingOffset > 0) {
        currentOffset += pendingOffset;
      }
      const lyricOffset = pendingOffset > 0 ? currentOffset : undefined;
      pendingOffset = 0;

      if (segment.type === 'chord' && !chordPlaced) {
        segments.push({
          type: 'chord',
          chord: segment.chord,
          text: lyricText,
          ...(segment.anchorAtMeasureStart ? { anchorAtMeasureStart: true } : {}),
          ...(lyricOffset ? { lyricOffset } : {}),
        });
        chordPlaced = true;
        return;
      }

      segments.push({
        type: 'text',
        text: lyricText,
        ...(lyricOffset ? { lyricOffset } : {}),
      });
    };

    while ((markerMatch = markerPattern.exec(segment.text)) !== null) {
      const lyricBeforeMarker = segment.text.slice(cursor, markerMatch.index);
      if (lyricBeforeMarker.trim().length > 0) {
        appendText(lyricBeforeMarker);
      }
      pendingOffset += markerMatch[0].length;
      cursor = markerMatch.index + markerMatch[0].length;
    }

    const remainingLyric = segment.text.slice(cursor);
    if (remainingLyric.trim().length > 0) {
      appendText(remainingLyric);
    } else if (cursor === 0 && pendingOffset === 0 && remainingLyric.length > 0) {
      appendText(remainingLyric);
    }

    // Preserve chord-only segments while allowing a marker at the end of one
    // segment to apply to the lyric in the next segment.
    if (segment.type === 'chord' && !chordPlaced) {
      segments.push({
        type: 'chord',
        chord: segment.chord,
        text: '',
        ...(segment.anchorAtMeasureStart ? { anchorAtMeasureStart: true } : {}),
      });
    }
  }

  if (segments.length === 0) {
    segments = [{ type: 'text', text: '' }];
  }

  return { segments: applyMelodyAnnotations(segments) };
}

function applyMelodyAnnotations(segments: Array<ChordSegment | PlainTextSegment>): Array<ChordSegment | PlainTextSegment> {
  const annotatedSegments: Array<ChordSegment | PlainTextSegment> = [];
  let activeDegree: ScaleDegree | undefined;
  let degreeHasText = false;

  for (const segment of segments) {
    const tokenPattern = /<([1-7])>|(\s+)|([^<\s]+|<)/g;
    let chordPlaced = false;
    let offsetPlaced = false;
    let tokenMatch: RegExpExecArray | null;

    const appendPiece = (text: string, scaleDegree?: ScaleDegree) => {
      const lyricOffset = !offsetPlaced ? segment.lyricOffset : undefined;
      offsetPlaced = true;

      if (segment.type === 'chord' && !chordPlaced) {
        annotatedSegments.push({
          type: 'chord',
          chord: segment.chord,
          text,
          ...(segment.anchorAtMeasureStart ? { anchorAtMeasureStart: true } : {}),
          ...(lyricOffset !== undefined ? { lyricOffset } : {}),
          ...(scaleDegree !== undefined ? { scaleDegree } : {}),
        });
        chordPlaced = true;
        return;
      }

      annotatedSegments.push({
        type: 'text',
        text,
        ...(lyricOffset !== undefined ? { lyricOffset } : {}),
        ...(scaleDegree !== undefined ? { scaleDegree } : {}),
      });
    };

    while ((tokenMatch = tokenPattern.exec(segment.text)) !== null) {
      if (tokenMatch[1]) {
        activeDegree = Number(tokenMatch[1]) as ScaleDegree;
        degreeHasText = false;
        continue;
      }

      const token = tokenMatch[0];
      if (tokenMatch[2]) {
        appendPiece(token);
        if (degreeHasText) {
          activeDegree = undefined;
          degreeHasText = false;
        }
        continue;
      }

      appendPiece(token, activeDegree);
      if (activeDegree !== undefined) {
        degreeHasText = true;
      }
    }

    if (segment.type === 'chord' && !chordPlaced) {
      annotatedSegments.push({
        type: 'chord',
        chord: segment.chord,
        text: '',
        ...(segment.anchorAtMeasureStart ? { anchorAtMeasureStart: true } : {}),
        ...(segment.lyricOffset !== undefined ? { lyricOffset: segment.lyricOffset } : {}),
      });
    }
  }

  return annotatedSegments.length > 0
    ? annotatedSegments
    : [{ type: 'text', text: '' }];
}

function parseSegments(text: string): Array<ChordSegment | PlainTextSegment> {
  const segments: Array<ChordSegment | PlainTextSegment> = [];
  let cursor = 0;

  while (true) {
    const startIndex = text.indexOf('[', cursor);
    if (startIndex === -1) {
      break;
    }

    const endIndex = text.indexOf(']', startIndex + 1);
    if (endIndex === -1) {
      break;
    }

    if (startIndex > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, startIndex) });
    }

    const chord = text.slice(startIndex + 1, endIndex).trim();
    cursor = endIndex + 1;
    const nextChordIndex = text.indexOf('[', cursor);
    const lyricText = nextChordIndex === -1 ? text.slice(cursor) : text.slice(cursor, nextChordIndex);
    segments.push({ type: 'chord', chord, text: lyricText });
    cursor = nextChordIndex === -1 ? text.length : nextChordIndex;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) });
  }

  return segments.length ? segments : [{ type: 'text', text }];
}
