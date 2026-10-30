# @thomasfosterau/effect-ical

## 0.1.0

### Minor Changes

- 2a37176: Brand the `Calendar`, `Event` and `Todo` Schema classes and the `ParseError`, `EncodeError` and `BuildError` error classes. A structurally compatible plain object no longer type-checks where an instance is expected (for example `Calendar.withEvent({ component: "VEVENT", dtstart: "…" })`): build values with `make`, the setters, `new Event.Event(…)` or decoding. Runtime behaviour is unchanged.
- 1cda09f: Add `ContentLine`, the content-line layer iCalendar shares with vCard (#21): `unfold`, `parse` / `parseAll` (group, upper-cased name, parameters with quoted and RFC 6868 caret-encoded values, verbatim value), `format` / `fold`, `getParameter`, and the TEXT helpers `escapeText`, `unescapeText` and `splitValue`. Failures are a new `ContentLineError`.
  
  All parsing is now done with `@thomasfosterau/effect-parse` grammars, replacing the regexes and `indexOf` / `split` code: the content lines, the iCalendar parser's line splitting and numeric properties, and `Calendar.decode`. Output is unchanged (the golden corpus, plus a differential fuzz against the previous code) with one exception: a numeric property (`PRIORITY`, `PERCENT-COMPLETE`, `REPEAT`, `SEQUENCE`) whose leading integer exceeds `Number.MAX_SAFE_INTEGER` now stays text. Before, it was an imprecise number.
- 9ff8f63: Move to Effect 4 (`effect` peer `>=4.0.0-rc.118`) and an ESM-only build.
  
  - `parseEither` is replaced by `parseResult`, returning an Effect 4 `Result`; `encodeResult` is new. `parse` and `encode` stay Effects and now run their work when the Effect runs.
  - `ParseError`, `EncodeError` and the new `BuildError` are `Schema.TaggedError` classes (constructed as `new ParseError({ message })`). `encodeSync` throws the `EncodeError` itself, the builders throw `BuildError`, and `Calendar.decode` fails with `ParseError` instead of a bare `Error`; every message is unchanged.
  - `Calendar.withEvent` / `Calendar.withTodo` take `Event` / `Todo` values (they took `any`), and `Calendar.events` / `Calendar.todos` are typed accordingly; `Calendar.encode`, `Event.encode` and `Todo.encode` no longer declare an error channel.
  - The CommonJS build is dropped.
  - Every export has a doc comment, and the README documents the whole API.
- 16234d6: Scan content lines with a compiled `@thomasfosterau/effect-parse` grammar (#7). Parsing output and every error message are unchanged; the line stage runs about 1.8× faster.
  
  - `@thomasfosterau/effect-parse` `^0.2.0` is a new peer dependency, and the `effect` peer floor rises from `>=4.0.0-rc.118` to `>=4.0.0`, the floor effect-parse peers on.
  - `ParseError` gains optional `line` and `column` fields (1-based): set for a line without `:` (where that line starts) and for an unclosed component (its `BEGIN` line).
- 227830c: The pipeable setters of `Calendar`, `Event` and `Todo` (`Event.withUid`, `Todo.withDue`, `Calendar.withEvent`, …) now return instances of the Schema class, built with its constructor, instead of prototype-less object spreads typed as the class. `instanceof Event` (and `Todo`, `Calendar`) now holds after a setter, and `Schema.encode` accepts the result. Properties the class does not declare are no longer carried through a setter: a value cast to `Event` with extra fields loses them.
- e0bb224: The parser unescapes TEXT values, so `parse(encode(calendar))` round-trips them (#23). This is a behaviour change: `SUMMARY:Lunch\, then 1:1` now parses to `"Lunch, then 1:1"`, not `"Lunch\\, then 1:1"`.
  
  - Unescaped: `SUMMARY`, `DESCRIPTION`, `LOCATION`, `COMMENT`, `CONTACT`, `NAME`, `TZNAME`, `X-WR-CALNAME` and `X-WR-CALDESC` (`\\`, `\;`, `\,`, `\n` / `\N`; other backslash sequences are kept).
  - Each `CATEGORIES` line splits at its unescaped commas: `CATEGORIES:WORK,MEETING` parses to `["WORK", "MEETING"]`, not `["WORK,MEETING"]`.
  - The encoder escapes each `CATEGORIES` item and `TZNAME`, which it wrote verbatim before.
- 7958c5a: Add `VCard`, a vCard 4.0 (RFC 6350) codec on the shared `ContentLine` layer (#26):
  
  - `parse` / `parseResult` read every card in a `.vcf` input. Groups and parameters are kept; TEXT values are unescaped; `N`, `ADR`, `ORG` and `GENDER` are structured; URIs and dates stay verbatim.
  - `encode` / `encodeResult` write one card or many.
  - `make`, `types` and `preferred` are helpers.
  - Nothing is lost: untyped properties, extra occurrences of at-most-once properties and misfit structured values are kept in `extra`.
  - Failures are `VCardParseError` (with `line` / `column`) and `VCardEncodeError`.

### Patch Changes

- 563a656: `Event`'s `priority` and `Todo`'s `priority` and `percent` fields are now `Schema.Finite` instead of `Schema.Number`, so constructing one with `NaN` or `±Infinity` throws a schema error (as any other invalid field does) instead of later encoding `PRIORITY:NaN`.
- ab848dd: Internal cleanups from the stricter lint set: `Calendar`'s pipeable setters name their parameter `current` instead of shadowing `Calendar.builder` (the emitted `.d.ts` changes only that parameter name), and the parser builds its `VCalendar` result without a type assertion. No runtime behaviour changes.
