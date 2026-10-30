---
"@thomasfosterau/effect-ical": patch
---

`Event`'s `priority` and `Todo`'s `priority` and `percent` fields are now `Schema.Finite` instead of `Schema.Number`, so constructing one with `NaN` or `±Infinity` throws a schema error (as any other invalid field does) instead of later encoding `PRIORITY:NaN`.
