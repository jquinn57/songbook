import { ChordSegment, LyricsLine, Measure, Metadata, PlainTextSegment, Song, SongSection } from './types';

const metadataKeys = ['title', 'subtitle', 'artist', 'key', 'time', 'tempo'] as const;

type MetadataKey = (typeof metadataKeys)[number];

const metadataPattern = /^\{\s*([a-zA-Z]+)\s*:\s*(.*?)\s*\}$/;
const sectionStartPattern = /^\{\s*(?:start_of_)?(verse|chorus|bridge|intro|outro|pre-chorus|solo|repeat|tag|coda|section)\s*(?:[:=]\s*(.*?)\s*)?\}$/i;
const sectionEndPattern = /^\{\s*(?:end_of_)?(?:verse|chorus|bridge|intro|outro|pre-chorus|solo|repeat|tag|coda|section)\s*\}$/i;
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
    }

    if (commentPattern.test(line)) {
      currentSection.lines.push({ type: 'comment', text: line.trim() });
      continue;
    }

    const sectionStartMatch = line.match(sectionStartPattern);
    if (sectionStartMatch) {
      addSection(currentSection);
      currentSection = {
        name: normalizeSectionName(sectionStartMatch[2] ?? sectionStartMatch[1]),
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

  return {
    metadata,
    sections,
  };
}

function parseLyricsLine(line: string): LyricsLine {
  const hasBar = line.includes('|');
  const rawMeasures = line.split('|').map((segment) => segment.replace(/\s+$/g, ''));
  const measures: Measure[] = rawMeasures
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => ({ segments: parseSegments(segment) }));

  if (!hasBar) {
    return { type: 'lyrics', measures: [{ segments: parseSegments(line) }] };
  }

  return { type: 'lyrics', measures: measures.length ? measures : [{ segments: [] }] };
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
