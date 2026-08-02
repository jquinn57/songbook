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
* Section directives (verse, chorus, bridge, etc.)
* Chords embedded in lyrics using standard ChordPro syntax (e.g. `[G]`)
* Plain lyric lines
* Comments

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

Prefix the first word of a phrase with one or more `~` characters to delay the
lyrics within that measure. Each `~` represents one eighth note. The opening
chord remains on beat one, and measures using an offset display beat lines based
on the song's `{time:}` metadata.

```text
| [G]~~Amazing grace | [C]how sweet the sound |
```

Only the beginning of the phrase is offset; subsequent words and chords flow
normally.

## UI

The application should initially consist of:

* A file picker for opening a local `.cho` or `.chopro` file
* A rendered song view
* Responsive layout that works well on desktop and iPad
* Basic CSS styling with chords above lyrics
* Equal-width measure cells when bar lines are present

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
