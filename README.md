# BarChord Viewer

Build a local web application that renders ChordPro files in the browser. The project should be written in **TypeScript** using **React** and **Vite**.

## Initial Goal

The first milestone is to support a useful subset of ChordPro for displaying songs for guitar and vocals.

Supported features:

* Song metadata:

  * `{title:}`
  * `{subtitle:}`
  * `{artist:}`
  * `{key:}`
  * `{time:}`
  * `{tempo:}`
  * `{meta: form V1/8 V2/8 C/8 B/4 C/8 O/4}` (measure counts are optional)
* Section directives (verse, chorus, bridge, etc.)
* Chords embedded in lyrics using standard ChordPro syntax (e.g. `[G]`)
* Plain lyric lines
* Comments
* Collapsible sections and collapsed section references such as `{chorus}`

## Custom Extension

The only custom extension for now is **semantic bar lines**.

Within lyric lines, the `|` character should be interpreted as a measure boundary by our renderer.

Example:

```text
| [G]I will walk a-[C]lone | [D]by the river |
```

Standard ChordPro renderers will simply display the `|` characters. Our renderer should instead split the line into measures and render each measure as a separate visual cell with visible bar lines.

This extension should remain backward-compatible with normal ChordPro files.

### Delayed lyric starts

Prefix any lyric fragment with one or more `~` characters to delay it within the
measure. Each `~` represents one eighth note. The first run is measured from beat
one; later runs add spacing relative to the preceding lyric. Embedded chords move
with their following lyrics, except that a chord immediately after a bar line or
at the start of a line remains at the start of its measure. Measures using an
offset display beat lines based on the song's `{time:}` metadata.

```text
| [G]~~Amazing ~~grace | [C]how sweet the sound |
```

Text following each marker flows normally until another marker is encountered.

### Melody annotations

Use `<1>` through `<7>` before a lyric to identify the scale degree of its next
note. The renderer removes the annotation and colors the following word, ending
at whitespace or at another annotation. This supports both phrase-level and
note-by-note markup.

```text
| [G]<1>Ama<2>zing <3>grace |
```

## UI

The application should initially consist of:

* A file picker for opening a local `.cho` or `.chopro` file
* A rendered song view
* Responsive layout that works well on desktop and iPad
* Basic CSS styling with chords above lyrics
* Song-wide equal-width measure cells sized to the longest rendered measure
* Automatic 8-, 4-, or 2-measure rows based on the available width

## Architecture

Keep the parser independent from the renderer.

Suggested pipeline:

```
ChordPro text
    ↓
Parser
    ↓
Song model
    ↓
React renderer
```

Represent songs internally with strongly typed interfaces (Song, Section, Measure, ChordSegment, etc.) so future features such as transposition, metronome synchronization, auto-scroll, PDF export, guitar tab, and traditional notation can be added without redesigning the data model.

The focus of this milestone is correctness, clean architecture, and maintainability—not feature completeness.

## Install on an iPad for offline use

The production build is a Progressive Web App. It precaches the complete app,
including the built-in songs, and stores imported ChordPro files in IndexedDB on
the device.

1. Deploy the contents of `dist/` to any HTTPS static host.
2. Open that URL in Safari on the iPad.
3. Wait for **Ready for offline use** to appear.
4. Tap **Share**, then **Add to Home Screen**.
5. Open Songbook from its Home Screen icon once before going offline.

To verify the installation, enable Airplane Mode, fully close Songbook, and open
it again from the Home Screen. Imported songs and the last selected song should
still be available.

Build locally with:

```bash
npm ci
npm run build
```

Service workers require HTTPS, except on `localhost`; opening `dist/index.html`
directly from the Files app will not install the offline cache. Updates are
downloaded automatically the next time the installed app is opened online.
