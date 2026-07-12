const noteNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const noteAliases: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'E#': 'F',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
  'B#': 'C',
  'Cb': 'B',
};

function normalizeNoteName(note: string): string {
  return noteAliases[note] || note;
}

function findNoteIndex(note: string): number {
  const normalized = normalizeNoteName(note);
  return noteNames.indexOf(normalized);
}

function transposeNote(note: string, semitones: number): string {
  const idx = findNoteIndex(note);
  if (idx === -1) {
    return note;
  }
  const newIdx = (idx + semitones + noteNames.length * 100) % noteNames.length;
  return noteNames[newIdx];
}

/**
 * Transpose a chord by a given number of semitones.
 * Handles simple chords (e.g., Am7), slash chords (e.g., Am7/C),
 * and power chords (e.g., A5).
 */
export function transposeChord(chord: string, semitones: number): string {
  if (!chord || semitones === 0) {
    return chord;
  }

  // Handle slash chords: split on the last '/'
  const slashIndex = chord.lastIndexOf('/');
  if (slashIndex !== -1) {
    const rootPart = chord.substring(0, slashIndex);
    const bassPart = chord.substring(slashIndex + 1).trim();
    const transposedRoot = transposeChord(rootPart, semitones);
    const transposedBass = transposeNote(bassPart, semitones);
    return `${transposedRoot}/${transposedBass}`;
  }

  // Extract root note (first 1-2 characters)
  let rootEnd = 1;
  if (chord.length > 1 && (chord[1] === '#' || chord[1] === 'b')) {
    rootEnd = 2;
  }

  const root = chord.substring(0, rootEnd);
  const modifier = chord.substring(rootEnd);

  const newRoot = transposeNote(root, semitones);
  return newRoot + modifier;
}

/**
 * Get the transposition offset string for display.
 * e.g., +2 for up 2 semitones, -3 for down 3 semitones.
 */
export const majorScaleOffsets = [0, 2, 4, 5, 7, 9, 11];

export function getKeyRoot(rawKey?: string): string | null {
  if (!rawKey) {
    return null;
  }

  const normalized = rawKey.trim();
  const match = normalized.match(/^([A-G])([#b])?/i);
  if (!match) {
    return null;
  }

  return normalizeNoteName(`${match[1].toUpperCase()}${match[2] ?? ''}`);
}

function getNashvilleNumber(root: string, keyRoot: string): string {
  const rootIndex = findNoteIndex(root);
  const keyIndex = findNoteIndex(keyRoot);
  if (rootIndex === -1 || keyIndex === -1) {
    return root;
  }

  const diff = (rootIndex - keyIndex + noteNames.length) % noteNames.length;

  for (let i = 0; i < majorScaleOffsets.length; i += 1) {
    if (diff === majorScaleOffsets[i]) {
      return `${i + 1}`;
    }
  }

  for (let i = 0; i < majorScaleOffsets.length; i += 1) {
    if (diff === (majorScaleOffsets[i] + 1) % noteNames.length) {
      return `#${i + 1}`;
    }
    if (diff === (majorScaleOffsets[i] + noteNames.length - 1) % noteNames.length) {
      return `b${i + 1}`;
    }
  }

  return root;
}

export function getNashvilleChord(chord: string, keyRoot?: string): string {
  if (!keyRoot || !chord) {
    return chord;
  }

  const slashIndex = chord.lastIndexOf('/');
  if (slashIndex !== -1) {
    const rootPart = chord.substring(0, slashIndex);
    const bassPart = chord.substring(slashIndex + 1).trim();
    const transposedRoot = getNashvilleChord(rootPart, keyRoot);
    const bassRootEnd = bassPart.length > 1 && (bassPart[1] === '#' || bassPart[1] === 'b') ? 2 : 1;
    const bassRoot = bassPart.substring(0, bassRootEnd);
    const bassModifier = bassPart.substring(bassRootEnd);
    const bassNumber = getNashvilleNumber(bassRoot, keyRoot);
    return `${transposedRoot}/${bassNumber}${bassModifier}`;
  }

  let rootEnd = 1;
  if (chord.length > 1 && (chord[1] === '#' || chord[1] === 'b')) {
    rootEnd = 2;
  }

  const root = chord.substring(0, rootEnd);
  const modifier = chord.substring(rootEnd);
  const degree = getNashvilleNumber(root, keyRoot);
  return `${degree}${modifier}`;
}

export function getTranspositionDisplay(semitones: number): string {
  if (semitones === 0) return 'Original';
  if (semitones > 0) return `+${semitones} semitone${semitones !== 1 ? 's' : ''}`;
  return `${semitones} semitone${semitones !== -1 ? 's' : ''}`;
}
