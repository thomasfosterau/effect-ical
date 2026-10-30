---
"@thomasfosterau/effect-ical": minor
---

Add `ContentLine`, the content-line layer iCalendar shares with vCard (#21): `unfold`, `parse` / `parseAll` (group, upper-cased name, parameters with quoted and RFC 6868 caret-encoded values, verbatim value), `format` / `fold`, `getParameter`, and the TEXT helpers `escapeText`, `unescapeText` and `splitValue`. Failures are a new `ContentLineError`.

All parsing is now done with `@thomasfosterau/effect-parse` grammars, replacing the regexes and `indexOf` / `split` code: the content lines, the iCalendar parser's line splitting and numeric properties, and `Calendar.decode`. Output is unchanged (the golden corpus, plus a differential fuzz against the previous code) with one exception: a numeric property (`PRIORITY`, `PERCENT-COMPLETE`, `REPEAT`, `SEQUENCE`) whose leading integer exceeds `Number.MAX_SAFE_INTEGER` now stays text. Before, it was an imprecise number.
