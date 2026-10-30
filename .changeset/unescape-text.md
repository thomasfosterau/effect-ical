---
"@thomasfosterau/effect-ical": minor
---

The parser unescapes TEXT values, so `parse(encode(calendar))` round-trips them (#23). This is a behaviour change: `SUMMARY:Lunch\, then 1:1` now parses to `"Lunch, then 1:1"`, not `"Lunch\\, then 1:1"`.

- Unescaped: `SUMMARY`, `DESCRIPTION`, `LOCATION`, `COMMENT`, `CONTACT`, `NAME`, `TZNAME`, `X-WR-CALNAME` and `X-WR-CALDESC` (`\\`, `\;`, `\,`, `\n` / `\N`; other backslash sequences are kept).
- Each `CATEGORIES` line splits at its unescaped commas: `CATEGORIES:WORK,MEETING` parses to `["WORK", "MEETING"]`, not `["WORK,MEETING"]`.
- The encoder escapes each `CATEGORIES` item and `TZNAME`, which it wrote verbatim before.
