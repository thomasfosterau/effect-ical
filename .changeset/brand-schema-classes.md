---
"@thomasfosterau/effect-ical": minor
---

Brand the `Calendar`, `Event` and `Todo` Schema classes and the `ParseError`, `EncodeError` and `BuildError` error classes. A structurally compatible plain object no longer type-checks where an instance is expected (for example `Calendar.withEvent({ component: "VEVENT", dtstart: "…" })`): build values with `make`, the setters, `new Event.Event(…)` or decoding. Runtime behaviour is unchanged.
