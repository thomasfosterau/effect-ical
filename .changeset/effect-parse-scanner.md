---
"@thomasfosterau/effect-ical": minor
---

Scan content lines with a compiled `@thomasfosterau/effect-parse` grammar (#7). Parsing output and every error message are unchanged; the line stage runs about 1.8× faster.

- `@thomasfosterau/effect-parse` `^0.2.0` is a new peer dependency, and the `effect` peer floor rises from `>=4.0.0-rc.118` to `>=4.0.0`, the floor effect-parse peers on.
- `ParseError` gains optional `line` and `column` fields (1-based): set for a line without `:` (where that line starts) and for an unclosed component (its `BEGIN` line).
