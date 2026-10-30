---
"@thomasfosterau/effect-ical": patch
---

Internal cleanups from the stricter lint set: `Calendar`'s pipeable setters name their parameter `current` instead of shadowing `Calendar.builder` (the emitted `.d.ts` changes only that parameter name), and the parser builds its `VCalendar` result without a type assertion. No runtime behaviour changes.
