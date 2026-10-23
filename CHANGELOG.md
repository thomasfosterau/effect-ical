# @thomasfosterau/effect-ical

## 0.1.0

### Minor Changes

- 2a37176: Brand the `Calendar`, `Event` and `Todo` Schema classes and the `ParseError`, `EncodeError` and `BuildError` error classes. A structurally compatible plain object no longer type-checks where an instance is expected (for example `Calendar.withEvent({ component: "VEVENT", dtstart: "…" })`): build values with `make`, the setters, `new Event.Event(…)` or decoding. Runtime behaviour is unchanged.
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
