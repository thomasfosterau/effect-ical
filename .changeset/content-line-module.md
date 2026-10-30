---
"@thomasfosterau/effect-ical": minor
---

Add `ContentLine`, the content-line layer iCalendar shares with vCard (#21): `unfold`, `parse` / `parseAll` (group, upper-cased name, parameters with quoted and RFC 6868 caret-encoded values, verbatim value), `format` / `fold`, `getParameter`, and the TEXT helpers `escapeText`, `unescapeText` and `splitValue`. Failures are a new `ContentLineError`.

The iCalendar parser and encoder now unfold, fold and escape through it; their output is unchanged.
