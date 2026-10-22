---
"@thomasfosterau/effect-ical": minor
---

Move to Effect 4 (`effect` peer `>=4.0.0-rc.118`) and an ESM-only build.

- `parseEither` is replaced by `parseResult`, returning an Effect 4 `Result`; `encodeResult` is new. `parse` and `encode` stay Effects and now run their work when the Effect runs.
- `ParseError`, `EncodeError` and the new `BuildError` are `Schema.TaggedError` classes (constructed as `new ParseError({ message })`). `encodeSync` throws the `EncodeError` itself, the builders throw `BuildError`, and `Calendar.decode` fails with `ParseError` instead of a bare `Error`; every message is unchanged.
- `Calendar.withEvent` / `Calendar.withTodo` take `Event` / `Todo` values (they took `any`), and `Calendar.events` / `Calendar.todos` are typed accordingly; `Calendar.encode`, `Event.encode` and `Todo.encode` no longer declare an error channel.
- The CommonJS build is dropped.
- Every export has a doc comment, and the README documents the whole API.
