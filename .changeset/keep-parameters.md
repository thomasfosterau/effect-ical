---
"@thomasfosterau/effect-ical": minor
---

Keep property parameters (#22). Every component (and each `STANDARD` / `DAYLIGHT` observance, now the exported `Observance` type) gains an optional `parameters: FieldParameters`, the parameters of its typed fields keyed by field name, one list per content line: `event.parameters?.dtstart?.[0]` holds `DTSTART`'s `TZID` or `VALUE=DATE`, and `event.parameters?.attendee?.[i]` the `i`-th attendee's `CN`, `PARTSTAT`, …. The encoder writes them back, so `encode(parse(text))` keeps them. Existing fields are unchanged.

The parser now reads each line with `ContentLine.parse`, so a quoted `:` inside a parameter value (`ORGANIZER;CN="Room: 4":mailto:…`) stays in the parameter instead of ending up in the value. A line `ContentLine.parse` rejects (an unterminated quote) is read as before, without parameters.
