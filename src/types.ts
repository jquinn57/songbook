export interface Song {
  metadata: Metadata;
  sections: SongSection[];
}

export interface Metadata {
  title?: string;
  subtitle?: string;
  artist?: string;
  key?: string;
  time?: string;
  tempo?: string;
  form?: string;
}

export interface SongSection {
  name: string;
  lines: SongLine[];
  kind?: string;
  collapsedByDefault?: boolean;
  referenceKind?: string;
}

export type SongLine = CommentLine | LyricsLine | BlankLine;

export interface CommentLine {
  type: 'comment';
  text: string;
}

export interface BlankLine {
  type: 'blank';
}

export interface LyricsLine {
  type: 'lyrics';
  measures: Measure[];
}

export interface Measure {
  segments: LyricsSegment[];
}

export type LyricsSegment = ChordSegment | PlainTextSegment;

export interface ChordSegment {
  type: 'chord';
  chord: string;
  text: string;
  /** Eighth-note position of this lyric fragment within the measure. */
  lyricOffset?: number;
}

export interface PlainTextSegment {
  type: 'text';
  text: string;
  /** Eighth-note position of this lyric fragment within the measure. */
  lyricOffset?: number;
}
